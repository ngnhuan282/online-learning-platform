package com.elearning.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;

public record ForgotPasswordRequest(@NotBlank @Email @Size(max = 254) String email) {
    public ForgotPasswordRequest {
        email = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    @Override
    public String toString() {
        return "ForgotPasswordRequest[redacted]";
    }
}
