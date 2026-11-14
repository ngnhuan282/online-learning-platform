package com.elearning.auth.config;

import com.elearning.auth.entity.User;
import com.elearning.auth.entity.enums.RoleName;
import com.elearning.auth.repository.RoleRepository;
import com.elearning.auth.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@ConditionalOnProperty(name = "app.bootstrap-admin.enabled", havingValue = "true")
public class BootstrapAdmin implements ApplicationRunner {

    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder encoder;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final String email;
    private final String password;

    public BootstrapAdmin(
        UserRepository users,
        RoleRepository roles,
        PasswordEncoder encoder,
        JdbcTemplate jdbc,
        TransactionTemplate transaction,
        @Value("${app.bootstrap-admin.email:}") String email,
        @Value("${app.bootstrap-admin.password:}") String password
    ) {
        this.users = users;
        this.roles = roles;
        this.encoder = encoder;
        this.jdbc = jdbc;
        this.transaction = transaction;
        this.email = email.strip().toLowerCase(Locale.ROOT);
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        if (
            !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+") ||
            email.length() > 254 ||
            password.length() < 12 ||
            password.getBytes(StandardCharsets.UTF_8).length > 72 ||
            !password.matches("(?s)(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).+")
        ) {
            throw new IllegalStateException(
                "Bootstrap admin requires a valid email and a strong password of 12+ characters (maximum 72 UTF-8 bytes)"
            );
        }
        transaction.executeWithoutResult(status -> {
            jdbc.queryForList("SELECT id FROM roles ORDER BY id FOR UPDATE");
            Long admins = jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'ADMIN'",
                Long.class
            );
            if (admins != null && admins > 0) return;
            // Never promote an existing email or reset its password silently.
            if (users.findByEmailIgnoreCase(email).isPresent()) throw new IllegalStateException(
                "Bootstrap email already belongs to an account; use an unused address"
            );
            var user = new User(
                email,
                encoder.encode(password),
                "Quản trị viên",
                roles.findByName(RoleName.USER).orElseThrow()
            );
            user.getRoles().add(roles.findByName(RoleName.ADMIN).orElseThrow());
            users.saveAndFlush(user);
        });
    }
}
