package com.elearning.payment.dto;

import com.elearning.payment.entity.enums.OrderStatus;
import com.elearning.payment.entity.enums.PaymentProvider;
import com.elearning.payment.entity.enums.PaymentStatus;
import java.math.BigDecimal;
import java.time.Instant;

public record PaymentHistoryItemResponse(
    String orderCode,
    PaymentStatus paymentStatus,
    BigDecimal amount,
    String currency,
    String courseTitle,
    Instant createdAt,
    Instant paidAt,
    OrderStatus orderStatus,
    Instant expiresAt,
    PaymentProvider provider
) {}
