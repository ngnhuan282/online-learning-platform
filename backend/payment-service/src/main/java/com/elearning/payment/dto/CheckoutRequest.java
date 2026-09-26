package com.elearning.payment.dto;

import com.elearning.payment.entity.enums.PaymentProvider;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CheckoutRequest(
    @NotNull Long courseId,
    PaymentProvider provider,
    @Size(max = 512) String returnUrl,
    @Size(max = 512) String cancelUrl
) {}
