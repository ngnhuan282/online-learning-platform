package com.elearning.auth.dto;

import com.elearning.auth.validation.Utf8Size;
import jakarta.validation.constraints.*;
import java.util.Locale;

public record RegisterRequest(
    @NotBlank @Size(max = 100) String fullName,
    @NotBlank @Email @Size(max = 254) String email,
    @NotBlank
    @Size(min = 8, max = 72)
    @Pattern(
        regexp = "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).*",
        message = "Password must include uppercase and lowercase letters and a number"
    )
    @Utf8Size(max = 72)
    String password
) {
    public RegisterRequest {
        fullName = fullName == null ? null : fullName.trim();
        email = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    @Override
    public String toString() {
        return "RegisterRequest[redacted]";
    }
}
