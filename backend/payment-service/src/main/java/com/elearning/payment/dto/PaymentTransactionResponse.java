package com.elearning.payment.dto;

import com.elearning.payment.entity.enums.PaymentEventType;
import com.elearning.payment.entity.enums.PaymentStatus;
import java.math.BigDecimal;
import java.time.Instant;

public record PaymentTransactionResponse(
    Long id,
    PaymentEventType eventType,
    PaymentStatus status,
    String providerTransactionCode,
    BigDecimal amount,
    String currency,
    Instant createdAt
) {}
