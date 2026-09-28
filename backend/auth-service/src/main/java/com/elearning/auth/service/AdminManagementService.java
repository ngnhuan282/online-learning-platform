package com.elearning.auth.service;

import com.elearning.auth.common.exception.*;
import com.elearning.auth.dto.*;
import com.elearning.auth.entity.*;
import com.elearning.auth.entity.enums.UserStatus;
import com.elearning.auth.repository.*;
import com.elearning.auth.security.AdminPermission;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AdminManagementService {

    private final RoleRepository roles;
    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;

    public AdminManagementService(
        RoleRepository roles,
        UserRepository users,
        JdbcTemplate jdbc,
        PasswordEncoder encoder
    ) {
        this.roles = roles;
        this.users = users;
        this.jdbc = jdbc;
        this.encoder = encoder;
    }

    public record RoleResponse(
        Long id,
        String name,
        String label,
        String description,
        boolean systemRole,
        long version,
        Set<String> permissions,
        long userCount
    ) {}

    private RoleResponse response(Role role) {
        long count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_roles WHERE role_id = ?",
            Long.class,
            role.getId()
        );
        return new RoleResponse(
            role.getId(),
            role.getName(),
            role.getLabel(),
            role.getDescription(),
            role.isSystemRole(),
            role.getVersion(),
            role.getPermissions(),
            count
        );
    }

    @Transactional(readOnly = true)
    public List<RoleResponse> roles() {
        return roles
            .findAll()
            .stream()
            .sorted(Comparator.comparing(Role::getId))
            .map(this::response)
            .toList();
    }

    public RoleResponse saveRole(Long id, SaveRoleRequest request, Long actor) {
        Set<String> permissions = new HashSet<>();
        for (String code : request.permissions()) {
            AdminPermission permission;
            try {
                permission = AdminPermission.valueOf(code);
            } catch (IllegalArgumentException e) {
                throw new AppException(ErrorCode.BAD_REQUEST);
            }
            if (permission.adminOnly) throw new AppException(ErrorCode.FORBIDDEN);
            permissions.add(code);
            permissions.addAll(permission.dependencies());
        }
        Role role;
        if (id == null) {
            if (roles.findByName(request.name()).isPresent()) throw new AppException(ErrorCode.CONFLICT);
            role = new Role(request.name(), request.label().trim(), request.description(), permissions);
        } else {
            role = roles.findById(id).orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
            // USER is the configurable default for existing and newly registered accounts.
            // Keep ADMIN's authority fixed and preserve deletion protection for system roles.
            if (role.isSystemRole() && !"USER".equals(role.getName())) {
                throw new AppException(ErrorCode.FORBIDDEN);
            }
            if (!role.getName().equals(request.name())) throw new AppException(ErrorCode.BAD_REQUEST);
            if (role.getVersion() != request.version()) throw new AppException(ErrorCode.CONFLICT);
            role.update(request.label().trim(), request.description(), permissions);
        }
        roles.saveAndFlush(role);
        audit(
            actor,
            id == null ? "ROLE_CREATE" : "ROLE_UPDATE",
            role.getName(),
            "Quyền: " + String.join(", ", new TreeSet<>(permissions))
        );
        return response(role);
    }

    public void deleteRole(Long id, Long actor) {
        // The row lock also serializes role assignment with deletion.
        jdbc.queryForList("SELECT id FROM roles WHERE id = ? FOR UPDATE", id);
        Role role = roles.findById(id).orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        if (role.isSystemRole()) throw new AppException(ErrorCode.FORBIDDEN);
        if (response(role).userCount() > 0) throw new AppException(ErrorCode.CONFLICT);
        audit(actor, "ROLE_DELETE", role.getName(), "Xóa vai trò chưa được sử dụng");
        roles.delete(role);
        roles.flush();
    }

    public AdminUserResponse createUser(
        AdminCreateUserRequest request,
        Long actor,
        boolean assignRoles,
        boolean setStatus
    ) {
        if (users.existsByEmailIgnoreCase(request.email())) throw new AppException(
            ErrorCode.EMAIL_ALREADY_EXISTS
        );
        if (
            (!request.roles().equals(List.of("USER")) && !assignRoles) ||
            (request.status() != UserStatus.ACTIVE && !setStatus)
        ) throw new AppException(ErrorCode.FORBIDDEN);
        Set<Role> assigned = resolveRoles(request.roles());
        User user = new User(
            request.email(),
            encoder.encode(request.password()),
            request.fullName(),
            assigned.iterator().next()
        );
        user.setRoles(assigned);
        user.updateStatus(request.status());
        try {
            user = users.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            if (
                ex.getCause() instanceof ConstraintViolationException constraint &&
                constraint.getConstraintName() != null &&
                constraint.getConstraintName().toLowerCase(Locale.ROOT).contains("uk_users_email")
            ) {
                throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
            }
            throw ex;
        }
        audit(actor, "USER_CREATE", user.getId().toString(), "Tạo tài khoản học viên");
        return AdminUserResponse.from(user);
    }

    public Set<Role> resolveRoles(List<String> names) {
        Set<Role> result = new HashSet<>();
        for (String name : names)
            result.add(roles.findByName(name).orElseThrow(() -> new AppException(ErrorCode.BAD_REQUEST)));
        return result;
    }

    public AdminUserResponse updateUser(
        Long id,
        AdminUpdateUserRequest request,
        Long actor,
        boolean assignRoles
    ) {
        jdbc.queryForList("SELECT id FROM roles ORDER BY id FOR UPDATE");
        User user = users.findById(id).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (user.getDeletedAt() != null) throw new AppException(ErrorCode.USER_NOT_FOUND);
        protectAdmin(user, actor);
        Set<Role> next = request.roles() == null ? user.getRoles() : resolveRoles(request.roles());
        Set<String> currentNames = new HashSet<>();
        for (Role role : user.getRoles()) currentNames.add(role.getName());
        Set<String> nextNames = new HashSet<>();
        for (Role role : next) nextNames.add(role.getName());
        if (!currentNames.equals(nextNames)) {
            if (!assignRoles) throw new AppException(ErrorCode.FORBIDDEN);
            if (id.equals(actor) && !nextNames.contains("ADMIN")) throw new AppException(
                ErrorCode.CANNOT_DEMOTE_SELF
            );
            guardLastAdmin(user, !nextNames.contains("ADMIN"));
            user.setRoles(next);
        }
        user.updateProfile(request.fullName().trim());
        audit(actor, "USER_UPDATE", id.toString(), "Cập nhật thông tin và vai trò");
        return AdminUserResponse.from(user);
    }

    public void deleteUser(Long id, Long actor) {
        jdbc.queryForList("SELECT id FROM roles ORDER BY id FOR UPDATE");
        if (id.equals(actor)) throw new AppException(ErrorCode.CANNOT_LOCK_SELF);
        User user = users.findById(id).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (user.getDeletedAt() != null) throw new AppException(ErrorCode.USER_NOT_FOUND);
        protectAdmin(user, actor);
        guardLastAdmin(user, true);
        String previousRoles = String.join(
            ", ",
            user.getRoles().stream().map(Role::getName).sorted().toList()
        );
        user.softDelete();
        jdbc.update(
            "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP(6) WHERE user_id = ? AND revoked_at IS NULL",
            id
        );
        audit(actor, "USER_DELETE", id.toString(), "Xóa mềm tài khoản; vai trò: " + previousRoles);
    }

    private void guardLastAdmin(User target, boolean removing) {
        if (
            !removing ||
            target.getStatus() != UserStatus.ACTIVE ||
            target
                .getRoles()
                .stream()
                .noneMatch(r -> "ADMIN".equals(r.getName()))
        ) return;
        Long count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE r.name = 'ADMIN' AND u.status = 'ACTIVE' AND u.deleted_at IS NULL",
            Long.class
        );
        if (count == null || count <= 1) throw new AppException(ErrorCode.CONFLICT);
    }

    public void protectAdmin(User target, Long actor) {
        if (
            target
                .getRoles()
                .stream()
                .anyMatch(r -> r.getName().equals("ADMIN")) &&
            users
                .findById(actor)
                .orElseThrow()
                .getRoles()
                .stream()
                .noneMatch(r -> r.getName().equals("ADMIN"))
        ) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
    }

    public void audit(Long actor, String action, String target, String description) {
        jdbc.update(
            "INSERT INTO admin_audit_logs(actor_id, action, target, description) VALUES (?, ?, ?, ?)",
            actor,
            action,
            target,
            description.substring(0, Math.min(500, description.length()))
        );
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> audit() {
        return jdbc.queryForList(
            "SELECT a.id, a.actor_id AS actorId, u.full_name AS actorName, a.action, a.target, a.description, a.created_at AS createdAt FROM admin_audit_logs a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 50"
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> overview() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put(
            "total",
            jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL", Long.class)
        );
        for (String status : List.of("ACTIVE", "LOCKED", "DISABLED")) {
            result.put(
                status.toLowerCase(Locale.ROOT),
                jdbc.queryForObject(
                    "SELECT COUNT(*) FROM users WHERE status = ? AND deleted_at IS NULL",
                    Long.class,
                    status
                )
            );
        }
        result.put(
            "newThisWeek",
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE created_at >= ? AND deleted_at IS NULL",
                Long.class,
                Timestamp.from(Instant.now().minus(Duration.ofDays(7)))
            )
        );
        List<Map<String, Object>> monthly = new ArrayList<>();
        YearMonth current = YearMonth.now(ZoneOffset.UTC);
        for (int i = 5; i >= 0; i--) {
            YearMonth month = current.minusMonths(i);
            long count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE created_at >= ? AND created_at < ? AND deleted_at IS NULL",
                Long.class,
                Timestamp.valueOf(month.atDay(1).atStartOfDay()),
                Timestamp.valueOf(month.plusMonths(1).atDay(1).atStartOfDay())
            );
            monthly.add(Map.of("month", month.toString(), "count", count));
        }
        result.put("monthly", monthly);
        return result;
    }
}
