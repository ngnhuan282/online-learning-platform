package com.elearning.payment.dto;

import com.elearning.payment.entity.enums.OrderStatus;
import com.elearning.payment.entity.enums.PaymentProvider;
import com.elearning.payment.entity.enums.PaymentStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record PaymentAnalyticsResponse(
    long totalOrders,
    long pendingPayments,
    long successfulPayments,
    long failedPayments,
    BigDecimal grossRevenue,
    BigDecimal pendingAmount,
    BigDecimal refundedAmount,
    CrossServiceStats crossService,
    List<RevenuePoint> revenueSeries,
    List<RecentTransaction> recentTransactions,
    Instant generatedAt
) {
    public PaymentAnalyticsResponse {
        revenueSeries = List.copyOf(revenueSeries);
        recentTransactions = List.copyOf(recentTransactions);
    }

    public record CrossServiceStats(long activeLearners, long paidCourses, long enrollmentReady) {}

    public record RevenuePoint(String label, BigDecimal amount, long orders) {}

    public record RecentTransaction(
        String orderCode,
        Long userId,
        String courseTitle,
        BigDecimal amount,
        String currency,
        PaymentStatus status,
        Instant createdAt,
        OrderStatus orderStatus,
        Instant expiresAt,
        PaymentProvider provider
    ) {}
}
