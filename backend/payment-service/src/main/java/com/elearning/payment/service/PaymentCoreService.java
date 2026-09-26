package com.elearning.payment.service;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.common.response.PageResponse;
import com.elearning.payment.course.CourseSnapshot;
import com.elearning.payment.course.CourseSnapshotProvider;
import com.elearning.payment.dto.*;
import com.elearning.payment.entity.CourseOrder;
import com.elearning.payment.entity.OrderItem;
import com.elearning.payment.entity.Payment;
import com.elearning.payment.entity.PaymentTransaction;
import com.elearning.payment.entity.enums.PaymentEventType;
import com.elearning.payment.entity.enums.PaymentProvider;
import com.elearning.payment.entity.enums.PaymentStatus;
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

    public PaymentCoreService(
        CourseOrderRepository orders,
        PaymentRepository payments,
        PaymentTransactionRepository transactions,
        CourseSnapshotProvider courses
    ) {
        this.orders = orders;
        this.payments = payments;
        this.transactions = transactions;
        this.courses = courses;
    }

    @Transactional
    public CheckoutResponse createCheckout(CheckoutRequest request, Long userId) {
        CourseSnapshot course = courses
            .findById(request.courseId())
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        PaymentProvider provider = request.provider() == null ? PaymentProvider.MOCK : request.provider();
        CourseOrder order = new CourseOrder(
            generateOrderCode(),
            userId,
            course.price(),
            course.currency(),
            Instant.now().plusSeconds(15 * 60)
        );
        order.addItem(
            new OrderItem(course.id(), course.title(), course.price(), BigDecimal.ZERO, course.price())
        );
        orders.saveAndFlush(order);

        Payment payment = new Payment(order, provider, course.price(), course.currency());
        payment.assignCheckoutUrl(buildCheckoutUrl(request.returnUrl(), order.getOrderCode()));
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
        String keywordPattern =
            keyword == null || keyword.isBlank()
                ? null
                : "%" + keyword.strip().toLowerCase(Locale.ROOT) + "%";
        return PageResponse.from(
            orders.searchUserHistory(userId, status, keywordPattern, pageable).map(this::toHistoryItem)
        );
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

    private String buildCheckoutUrl(String returnUrl, String orderCode) {
        String base = returnUrl == null || returnUrl.isBlank() ? "/payment/result" : returnUrl.strip();
        char separator = base.contains("?") ? '&' : '?';
        return base + separator + "orderCode=" + URLEncoder.encode(orderCode, StandardCharsets.UTF_8);
    }
}
