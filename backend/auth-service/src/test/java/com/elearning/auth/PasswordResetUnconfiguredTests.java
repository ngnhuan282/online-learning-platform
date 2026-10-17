package com.elearning.auth;

import static org.assertj.core.api.Assertions.*;

import com.elearning.auth.config.PasswordResetProperties;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "security.password-reset.mail-enabled=true",
        "spring.mail.username=",
        "spring.mail.password=",
        "security.password-reset.mail-from=",
    }
)
@ActiveProfiles("test")
class PasswordResetUnconfiguredTests {

    static final String SECRET = UUID.randomUUID().toString().repeat(2);

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
        registry.add(
            "spring.datasource.url",
            () -> "jdbc:h2:mem:reset_unconfigured;MODE=MySQL;DB_CLOSE_DELAY=-1"
        );
    }

    @LocalServerPort
    int port;

    @Autowired
    PasswordResetProperties properties;

    @Autowired
    JsonMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JavaMailSender sender;

    HttpResponse<String> post(String path, Object body) throws Exception {
        return HttpClient.newHttpClient().send(
            HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                .build(),
            HttpResponse.BodyHandlers.ofString()
        );
    }

    @Test
    void enabledWithoutCredentialsStillStartsKeepsLoginWorkingAndIssuesNoTokens() throws Exception {
        assertThat(properties.ready()).isFalse();
        assertThat(sender).isInstanceOf(JavaMailSenderImpl.class);
        var smtp = ((JavaMailSenderImpl) sender).getJavaMailProperties();
        for (String key : new String[] {
            "mail.smtp.auth",
            "mail.smtp.starttls.enable",
            "mail.smtp.starttls.required",
            "mail.smtp.ssl.checkserveridentity",
        }) {
            assertThat(smtp.getProperty(key)).as("Bound SMTP property %s", key).isEqualTo("true");
        }
        for (String key : new String[] {
            "mail.smtp.connectiontimeout",
            "mail.smtp.timeout",
            "mail.smtp.writetimeout",
        }) {
            assertThat(smtp.getProperty(key)).as("Bound SMTP timeout %s", key).isEqualTo("5000");
        }
        assertThat(smtp.getProperty("mail.smtp.ssl.trust")).isNull();
        String email = UUID.randomUUID() + "@example.test";
        assertThat(
            post(
                "/api/v1/auth/register",
                Map.of("email", email, "fullName", "No SMTP", "password", "ValidPassword9!")
            ).statusCode()
        ).isEqualTo(201);
        assertThat(
            post("/api/v1/auth/login", Map.of("email", email, "password", "ValidPassword9!")).statusCode()
        ).isEqualTo(200);
        for (String recipient : new String[] { email, "unknown@example.test" }) {
            var response = post("/api/v1/auth/forgot-password", Map.of("email", recipient));
            assertThat(response.statusCode()).isEqualTo(503);
            assertThat(json.readTree(response.body()).get("code").asString()).isEqualTo(
                "PASSWORD_RESET_UNAVAILABLE"
            );
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM password_reset_tokens", Long.class)).isZero();
        assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM password_reset_rate_limits", Long.class)
        ).isZero();
    }
}
