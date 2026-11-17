package com.elearning.payment.dto;

import com.elearning.payment.entity.enums.PaymentProvider;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public final class ProPaymentModels {

    private ProPaymentModels() {}

    public record Plan(
        String code,
        String name,
        int durationMonths,
        BigDecimal price,
        BigDecimal originalPrice,
        String currency
    ) {}

    public record CheckoutRequest(
        @NotBlank @Pattern(regexp = "PRO_[A-Z0-9_]{1,28}") String planCode,
        PaymentProvider provider,
        @NotBlank @Size(min = 16, max = 64) @Pattern(regexp = "[A-Za-z0-9_-]+") String idempotencyKey,
        @Size(max = 512) String returnUrl,
        @Size(max = 512) String cancelUrl
    ) {}
}
