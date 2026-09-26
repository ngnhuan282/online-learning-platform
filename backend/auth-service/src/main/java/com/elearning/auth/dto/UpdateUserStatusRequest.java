package com.elearning.auth.dto;

import com.elearning.auth.entity.enums.UserStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateUserStatusRequest(
    @NotNull(message = "Trạng thái người dùng không được để trống")
    UserStatus status
) {}
