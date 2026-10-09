package com.elearning.payment.dto;

import com.elearning.payment.entity.enums.PaymentProvider;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CheckoutRequest(
    @NotNull Long courseId,
    PaymentProvider provider,
    @NotBlank
    @Size(min = 16, max = 64)
    @Pattern(regexp = "[A-Za-z0-9_-]+")
    String idempotencyKey,
    @Size(max = 512) String returnUrl,
    @Size(max = 512) String cancelUrl
) {}
