package com.elearning.auth.service;

import com.elearning.auth.dto.*;
import com.elearning.auth.entity.enums.UserStatus;
import org.springframework.data.domain.Page;

public interface UserService {
    UserResponse updateProfile(Long userId, UpdateProfileRequest request);
    void changePassword(Long userId, ChangePasswordRequest request);
    Page<AdminUserResponse> listUsers(int page, int size, String keyword, UserStatus status);
    AdminUserResponse getUserById(Long id);
    AdminUserResponse updateUserStatus(Long targetUserId, Long currentUserId, UserStatus status);
    AdminUserResponse updateUserRoles(Long targetUserId, Long currentUserId, java.util.List<String> roles);
}
