package com.elearning.auth.dto;

import jakarta.validation.constraints.*;
import java.util.Set;

public record SaveRoleRequest(
    @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{1,63}") String name,
    @NotBlank @Size(max = 100) String label,
    @Size(max = 500) String description,
    @NotNull @Size(max = 100) Set<@NotBlank String> permissions,
    @PositiveOrZero long version
) {}
