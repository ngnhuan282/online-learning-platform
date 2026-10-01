package com.elearning.auth.dto;

import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Locale;

public record LoginRequest(
    @NotBlank @Email @Size(max = 254) String email,
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY) @NotBlank @Size(max = 72) String password
) {
    public LoginRequest {
        email = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    @Override
    public String toString() {
        return "LoginRequest[redacted]";
    }
}
