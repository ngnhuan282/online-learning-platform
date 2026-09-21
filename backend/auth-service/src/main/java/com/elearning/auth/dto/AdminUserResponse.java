package com.elearning.auth.dto;

import com.elearning.auth.entity.User;
import java.time.Instant;
import java.util.List;

public record AdminUserResponse(
    Long id,
    String fullName,
    String email,
    String status,
    List<String> roles,
    Instant createdAt,
    Instant updatedAt
) {
    public static AdminUserResponse from(User user) {
        return new AdminUserResponse(
            user.getId(),
            user.getFullName(),
            user.getEmail(),
            user.getStatus() != null ? user.getStatus().name() : "ACTIVE",
            user
                .getRoles()
                .stream()
                .map(role -> role.getName().name())
                .sorted()
                .toList(),
            user.getCreatedAt(),
            user.getUpdatedAt()
        );
    }
}
