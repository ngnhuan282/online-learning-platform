package com.elearning.auth.service;

import com.elearning.auth.common.exception.*;
import com.elearning.auth.dto.*;
import com.elearning.auth.entity.*;
import com.elearning.auth.repository.*;
import com.elearning.auth.security.AdminPermission;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
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

    public AdminUserResponse createUser(RegisterRequest request, Long actor) {
        if (users.existsByEmailIgnoreCase(request.email())) throw new AppException(
            ErrorCode.EMAIL_ALREADY_EXISTS
        );
        Role role = roles.findByName("USER").orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        User user = users.saveAndFlush(
            new User(request.email(), encoder.encode(request.password()), request.fullName(), role)
        );
        audit(actor, "USER_CREATE", user.getId().toString(), "Tạo tài khoản học viên");
        return AdminUserResponse.from(user);
    }

    public AdminUserResponse updateUser(Long id, UpdateProfileRequest request, Long actor) {
        User user = users.findById(id).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        protectAdmin(user, actor);
        user.updateProfile(request.fullName().trim());
        audit(actor, "USER_UPDATE", id.toString(), "Cập nhật họ tên");
        return AdminUserResponse.from(user);
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
        result.put("total", jdbc.queryForObject("SELECT COUNT(*) FROM users", Long.class));
        for (String status : List.of("ACTIVE", "LOCKED", "DISABLED")) {
            result.put(
                status.toLowerCase(Locale.ROOT),
                jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE status = ?", Long.class, status)
            );
        }
        result.put(
            "newThisWeek",
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE created_at >= ?",
                Long.class,
                Timestamp.from(Instant.now().minus(Duration.ofDays(7)))
            )
        );
        List<Map<String, Object>> monthly = new ArrayList<>();
        YearMonth current = YearMonth.now(ZoneOffset.UTC);
        for (int i = 5; i >= 0; i--) {
            YearMonth month = current.minusMonths(i);
            long count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE created_at >= ? AND created_at < ?",
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
