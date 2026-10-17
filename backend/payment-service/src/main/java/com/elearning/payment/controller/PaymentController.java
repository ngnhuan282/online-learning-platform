package com.elearning.payment.controller;

import com.elearning.payment.common.response.ApiResponse;
import com.elearning.payment.common.response.PageResponse;
import com.elearning.payment.dto.*;
import com.elearning.payment.entity.enums.PaymentProvider;
import com.elearning.payment.entity.enums.PaymentStatus;
import com.elearning.payment.learning.PaidCourseActivationService;
import com.elearning.payment.security.AuthenticatedUser;
import com.elearning.payment.service.PaymentAnalyticsService;
import com.elearning.payment.service.PaymentCoreService;
import com.elearning.payment.vnpay.VnpayGateway;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController {

    private final PaymentCoreService payments;
    private final PaymentAnalyticsService analytics;
    private final AuthenticatedUser user;
    private final VnpayGateway vnpay;
    private final PaidCourseActivationService activation;

    public PaymentController(
        PaymentCoreService payments,
        PaymentAnalyticsService analytics,
        AuthenticatedUser user,
        VnpayGateway vnpay,
        PaidCourseActivationService activation
    ) {
        this.payments = payments;
        this.analytics = analytics;
        this.user = user;
        this.vnpay = vnpay;
        this.activation = activation;
    }

    @PostMapping("/checkout")
    ApiResponse<CheckoutResponse> createCheckout(
        @Valid @RequestBody CheckoutRequest request,
        HttpServletRequest httpRequest
    ) {
        String clientIp = httpRequest.getHeader("X-Payment-Client-IP");
        if (clientIp == null || !clientIp.matches("[0-9a-fA-F:.]{3,45}")) clientIp =
            httpRequest.getRemoteAddr();
        return ApiResponse.success(payments.createCheckout(request, user.userId(), clientIp));
    }

    @GetMapping("/methods")
    ApiResponse<List<PaymentMethodResponse>> getPaymentMethods() {
        return ApiResponse.success(
            List.of(
                new PaymentMethodResponse(
                    PaymentProvider.MOCK,
                    "Thanh toán mô phỏng",
                    true,
                    "Không phát sinh thanh toán thật"
                ),
                new PaymentMethodResponse(
                    PaymentProvider.VNPAY,
                    "VNPay",
                    vnpay.isAvailable(),
                    vnpay.isAvailable() ? "Thanh toán qua VNPay" : "Chưa khả dụng"
                )
            )
        );
    }

    @GetMapping("/orders/{orderCode}")
    ApiResponse<OrderResponse> getOrder(@PathVariable String orderCode) {
        return ApiResponse.success(payments.getOrder(orderCode, user.userId(), user.hasRole("ADMIN")));
    }

    @PostMapping("/orders/{orderCode}/activation")
    ApiResponse<OrderResponse> retryActivation(@PathVariable String orderCode) {
        activation.activate(orderCode, user.userId());
        return ApiResponse.success(payments.getOrder(orderCode, user.userId(), false));
    }

    @PostMapping("/mock/orders/{orderCode}/complete")
    ApiResponse<OrderResponse> completeMockPayment(
        @PathVariable String orderCode,
        @Valid @RequestBody MockPaymentRequest request
    ) {
        return ApiResponse.success(payments.completeMockPayment(orderCode, user.userId(), request));
    }

    @GetMapping("/history")
    ApiResponse<PageResponse<PaymentHistoryItemResponse>> getHistory(
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
        @RequestParam(required = false) PaymentStatus status,
        @RequestParam(required = false) String keyword,
        @RequestParam(defaultValue = "false") boolean expired
    ) {
        return ApiResponse.success(
            payments.getHistory(
                user.userId(),
                status,
                keyword,
                expired,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
            )
        );
    }

    @GetMapping("/admin/orders/{orderCode}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PAYMENT_REPORT_VIEW')")
    ApiResponse<AdminPaymentDetailResponse> getAdminOrder(@PathVariable String orderCode) {
        return ApiResponse.success(payments.getAdminOrder(orderCode));
    }

    @GetMapping("/admin/orders")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PAYMENT_REPORT_VIEW')")
    ApiResponse<PageResponse<AdminPaymentListItemResponse>> getAdminOrders(
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
        @RequestParam(required = false) PaymentStatus status,
        @RequestParam(required = false) String keyword,
        @RequestParam(defaultValue = "false") boolean expired
    ) {
        return ApiResponse.success(
            payments.getAdminOrders(
                status,
                keyword,
                expired,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
            )
        );
    }

    @PatchMapping("/admin/orders/{orderCode}/status")
    @PreAuthorize("hasRole('ADMIN')")
    ApiResponse<AdminPaymentDetailResponse> updateAdminOrderStatus(
        @PathVariable String orderCode,
        @Valid @RequestBody AdminPaymentStatusUpdateRequest request
    ) {
        return ApiResponse.success(payments.updateAdminPaymentStatus(orderCode, request));
    }

    @GetMapping("/admin/analytics")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PAYMENT_REPORT_VIEW')")
    ApiResponse<PaymentAnalyticsResponse> getAnalytics() {
        return ApiResponse.success(analytics.getAnalytics());
    }
}
