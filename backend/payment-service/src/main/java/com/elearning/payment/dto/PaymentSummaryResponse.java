package com.elearning.payment.dto;

import com.elearning.payment.entity.enums.PaymentProvider;
import com.elearning.payment.entity.enums.PaymentStatus;
import java.math.BigDecimal;
import java.time.Instant;

public record PaymentSummaryResponse(
    Long id,
    PaymentProvider provider,
    PaymentStatus status,
    BigDecimal amount,
    String currency,
    String checkoutUrl,
    String providerTransactionCode,
    Instant paidAt,
    Instant createdAt,
    Instant updatedAt,
    boolean enrollmentReady
) {}
