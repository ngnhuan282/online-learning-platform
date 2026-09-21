package com.elearning.auth.dto;

import com.elearning.auth.entity.User;
import java.util.List;

public record UserResponse(Long id, String fullName, String email, List<String> roles, String status) {
    public UserResponse(Long id, String fullName, String email, List<String> roles) {
        this(id, fullName, email, roles, "ACTIVE");
    }

    public static UserResponse from(User user) {
        return new UserResponse(
            user.getId(),
            user.getFullName(),
            user.getEmail(),
            user
                .getRoles()
                .stream()
                .map(role -> role.getName().name())
                .sorted()
                .toList(),
            user.getStatus() != null ? user.getStatus().name() : "ACTIVE"
        );
    }
}
