package com.elearning.payment.dto;

import com.elearning.payment.entity.enums.PaymentStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MockPaymentRequest(
    @NotNull PaymentStatus status,
    @Size(max = 100) String providerTransactionCode,
    @Size(max = 100) String failureCode,
    @Size(max = 500) String failureMessage
) {}
