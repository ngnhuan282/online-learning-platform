package com.elearning.payment.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record PaymentAnalyticsResponse(
    long totalOrders,
    long pendingPayments,
    long successfulPayments,
    BigDecimal grossRevenue,
    BigDecimal refundedAmount,
    Instant generatedAt
) {}
