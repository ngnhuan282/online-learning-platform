package com.elearning.auth.dto;

import com.elearning.auth.entity.enums.UserStatus;
import com.elearning.auth.validation.Utf8Size;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Locale;

public record AdminCreateUserRequest(
    @NotBlank @Size(min = 2, max = 100) String fullName,
    @NotBlank @Email @Size(max = 254) String email,
    @NotBlank
    @Size(min = 8, max = 72)
    @Pattern(regexp = "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).*")
    @Utf8Size(max = 72)
    String password,
    @Size(min = 1, max = 32) List<@NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{1,63}") String> roles,
    UserStatus status
) {
    public AdminCreateUserRequest {
        fullName = fullName == null ? null : fullName.trim();
        email = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
        roles = roles == null ? List.of("USER") : roles;
        status = status == null ? UserStatus.ACTIVE : status;
    }

    @Override
    public String toString() {
        return "AdminCreateUserRequest[redacted]";
    }
}
