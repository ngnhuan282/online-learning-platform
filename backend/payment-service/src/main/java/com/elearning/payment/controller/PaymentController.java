package com.elearning.payment.controller;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.common.response.ApiResponse;
import com.elearning.payment.common.response.PageResponse;
import com.elearning.payment.dto.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController {

    private final com.elearning.payment.service.PaymentAnalyticsService analytics;

    public PaymentController(com.elearning.payment.service.PaymentAnalyticsService analytics) {
        this.analytics = analytics;
    }

    @PostMapping("/checkout")
    ApiResponse<CheckoutResponse> createCheckout(@Valid @RequestBody CheckoutRequest request) {
        return unavailable();
    }

    @GetMapping("/orders/{orderCode}")
    ApiResponse<OrderResponse> getOrder(@PathVariable String orderCode) {
        return unavailable();
    }

    @GetMapping("/history")
    ApiResponse<PageResponse<PaymentHistoryItemResponse>> getHistory(
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        return unavailable();
    }

    @GetMapping("/admin/orders/{orderCode}")
    @PreAuthorize("hasRole('ADMIN')")
    ApiResponse<AdminPaymentDetailResponse> getAdminOrder(@PathVariable String orderCode) {
        return unavailable();
    }

    @GetMapping("/admin/analytics")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PAYMENT_REPORT_VIEW')")
    ApiResponse<?> getAnalytics() {
        return ApiResponse.success(analytics.overview());
    }

    private <T> ApiResponse<T> unavailable() {
        throw new AppException(ErrorCode.FEATURE_NOT_IMPLEMENTED);
    }
}
