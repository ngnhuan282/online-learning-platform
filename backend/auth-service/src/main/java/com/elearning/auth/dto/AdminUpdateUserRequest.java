package com.elearning.auth.dto;

import jakarta.validation.constraints.*;
import java.util.List;

public record AdminUpdateUserRequest(
    @NotBlank @Size(min = 2, max = 100) String fullName,
    @Size(min = 1, max = 32) List<@NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{1,63}") String> roles
) {}
