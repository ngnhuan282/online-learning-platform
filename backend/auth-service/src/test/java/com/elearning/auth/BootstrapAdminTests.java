package com.elearning.auth;

import static org.assertj.core.api.Assertions.*;

import com.elearning.auth.config.BootstrapAdmin;
import com.elearning.auth.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(
    properties = {
        "spring.datasource.url=jdbc:h2:mem:bootstrap;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "security.jwt.secret=bootstrap-integration-secret-at-least-32-bytes",
        "app.bootstrap-admin.enabled=true",
        "app.bootstrap-admin.email=initial-admin@example.test",
        "app.bootstrap-admin.password=InitialAdminTest123!",
    }
)
@ActiveProfiles("test")
class BootstrapAdminTests {

    @Autowired
    UserRepository users;

    @Autowired
    PasswordEncoder encoder;

    @Autowired
    BootstrapAdmin bootstrap;

    @Test
    void createsOneHashedAdministratorAndRepeatedStartupDoesNotResetIt() {
        var admin = users.findByEmailIgnoreCase("initial-admin@example.test").orElseThrow();
        assertThat(encoder.matches("InitialAdminTest123!", admin.getPasswordHash())).isTrue();
        assertThat(admin.getRoles())
            .extracting(role -> role.getName())
            .containsExactlyInAnyOrder("USER", "ADMIN");
        String hash = admin.getPasswordHash();
        bootstrap.run(null);
        assertThat(users.count()).isEqualTo(1);
        assertThat(users.findById(admin.getId()).orElseThrow().getPasswordHash()).isEqualTo(hash);
    }
}
