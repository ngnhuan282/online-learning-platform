package com.elearning.learning.dto;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import jakarta.validation.constraints.*;
import java.time.Instant;

public final class ProModels {

    private ProModels() {}

    public static int months(String planCode) {
        return switch (planCode) {
            case "PRO_MONTH" -> 1;
            case "PRO_QUARTER" -> 3;
            case "PRO_YEAR" -> 12;
            default -> throw new AppException(ErrorCode.BAD_REQUEST);
        };
    }

    public record Membership(
        long userId,
        boolean active,
        Instant expiresAt,
        String planCode,
        Instant serverTime
    ) {}

    public record GrantRequest(
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{8,40}") String orderCode,
        @NotNull @Positive Long userId,
        @NotBlank @Pattern(regexp = "PRO_MONTH|PRO_QUARTER|PRO_YEAR") String planCode,
        @Min(1) @Max(12) int durationMonths
    ) {}

    public record RevokeRequest(
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{8,40}") String orderCode,
        @NotNull @Positive Long userId
    ) {}

    public record RedeemRequest(@NotBlank @Size(max = 64) String code) {
        @Override
        public String toString() {
            return "RedeemRequest[code=REDACTED]";
        }
    }

    public record CreateCodeRequest(
        @NotBlank @Pattern(regexp = "PRO_MONTH|PRO_QUARTER|PRO_YEAR") String planCode,
        Instant expiresAt
    ) {}

    public record CodeInfo(
        long id,
        String maskedCode,
        String planCode,
        int durationMonths,
        Instant createdAt,
        Instant expiresAt,
        Long redeemedBy,
        Instant redeemedAt,
        String status
    ) {}

    public record IssuedCode(String code, CodeInfo info) {
        @Override
        public String toString() {
            return "IssuedCode[code=REDACTED, id=" + info.id() + "]";
        }
    }
}
