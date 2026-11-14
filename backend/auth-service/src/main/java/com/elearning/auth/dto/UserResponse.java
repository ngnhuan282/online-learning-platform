package com.elearning.auth.dto;

import com.elearning.auth.entity.User;
import java.util.List;
import java.time.LocalDate;

public record UserResponse(
    Long id,
    String fullName,
    String email,
    List<String> roles,
    String status,
    List<String> permissions,
    String avatarUrl,
    String phone,
    LocalDate dateOfBirth,
    String biography
) {
    public UserResponse(Long id, String fullName, String email, List<String> roles, String status, List<String> permissions) {
        this(id, fullName, email, roles, status, permissions, null, null, null, null);
    }
    public UserResponse(Long id, String fullName, String email, List<String> roles) {
        this(id, fullName, email, roles, "ACTIVE", List.of());
    }

    public static UserResponse from(User user) {
        return new UserResponse(
            user.getId(),
            user.getFullName(),
            user.getEmail(),
            user
                .getRoles()
                .stream()
                .map(role -> role.getName())
                .sorted()
                .toList(),
            user.getStatus() != null ? user.getStatus().name() : "ACTIVE",
            com.elearning.auth.security.AdminAccess.permissions(user).stream().sorted().toList(),
            user.getAvatarUrl(), user.getPhone(), user.getDateOfBirth(), user.getBiography()
        );
    }
}
