package com.elearning.auth.service.impl;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.common.exception.ErrorCode;
import com.elearning.auth.dto.*;
import com.elearning.auth.entity.Role;
import com.elearning.auth.entity.User;
import com.elearning.auth.entity.enums.UserStatus;
import com.elearning.auth.repository.RoleRepository;
import com.elearning.auth.repository.UserRepository;
import com.elearning.auth.service.AdminManagementService;
import com.elearning.auth.service.UserService;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AdminManagementService admin;
    private final JdbcTemplate jdbc;

    public UserServiceImpl(
        UserRepository userRepository,
        RoleRepository roleRepository,
        PasswordEncoder passwordEncoder,
        AdminManagementService admin,
        JdbcTemplate jdbc
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.admin = admin;
        this.jdbc = jdbc;
    }

    @Override
    public UserResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = userRepository
            .findById(userId)
            .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        requireActive(user);
        user.updateProfile(request.fullName().trim());
        return UserResponse.from(user);
    }

    @Override
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = userRepository
            .findById(userId)
            .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        requireActive(user);

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new AppException(ErrorCode.OLD_PASSWORD_INCORRECT);
        }

        user.updatePassword(passwordEncoder.encode(request.newPassword()));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminUserResponse> listUsers(
        int page,
        int size,
        String keyword,
        UserStatus status,
        String role
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = size <= 0 ? 10 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(
            safePage,
            safeSize,
            Sort.by(Sort.Direction.DESC, "createdAt", "id")
        );

        String cleanKeyword = keyword != null && !keyword.trim().isEmpty() ? keyword.trim() : null;
        Page<User> userPage = userRepository.findByFilter(cleanKeyword, status, role, pageable);
        return userPage.map(AdminUserResponse::from);
    }

    @Override
    @Transactional(readOnly = true)
    public AdminUserResponse getUserById(Long id) {
        User user = userRepository.findById(id).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (user.getDeletedAt() != null) throw new AppException(ErrorCode.USER_NOT_FOUND);
        return AdminUserResponse.from(user);
    }

    @Override
    public AdminUserResponse updateUserStatus(Long targetUserId, Long currentUserId, UserStatus status) {
        jdbc.queryForList("SELECT id FROM roles ORDER BY id FOR UPDATE");
        if (targetUserId.equals(currentUserId)) {
            throw new AppException(ErrorCode.CANNOT_LOCK_SELF);
        }

        User user = userRepository
            .findById(targetUserId)
            .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (user.getDeletedAt() != null) throw new AppException(ErrorCode.USER_NOT_FOUND);

        admin.protectAdmin(user, currentUserId);
        guardLastAdmin(user, status != UserStatus.ACTIVE);
        user.updateStatus(status);
        if (status != UserStatus.ACTIVE) jdbc.update(
            "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP(6) WHERE user_id = ? AND revoked_at IS NULL",
            targetUserId
        );
        admin.audit(currentUserId, "USER_STATUS_UPDATE", targetUserId.toString(), status.name());
        return AdminUserResponse.from(user);
    }

    @Override
    public AdminUserResponse updateUserRoles(Long targetUserId, Long currentUserId, List<String> roleNames) {
        jdbc.queryForList("SELECT id FROM roles ORDER BY id FOR UPDATE");
        User user = userRepository
            .findById(targetUserId)
            .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (user.getDeletedAt() != null) throw new AppException(ErrorCode.USER_NOT_FOUND);
        admin.protectAdmin(user, currentUserId);

        Set<Role> roles = new HashSet<>();
        boolean hasAdmin = false;

        for (String roleStr : roleNames) {
            String roleName = roleStr.trim().toUpperCase(java.util.Locale.ROOT);
            if (roleName.equals("ADMIN")) hasAdmin = true;
            roles.add(
                roleRepository.findByName(roleName).orElseThrow(() -> new AppException(ErrorCode.BAD_REQUEST))
            );
        }

        if (targetUserId.equals(currentUserId) && !hasAdmin) {
            throw new AppException(ErrorCode.CANNOT_DEMOTE_SELF);
        }

        guardLastAdmin(user, !hasAdmin);
        user.setRoles(roles);
        admin.audit(
            currentUserId,
            "USER_ROLES_ASSIGN",
            targetUserId.toString(),
            String.join(", ", roleNames)
        );
        return AdminUserResponse.from(user);
    }

    private void guardLastAdmin(User target, boolean removing) {
        if (
            !removing ||
            target.getStatus() != UserStatus.ACTIVE ||
            target
                .getRoles()
                .stream()
                .noneMatch(r -> r.getName().equals("ADMIN"))
        ) return;
        Long count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE r.name = 'ADMIN' AND u.status = 'ACTIVE' AND u.deleted_at IS NULL",
            Long.class
        );
        if (count == null || count <= 1) throw new AppException(ErrorCode.CONFLICT);
    }

    private void requireActive(User user) {
        if (user.getStatus() == UserStatus.LOCKED) throw new AppException(ErrorCode.ACCOUNT_LOCKED);
        if (user.getStatus() != UserStatus.ACTIVE) throw new AppException(ErrorCode.ACCOUNT_DISABLED);
    }
}
