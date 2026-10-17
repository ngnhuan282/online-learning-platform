package com.elearning.payment.service;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.common.response.PageResponse;
import com.elearning.payment.config.PaymentProviderPolicy;
import com.elearning.payment.course.CourseSnapshot;
import com.elearning.payment.course.CourseClient;
import com.elearning.payment.dto.*;
import com.elearning.payment.entity.CourseOrder;
import com.elearning.payment.entity.OrderItem;
import com.elearning.payment.entity.Payment;
import com.elearning.payment.entity.PaymentTransaction;
import com.elearning.payment.entity.enums.OrderStatus;
import com.elearning.payment.entity.enums.PaymentEventType;
import com.elearning.payment.entity.enums.PaymentProvider;
import com.elearning.payment.entity.enums.PaymentStatus;
import com.elearning.payment.learning.LearningEnrollmentClient;
import com.elearning.payment.repository.CourseOrderRepository;
import com.elearning.payment.repository.PaymentRepository;
import com.elearning.payment.repository.PaymentTransactionRepository;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentCoreService {

    private static final DateTimeFormatter ORDER_DATE = DateTimeFormatter.BASIC_ISO_DATE.withZone(
        ZoneOffset.UTC
    );

    private final CourseOrderRepository orders;
    private final PaymentRepository payments;
    private final PaymentTransactionRepository transactions;
    private final CourseSnapshotProvider courses;
    private final LearningEnrollmentClient learning;
    private final PaymentProviderPolicy providers;

    public PaymentCoreService(
        CourseOrderRepository orders,
        PaymentRepository payments,
        PaymentTransactionRepository transactions,
        CourseSnapshotProvider courses,
        LearningEnrollmentClient learning,
        PaymentProviderPolicy providers
    ) {
        this.orders = orders;
        this.payments = payments;
        this.transactions = transactions;
        this.courses = courses;
        this.learning = learning;
        this.providers = providers;
    }

    @Transactional
    public CheckoutResponse createCheckout(CheckoutRequest request, Long userId) {
        PaymentProvider provider = request.provider() == null ? PaymentProvider.MOCK : request.provider();
        providers.requireAvailable(provider);
        String idempotencyKey = request.idempotencyKey().strip();
        CourseOrder existingOrder = orders
            .findByUserIdAndIdempotencyKey(userId, idempotencyKey)
            .orElse(null);
        if (existingOrder != null) {
            return existingCheckout(existingOrder, request.courseId(), provider);
        }

        CourseSnapshot course = courses.requirePurchasableCourse(request.courseId());
        CourseOrder order = new CourseOrder(
            generateOrderCode(),
            userId,
            idempotencyKey,
            course.price(),
            course.currency(),
            Instant.now().plusSeconds(15 * 60)
        );
        order.addItem(
            new OrderItem(course.id(), course.title(), course.price(), BigDecimal.ZERO, course.price())
        );
        orders.saveAndFlush(order);

        Payment payment = new Payment(order, provider, course.price(), course.currency());
        payment.assignCheckoutUrl(
            buildCheckoutUrl(provider, request.returnUrl(), request.cancelUrl(), order.getOrderCode())
        );
        payments.saveAndFlush(payment);
        transactions.saveAndFlush(
            new PaymentTransaction(
                payment,
                PaymentEventType.CREATED,
                provider,
                PaymentStatus.PENDING,
                payment.getAmount(),
                payment.getCurrency()
            )
        );

        return new CheckoutResponse(
            order.getOrderCode(),
            toOrderResponse(order, payment),
            toPaymentSummary(payment),
            payment.getCheckoutUrl()
        );
    }

    private CheckoutResponse existingCheckout(
        CourseOrder order,
        Long requestedCourseId,
        PaymentProvider requestedProvider
    ) {
        OrderItem item = firstItem(order);
        Payment payment = latestPayment(order);
        if (
            item == null ||
            payment == null ||
            !item.getCourseId().equals(requestedCourseId) ||
            payment.getProvider() != requestedProvider
        ) {
            throw new AppException(ErrorCode.CONFLICT);
        }
        return new CheckoutResponse(
            order.getOrderCode(),
            toOrderResponse(order, payment),
            toPaymentSummary(payment),
            payment.getCheckoutUrl()
        );
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrder(String orderCode, Long userId, boolean admin) {
        CourseOrder order = orders
            .findByOrderCode(orderCode)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        if (!admin && !order.getUserId().equals(userId)) throw new AppException(ErrorCode.FORBIDDEN);
        return toOrderResponse(order, latestPayment(order));
    }

    @Transactional(readOnly = true)
    public PageResponse<PaymentHistoryItemResponse> getHistory(
        Long userId,
        PaymentStatus status,
        String keyword,
        Pageable pageable
    ) {
        return PageResponse.from(
            orders.searchUserHistory(userId, status, keywordPattern(keyword), pageable).map(this::toHistoryItem)
        );
    }

    @Transactional
    public OrderResponse completeMockPayment(String orderCode, Long userId, MockPaymentRequest request) {
        providers.requireAvailable(PaymentProvider.MOCK);
        CourseOrder order = orders
            .findByOrderCode(orderCode)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        if (!order.getUserId().equals(userId)) throw new AppException(ErrorCode.FORBIDDEN);

        Payment payment = latestPayment(order);
        if (payment == null) throw new AppException(ErrorCode.NOT_FOUND);
        if (payment.getProvider() != PaymentProvider.MOCK) throw new AppException(ErrorCode.CONFLICT);

        PaymentStatus nextStatus = request.status();
        if (
            nextStatus != PaymentStatus.SUCCESS &&
            nextStatus != PaymentStatus.FAILED &&
            nextStatus != PaymentStatus.CANCELLED
        ) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }

        applyPaymentTransition(
            order,
            payment,
            nextStatus,
            stripOrNull(request.providerTransactionCode()),
            mockFailureCode(nextStatus, request.failureCode()),
            mockFailureMessage(nextStatus, request.failureMessage()),
            PaymentEventType.PROVIDER_RETURNED,
            Instant.now()
        );

        return toOrderResponse(order, payment);
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminPaymentListItemResponse> getAdminOrders(
        PaymentStatus status,
        String keyword,
        Pageable pageable
    ) {
        return PageResponse.from(
            orders.searchAdminOrders(status, keywordPattern(keyword), pageable).map(this::toAdminListItem)
        );
    }

    @Transactional(readOnly = true)
    public AdminPaymentDetailResponse getAdminOrder(String orderCode) {
        CourseOrder order = orders
            .findByOrderCode(orderCode)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        return toAdminDetail(order, latestPayment(order));
    }

    @Transactional
    public AdminPaymentDetailResponse updateAdminPaymentStatus(
        String orderCode,
        AdminPaymentStatusUpdateRequest request
    ) {
        CourseOrder order = orders
            .findByOrderCode(orderCode)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        Payment payment = latestPayment(order);
        if (payment == null) throw new AppException(ErrorCode.NOT_FOUND);

        PaymentStatus nextStatus = request.status();
        applyPaymentTransition(
            order,
            payment,
            nextStatus,
            stripOrNull(request.providerTransactionCode()),
            stripOrNull(request.failureCode()),
            stripOrNull(request.failureMessage()),
            PaymentEventType.STATUS_CHANGED,
            Instant.now()
        );
        return toAdminDetail(order, payment);
    }

    private void applyPaymentTransition(
        CourseOrder order,
        Payment payment,
        PaymentStatus nextStatus,
        String providerTransactionCode,
        String failureCode,
        String failureMessage,
        PaymentEventType eventType,
        Instant eventTime
    ) {
        if (nextStatus == PaymentStatus.SUCCESS) providers.requireAvailable(payment.getProvider());
        if (payment.getStatus() == nextStatus) {
            if (nextStatus == PaymentStatus.SUCCESS) {
                enrollPaidCourse(order);
            }
            return;
        }
        if (!availableTransitions(payment.getStatus()).contains(nextStatus)) {
            throw new AppException(ErrorCode.CONFLICT);
        }

        if (nextStatus == PaymentStatus.SUCCESS) {
            enrollPaidCourse(order);
        }

        String transactionCode = providerTransactionCode == null
            ? mockTransactionCode(order.getOrderCode(), nextStatus)
            : providerTransactionCode;
        payment.transitionTo(nextStatus, transactionCode, failureCode, failureMessage, eventTime);
        order.changeStatus(orderStatusFor(nextStatus));
        payments.save(payment);
        orders.save(order);
        transactions.save(
            new PaymentTransaction(
                payment,
                eventType,
                payment.getProvider(),
                payment.getStatus(),
                payment.getAmount(),
                payment.getCurrency(),
                transactionCode,
                null
            )
        );
    }

    private void enrollPaidCourse(CourseOrder order) {
        OrderItem item = firstItem(order);
        if (item == null) {
            throw new AppException(ErrorCode.CONFLICT);
        }
        learning.enroll(order.getOrderCode(), order.getUserId(), item.getCourseId());
    }

    private PaymentHistoryItemResponse toHistoryItem(CourseOrder order) {
        Payment payment = latestPayment(order);
        OrderItem item = firstItem(order);
        return new PaymentHistoryItemResponse(
            order.getOrderCode(),
            payment == null ? PaymentStatus.PENDING : payment.getStatus(),
            payment == null ? order.getTotalAmount() : payment.getAmount(),
            payment == null ? order.getCurrency() : payment.getCurrency(),
            item == null ? "Course" : item.getCourseTitle(),
            order.getCreatedAt(),
            payment == null ? null : payment.getPaidAt()
        );
    }

    private AdminPaymentListItemResponse toAdminListItem(CourseOrder order) {
        Payment payment = latestPayment(order);
        OrderItem item = firstItem(order);
        return new AdminPaymentListItemResponse(
            order.getOrderCode(),
            order.getUserId(),
            order.getStatus(),
            payment == null ? PaymentStatus.PENDING : payment.getStatus(),
            payment == null ? null : payment.getProvider(),
            payment == null ? order.getTotalAmount() : payment.getAmount(),
            payment == null ? order.getCurrency() : payment.getCurrency(),
            item == null ? "Course" : item.getCourseTitle(),
            order.getCreatedAt(),
            payment == null ? null : payment.getPaidAt(),
            order.getUpdatedAt()
        );
    }

    private AdminPaymentDetailResponse toAdminDetail(CourseOrder order, Payment payment) {
        List<PaymentTransactionResponse> transactionResponses = payment == null
            ? List.of()
            : transactions
                .findByPayment_IdOrderByCreatedAtAsc(payment.getId())
                .stream()
                .map(this::toPaymentTransactionResponse)
                .toList();
        return new AdminPaymentDetailResponse(
            toOrderResponse(order, payment),
            transactionResponses,
            payment == null ? List.of() : availableTransitions(payment.getStatus())
        );
    }

    private PaymentTransactionResponse toPaymentTransactionResponse(PaymentTransaction transaction) {
        return new PaymentTransactionResponse(
            transaction.getId(),
            transaction.getEventType(),
            transaction.getStatus(),
            transaction.getProviderTransactionCode(),
            transaction.getAmount(),
            transaction.getCurrency(),
            transaction.getCreatedAt()
        );
    }

    private OrderResponse toOrderResponse(CourseOrder order, Payment payment) {
        List<OrderItemResponse> items = order
            .getItems()
            .stream()
            .sorted(Comparator.comparing(OrderItem::getId))
            .map(item ->
                new OrderItemResponse(
                    item.getCourseId(),
                    item.getCourseTitle(),
                    item.getUnitPrice(),
                    item.getDiscountAmount(),
                    item.getFinalPrice()
                )
            )
            .toList();
        return new OrderResponse(
            order.getId(),
            order.getOrderCode(),
            order.getUserId(),
            order.getStatus(),
            order.getTotalAmount(),
            order.getCurrency(),
            items,
            payment == null ? null : toPaymentSummary(payment),
            order.getExpiresAt(),
            order.getCreatedAt(),
            order.getUpdatedAt()
        );
    }

    private PaymentSummaryResponse toPaymentSummary(Payment payment) {
        return new PaymentSummaryResponse(
            payment.getId(),
            payment.getProvider(),
            payment.getStatus(),
            payment.getAmount(),
            payment.getCurrency(),
            payment.getCheckoutUrl(),
            payment.getProviderTransactionCode(),
            payment.getPaidAt(),
            payment.getCreatedAt(),
            payment.getUpdatedAt()
        );
    }

    private Payment latestPayment(CourseOrder order) {
        return payments.findFirstByOrder_IdOrderByCreatedAtDesc(order.getId()).orElse(null);
    }

    private OrderItem firstItem(CourseOrder order) {
        return order.getItems().stream().min(Comparator.comparing(OrderItem::getId)).orElse(null);
    }

    private List<PaymentStatus> availableTransitions(PaymentStatus status) {
        return switch (status) {
            case PENDING -> List.of(PaymentStatus.SUCCESS, PaymentStatus.FAILED, PaymentStatus.CANCELLED);
            case SUCCESS -> List.of(PaymentStatus.REFUNDED);
            case FAILED, CANCELLED, REFUNDED -> List.of();
        };
    }

    private OrderStatus orderStatusFor(PaymentStatus status) {
        return switch (status) {
            case SUCCESS -> OrderStatus.PAID;
            case FAILED, CANCELLED, REFUNDED -> OrderStatus.CANCELLED;
            case PENDING -> OrderStatus.PENDING_PAYMENT;
        };
    }

    private String mockTransactionCode(String orderCode, PaymentStatus status) {
        return "MOCK-" + orderCode + "-" + status.name();
    }

    private String keywordPattern(String keyword) {
        return keyword == null || keyword.isBlank()
            ? null
            : "%" + keyword.strip().toLowerCase(Locale.ROOT) + "%";
    }

    private String stripOrNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private String generateOrderCode() {
        String code;
        do {
            code =
                "LS-PAY-" +
                ORDER_DATE.format(Instant.now()) +
                "-" +
                UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        } while (orders.existsByOrderCode(code));
        return code;
    }

    private String buildCheckoutUrl(
        PaymentProvider provider,
        String returnUrl,
        String cancelUrl,
        String orderCode
    ) {
        String base = returnUrl == null || returnUrl.isBlank() ? "/payment/result" : returnUrl.strip();
        if (provider == PaymentProvider.MOCK) {
            String mockUrl = frontendPath(base, "/payment/mock");
            return appendQuery(
                appendQuery(appendQuery(mockUrl, "orderCode", orderCode), "returnUrl", base),
                "cancelUrl",
                cancelUrl == null || cancelUrl.isBlank() ? base : cancelUrl.strip()
            );
        }
        return appendQuery(base, "orderCode", orderCode);
    }

    private String appendQuery(String base, String key, String value) {
        char separator = base.contains("?") ? '&' : '?';
        return base + separator + key + "=" + URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String frontendPath(String url, String path) {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            int scheme = url.indexOf("://");
            int pathStart = url.indexOf("/", scheme + 3);
            return pathStart < 0 ? url + path : url.substring(0, pathStart) + path;
        }
        return path;
    }

    private String mockFailureCode(PaymentStatus status, String value) {
        String custom = stripOrNull(value);
        if (custom != null) return custom;
        if (status == PaymentStatus.FAILED) return "MOCK_FAILED";
        if (status == PaymentStatus.CANCELLED) return "MOCK_CANCELLED";
        return null;
    }

    private String mockFailureMessage(PaymentStatus status, String value) {
        String custom = stripOrNull(value);
        if (custom != null) return custom;
        if (status == PaymentStatus.FAILED) return "Thanh toán mô phỏng không thành công.";
        if (status == PaymentStatus.CANCELLED) return "Học viên hủy thanh toán mô phỏng.";
        return null;
    }
}
