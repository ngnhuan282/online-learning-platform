package com.elearning.auth.service.impl;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.common.exception.ErrorCode;
import com.elearning.auth.dto.*;
import com.elearning.auth.entity.Role;
import com.elearning.auth.entity.User;
import com.elearning.auth.entity.enums.RoleName;
import com.elearning.auth.entity.enums.UserStatus;
import com.elearning.auth.repository.RoleRepository;
import com.elearning.auth.repository.UserRepository;
import com.elearning.auth.service.UserService;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public UserServiceImpl(
        UserRepository userRepository,
        RoleRepository roleRepository,
        PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public UserResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = userRepository
            .findById(userId)
            .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        user.updateProfile(request.fullName().trim());
        return UserResponse.from(user);
    }

    @Override
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = userRepository
            .findById(userId)
            .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new AppException(ErrorCode.OLD_PASSWORD_INCORRECT);
        }

        user.updatePassword(passwordEncoder.encode(request.newPassword()));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminUserResponse> listUsers(int page, int size, String keyword, UserStatus status) {
        int safePage = Math.max(page, 0);
        int safeSize = size <= 0 ? 10 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        String cleanKeyword = (keyword != null && !keyword.trim().isEmpty()) ? keyword.trim() : null;
        Page<User> userPage = userRepository.findByFilter(cleanKeyword, status, pageable);
        return userPage.map(AdminUserResponse::from);
    }

    @Override
    @Transactional(readOnly = true)
    public AdminUserResponse getUserById(Long id) {
        User user = userRepository
            .findById(id)
            .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        return AdminUserResponse.from(user);
    }

    @Override
    public AdminUserResponse updateUserStatus(Long targetUserId, Long currentUserId, UserStatus status) {
        if (targetUserId.equals(currentUserId)) {
            throw new AppException(ErrorCode.CANNOT_LOCK_SELF);
        }

        User user = userRepository
            .findById(targetUserId)
            .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        user.updateStatus(status);
        return AdminUserResponse.from(user);
    }

    @Override
    public AdminUserResponse updateUserRoles(Long targetUserId, Long currentUserId, List<String> roleNames) {
        User user = userRepository
            .findById(targetUserId)
            .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Set<Role> roles = new HashSet<>();
        boolean hasAdmin = false;

        for (String roleStr : roleNames) {
            try {
                RoleName roleName = RoleName.valueOf(roleStr.trim().toUpperCase());
                if (roleName == RoleName.ADMIN) {
                    hasAdmin = true;
                }
                Role role = roleRepository
                    .findByName(roleName)
                    .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
                roles.add(role);
            } catch (IllegalArgumentException ex) {
                throw new AppException(ErrorCode.BAD_REQUEST);
            }
        }

        if (targetUserId.equals(currentUserId) && !hasAdmin) {
            throw new AppException(ErrorCode.CANNOT_DEMOTE_SELF);
        }

        user.setRoles(roles);
        return AdminUserResponse.from(user);
    }
}
