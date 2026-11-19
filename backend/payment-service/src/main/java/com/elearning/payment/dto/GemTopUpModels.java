package com.elearning.payment.dto;

import com.elearning.payment.entity.enums.PaymentProvider;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.Map;

public final class GemTopUpModels {

    private GemTopUpModels() {}

    public record Package(String code, int gems, BigDecimal price) {}

    private static final Map<String, Package> PACKAGES = Map.of(
        "GEM_200",  new Package("GEM_200",  200,  new BigDecimal("19000")),
        "GEM_500",  new Package("GEM_500",  500,  new BigDecimal("45000")),
        "GEM_1200", new Package("GEM_1200", 1200, new BigDecimal("99000"))
    );

    public static Package getPackage(String code) {
        return PACKAGES.get(code);
    }

    public record CheckoutRequest(
        @NotBlank @Pattern(regexp = "GEM_[A-Z0-9_]{1,20}") String packageCode,
        PaymentProvider provider,
        @NotBlank @Size(min = 16, max = 64) @Pattern(regexp = "[A-Za-z0-9_-]+") String idempotencyKey,
        @Size(max = 512) String returnUrl,
        @Size(max = 512) String cancelUrl
    ) {}
}
