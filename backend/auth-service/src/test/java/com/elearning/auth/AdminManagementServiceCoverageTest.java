package com.elearning.auth;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.dto.AdminCreateUserRequest;
import com.elearning.auth.dto.AdminUpdateUserRequest;
import com.elearning.auth.entity.Role;
import com.elearning.auth.entity.User;
import com.elearning.auth.entity.enums.UserStatus;
import com.elearning.auth.repository.RoleRepository;
import com.elearning.auth.repository.UserRepository;
import com.elearning.auth.service.AdminManagementService;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Small isolated tests for error and permission branches in AdminManagementService.
 * These complement (rather than replace) the existing HTTP integration tests.
 */
class AdminManagementServiceCoverageTest {

    private RoleRepository roles;
    private UserRepository users;
    private JdbcTemplate jdbc;
    private PasswordEncoder encoder;
    private AdminManagementService service;

    @BeforeEach
    void setUp() {
        roles = mock(RoleRepository.class);
        users = mock(UserRepository.class);
        jdbc = mock(JdbcTemplate.class);
        encoder = mock(PasswordEncoder.class);
        service = new AdminManagementService(roles, users, jdbc, encoder);
    }

    private AdminCreateUserRequest validCreateRequest() {
        AdminCreateUserRequest request = mock(AdminCreateUserRequest.class);
        when(request.email()).thenReturn("learner@example.com");
        when(request.password()).thenReturn("Password123!");
        when(request.fullName()).thenReturn("Test Learner");
        when(request.roles()).thenReturn(List.of("USER"));
        when(request.status()).thenReturn(UserStatus.ACTIVE);

        Role userRole = mock(Role.class);
        when(roles.findByName("USER")).thenReturn(Optional.of(userRole));
        when(encoder.encode("Password123!")).thenReturn("encoded-password");
        return request;
    }

    @Test
    void createUserMapsDatabaseUniqueEmailViolationToAppException() {
        AdminCreateUserRequest request = validCreateRequest();
        ConstraintViolationException cause = mock(ConstraintViolationException.class);
        when(cause.getConstraintName()).thenReturn("UK_USERS_EMAIL");
        DataIntegrityViolationException dbError =
            new DataIntegrityViolationException("duplicate email", cause);
        when(users.saveAndFlush(any(User.class))).thenThrow(dbError);

        assertThatThrownBy(() -> service.createUser(request, 10L, false, false))
            .isInstanceOf(AppException.class);
        verify(users).saveAndFlush(any(User.class));
    }

    @Test
    void createUserDoesNotHideUnrelatedDatabaseViolation() {
        AdminCreateUserRequest request = validCreateRequest();
        ConstraintViolationException cause = mock(ConstraintViolationException.class);
        when(cause.getConstraintName()).thenReturn("fk_user_roles_role_id");
        DataIntegrityViolationException dbError =
            new DataIntegrityViolationException("foreign key error", cause);
        when(users.saveAndFlush(any(User.class))).thenThrow(dbError);

        assertThatThrownBy(() -> service.createUser(request, 10L, false, false))
            .isSameAs(dbError);
        verify(users).saveAndFlush(any(User.class));
    }

    @Test
    void createUserWithoutStatusPermissionRejectsLockedAccount() {
        AdminCreateUserRequest request = validCreateRequest();
        when(request.status()).thenReturn(UserStatus.LOCKED);

        assertThatThrownBy(() -> service.createUser(request, 10L, false, false))
            .isInstanceOf(AppException.class);
        verify(users, never()).saveAndFlush(any(User.class));
    }

    @Test
    void missingRolesAndUsersAreRejectedBeforeModification() {
        when(roles.findByName("MISSING")).thenReturn(Optional.empty());
        when(roles.findById(999L)).thenReturn(Optional.empty());
        when(users.findById(999L)).thenReturn(Optional.empty());
        when(users.findForUpdate(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resolveRoles(List.of("MISSING")))
            .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> service.deleteRole(999L, 10L))
            .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> service.updateUser(
            999L, mock(AdminUpdateUserRequest.class), 10L, true))
            .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> service.deleteUser(999L, 10L))
            .isInstanceOf(AppException.class);
    }

    @Test
    void lastActiveAdministratorCannotBeDeleted() {
        Role adminRole = mock(Role.class);
        when(adminRole.getName()).thenReturn("ADMIN");

        User target = mock(User.class);
        when(target.getRoles()).thenReturn(Set.of(adminRole));
        when(target.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(users.findForUpdate(15L)).thenReturn(Optional.of(target));

        User actor = mock(User.class);
        when(actor.getRoles()).thenReturn(Set.of(adminRole));
        when(users.findById(20L)).thenReturn(Optional.of(actor));

        when(jdbc.queryForObject(anyString(), eq(Long.class))).thenReturn(1L);

        assertThatThrownBy(() -> service.deleteUser(15L, 20L))
            .isInstanceOf(AppException.class);
        verify(target, never()).softDelete();
    }
}
