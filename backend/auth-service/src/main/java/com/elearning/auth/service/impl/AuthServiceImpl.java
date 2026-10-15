package com.elearning.auth.service.impl;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.common.exception.ErrorCode;
import com.elearning.auth.dto.*;
import com.elearning.auth.entity.User;
import com.elearning.auth.entity.enums.RoleName;
import com.elearning.auth.entity.enums.UserStatus;
import com.elearning.auth.repository.*;
import com.elearning.auth.security.JwtTokenProvider;
import com.elearning.auth.service.AuthService;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AuthServiceImpl implements AuthService {

    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder passwords;
    private final JwtTokenProvider tokens;
    private final String missingUserHash;

    public AuthServiceImpl(
        UserRepository users,
        RoleRepository roles,
        PasswordEncoder passwords,
        JwtTokenProvider tokens
    ) {
        this.users = users;
        this.roles = roles;
        this.passwords = passwords;
        this.tokens = tokens;
        missingUserHash = passwords.encode(UUID.randomUUID().toString());
    }

    @Override
    @Transactional
    public UserResponse register(RegisterRequest request) {
        if (users.existsByEmailIgnoreCase(request.email())) throw new AppException(
            ErrorCode.EMAIL_ALREADY_EXISTS
        );
        var role = roles
            .findByName(RoleName.USER)
            .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        var user = new User(request.email(), passwords.encode(request.password()), request.fullName(), role);
        try {
            return UserResponse.from(users.saveAndFlush(user));
        } catch (DataIntegrityViolationException ex) {
            // The pre-check cannot prevent concurrent registrations. Only map the email constraint.
            if (
                ex.getCause() instanceof ConstraintViolationException constraint &&
                constraint.getConstraintName() != null &&
                constraint.getConstraintName().toLowerCase(Locale.ROOT).contains("uk_users_email")
            ) {
                throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
            }
            throw ex;
        }
    }

    @Override
    @Transactional
    public AuthResponse login(LoginRequest request) {
        var user = users.findByEmailIgnoreCase(request.email()).orElse(null);
        boolean matches =
            request.password().getBytes(StandardCharsets.UTF_8).length <= 72 &&
            passwords.matches(
                request.password(),
                user == null || user.getPasswordHash() == null ? missingUserHash : user.getPasswordHash()
            );
        if (user != null && user.getPasswordHash() == null) throw new AppException(
            ErrorCode.GOOGLE_LOGIN_REQUIRED
        );
        // Wrong credentials always have the same error, including inactive accounts.
        if (user == null || !matches) throw new AppException(ErrorCode.INVALID_CREDENTIALS);
        return authenticate(user);
    }

    @Override
    @Transactional
    public AuthResponse loginUser(Long userId) {
        return authenticate(
            users.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND))
        );
    }

    private AuthResponse authenticate(User user) {
        checkStatus(user);
        user.recordLogin();
        var response = UserResponse.from(user);
        if (response.roles().isEmpty()) throw new AppException(ErrorCode.ROLE_NOT_FOUND);
        return new AuthResponse(
            tokens.createAccessToken(user.getId().toString(), response.roles(), response.permissions()),
            "Bearer",
            tokens.getAccessTokenSeconds(),
            response
        );
    }

    @Override
    public UserResponse getCurrentUser(String subject) {
        long id;
        try {
            id = Long.parseLong(subject);
        } catch (NumberFormatException ex) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
        var user = users.findById(id).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        checkStatus(user);
        return UserResponse.from(user);
    }

    private void checkStatus(User user) {
        if (user.getStatus() == UserStatus.DISABLED || user.getDeletedAt() != null) throw new AppException(
            ErrorCode.ACCOUNT_DISABLED
        );
        if (user.getStatus() == UserStatus.LOCKED) throw new AppException(ErrorCode.ACCOUNT_LOCKED);
    }
}
