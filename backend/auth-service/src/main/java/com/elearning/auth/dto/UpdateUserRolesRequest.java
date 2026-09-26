package com.elearning.auth.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record UpdateUserRolesRequest(
    @NotEmpty(message = "Danh sách vai trò không được để trống")
    @jakarta.validation.constraints.Size(max = 32)
    List<@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Pattern(
        regexp = "[A-Z][A-Z0-9_]{1,63}"
    ) String> roles
) {}
