package com.elearning.auth;

import static org.assertj.core.api.Assertions.*;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class GoogleIdentityMigrationTests {

    @Test
    void upgradesV7WithoutChangingLocalGoogleUsersRolesOrExistingRefreshCookies() throws Exception {
        String mysql = System.getenv("GOOGLE_MIGRATION_TEST_DB_URL");
        String url =
            mysql == null
                ? "jdbc:h2:mem:migration_" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1"
                : mysql;
        String username = mysql == null ? "sa" : System.getenv("GOOGLE_TEST_DB_USERNAME");
        String password = mysql == null ? "" : System.getenv("GOOGLE_TEST_DB_PASSWORD");
        Flyway.configure()
            .dataSource(url, username, password)
            .locations("classpath:db/migration")
            .target("7")
            .load()
            .migrate();
        try (Connection connection = DriverManager.getConnection(url, username, password)) {
            var jdbc = new JdbcTemplate(new SingleConnectionDataSource(connection, true));
            String hash = new BCryptPasswordEncoder().encode("MigrationPassword9!");
            String localEmail = UUID.randomUUID() + "@example.com";
            String googleEmail = UUID.randomUUID() + "@example.com";
            String subject = "CaseSensitive-Migrated-Subject";
            jdbc.update(
                "INSERT INTO users (email, password_hash, full_name, status, auth_provider, provider_subject) VALUES (?, ?, 'Local profile', 'ACTIVE', 'LOCAL', NULL)",
                localEmail,
                hash
            );
            jdbc.update(
                "INSERT INTO users (email, password_hash, full_name, status, auth_provider, provider_subject) VALUES (?, NULL, 'Google profile', 'ACTIVE', 'GOOGLE', ?)",
                googleEmail,
                subject.getBytes(StandardCharsets.UTF_8)
            );
            Long localId = jdbc.queryForObject(
                "SELECT id FROM users WHERE email = ?",
                Long.class,
                localEmail
            );
            Long googleId = jdbc.queryForObject(
                "SELECT id FROM users WHERE email = ?",
                Long.class,
                googleEmail
            );
            Long role = jdbc.queryForObject("SELECT id FROM roles WHERE name = 'USER'", Long.class);
            jdbc.update("INSERT INTO user_roles(user_id, role_id) VALUES (?, ?)", localId, role);
            jdbc.update("INSERT INTO user_roles(user_id, role_id) VALUES (?, ?)", googleId, role);
            String refreshHash = "a".repeat(64);
            jdbc.update(
                "INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
                localId,
                refreshHash,
                Timestamp.from(Instant.now().plusSeconds(3600)),
                Timestamp.from(Instant.now())
            );

            Flyway.configure()
                .dataSource(url, username, password)
                .locations("classpath:db/migration")
                .load()
                .migrate();

            assertThat(
                jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, localEmail)
            ).isEqualTo(localId);
            assertThat(
                jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, localId)
            ).isEqualTo(hash);
            assertThat(
                jdbc.queryForObject("SELECT full_name FROM users WHERE id = ?", String.class, localId)
            ).isEqualTo("Local profile");
            assertThat(
                jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, googleId)
            ).isNull();
            assertThat(
                jdbc.queryForObject(
                    "SELECT user_id FROM user_external_identities WHERE provider = 'GOOGLE' AND provider_subject = ?",
                    Long.class,
                    subject.getBytes(StandardCharsets.UTF_8)
                )
            ).isEqualTo(googleId);
            assertThat(
                jdbc.queryForObject(
                    "SELECT COUNT(*) FROM user_roles WHERE user_id IN (?, ?)",
                    Long.class,
                    localId,
                    googleId
                )
            ).isEqualTo(2L);
            assertThat(
                jdbc.queryForObject(
                    "SELECT session_id FROM refresh_tokens WHERE token_hash = ?",
                    String.class,
                    refreshHash
                )
            ).isEqualTo(refreshHash);
            assertThat(
                jdbc.queryForObject(
                    "SELECT revoked_at FROM refresh_tokens WHERE token_hash = ?",
                    Timestamp.class,
                    refreshHash
                )
            ).isNull();
            assertThat(
                jdbc.queryForObject("SELECT credential_version FROM users WHERE id = ?", Long.class, localId)
            ).isZero();
            assertThatThrownBy(() ->
                jdbc.update(
                    "INSERT INTO user_external_identities (user_id, provider, provider_subject, email) VALUES (?, 'GOOGLE', ?, ?)",
                    localId,
                    subject.getBytes(StandardCharsets.UTF_8),
                    localEmail
                )
            ).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThatThrownBy(() ->
                jdbc.update(
                    "INSERT INTO user_external_identities (user_id, provider, provider_subject, email) VALUES (?, 'GOOGLE', ?, ?)",
                    googleId,
                    "another-subject".getBytes(StandardCharsets.UTF_8),
                    googleEmail
                )
            ).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThatThrownBy(() ->
                connection.createStatement().executeQuery("SELECT auth_provider FROM users")
            ).isInstanceOf(SQLException.class);
        }
    }
}
