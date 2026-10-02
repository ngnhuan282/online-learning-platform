package com.elearning.payment.dto;

import com.elearning.payment.entity.enums.OrderStatus;
import com.elearning.payment.entity.enums.PaymentProvider;
import com.elearning.payment.entity.enums.PaymentStatus;
import java.math.BigDecimal;
import java.time.Instant;

public record AdminPaymentListItemResponse(
    String orderCode,
    Long userId,
    OrderStatus orderStatus,
    PaymentStatus paymentStatus,
    PaymentProvider provider,
    BigDecimal amount,
    String currency,
    String courseTitle,
    Instant createdAt,
    Instant paidAt,
    Instant updatedAt
) {}
