package com.elearning.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import java.util.Locale;

public record LoginRequest(
    @NotBlank @Email @Size(max = 254) String email,
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY) @NotBlank @Size(max = 72) String password,
    Boolean rememberMe
) {
    public LoginRequest(String email, String password) {
        this(email, password, false);
    }

    public LoginRequest {
        email = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
        rememberMe = Boolean.TRUE.equals(rememberMe);
    }

    @Override
    public String toString() {
        return "LoginRequest[redacted]";
    }
}
