package com.elearning.auth.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record UpdateUserRolesRequest(
    @NotEmpty(message = "Danh sách vai trò không được để trống")
    List<String> roles
) {}
