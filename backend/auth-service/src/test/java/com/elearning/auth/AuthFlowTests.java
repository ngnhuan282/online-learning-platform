package com.elearning.auth;

import static org.assertj.core.api.Assertions.*;

import com.elearning.auth.repository.UserRepository;
import com.elearning.auth.security.CustomUserDetailsService;
import com.elearning.auth.security.JwtTokenProvider;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(AuthServiceApplicationTests.Probes.class)
class AuthFlowTests {

    static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();
    static final String PASSWORD = "TestPassword9!";
    static final String REGISTER = "/api/v1/auth/register",
        LOGIN = "/api/v1/auth/login",
        ME = "/api/v1/users/me";

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:auth_flow;MODE=MySQL;DB_CLOSE_DELAY=-1");
    }

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper mapper;

    @Autowired
    UserRepository users;

    @Autowired
    PasswordEncoder passwords;

    @Autowired
    JwtTokenProvider tokens;

    @Autowired
    CustomUserDetailsService details;

    @Autowired
    JdbcTemplate jdbc;

    final HttpClient client = HttpClient.newHttpClient();

    HttpResponse<String> request(String path, Object body, String token) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (body != null) builder
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
        if (token != null) builder.header("Authorization", "Bearer " + token);
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    Map<String, Object> registration(String email) {
        return Map.of("fullName", "  Nguyễn Văn A  ", "email", email, "password", PASSWORD);
    }

    String email() {
        return UUID.randomUUID() + "@example.com";
    }

    JsonNode data(HttpResponse<String> response) {
        return mapper.readTree(response.body()).get("data");
    }

    String registerUser() throws Exception {
        String email = email();
        assertThat(request(REGISTER, registration(email), null).statusCode()).isEqualTo(201);
        return email;
    }

    HttpResponse<String> login(String email, String password) throws Exception {
        return request(LOGIN, Map.of("email", email, "password", password), null);
    }

    void error(HttpResponse<String> response, int status, String code) {
        assertThat(response.statusCode()).isEqualTo(status);
        assertThat(mapper.readTree(response.body()).get("code").asString()).isEqualTo(code);
        assertThat(response.body()).doesNotContain(PASSWORD, "passwordHash", "password_hash", "trace");
    }

    @Test
    void registersNormalizesHashesAndIgnoresCallerRoles() throws Exception {
        String email = email();
        var input = new HashMap<>(registration("  " + email.toUpperCase(Locale.ROOT) + "  "));
        input.put("roles", List.of("ADMIN"));
        input.put("status", "DISABLED");
        input.put("confirmPassword", "not persisted");
        var response = request(REGISTER, input, null);
        assertThat(response.statusCode()).isEqualTo(201);
        assertThat(data(response).get("email").asString()).isEqualTo(email);
        assertThat(data(response).get("fullName").asString()).isEqualTo("Nguyễn Văn A");
        assertThat(data(response).get("roles").toString()).isEqualTo("[\"USER\"]");
        assertThat(response.body()).doesNotContain(PASSWORD, "password", "accessToken");
        var stored = users.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(stored.getPasswordHash()).startsWith("$2").hasSize(60);
        assertThat(passwords.matches(PASSWORD, stored.getPasswordHash())).isTrue();
        assertThat(stored.getStatus().name()).isEqualTo("ACTIVE");
        assertThat(stored.getCreatedAt()).isNotNull();
        assertThat(stored.getUpdatedAt()).isNotNull();
    }

    @Test
    void rejectsDuplicateEmailIgnoringCase() throws Exception {
        String email = registerUser();
        error(
            request(REGISTER, registration(email.toUpperCase(Locale.ROOT)), null),
            409,
            "EMAIL_ALREADY_EXISTS"
        );
    }

    @Test
    void concurrentDuplicateRegistrationReturnsConflict() throws Exception {
        String email = email();
        var calls = new ArrayList<CompletableFuture<HttpResponse<String>>>();
        for (int i = 0; i < 2; i++) calls.add(
            CompletableFuture.supplyAsync(() -> {
                try {
                    return request(REGISTER, registration(email), null);
                } catch (Exception ex) {
                    throw new RuntimeException(ex);
                }
            })
        );
        assertThat(
            calls
                .stream()
                .map(call -> call.join().statusCode())
                .toList()
        ).containsExactlyInAnyOrder(201, 409);
    }

    @Test
    void rejectsInvalidRegistrationAndLogin() throws Exception {
        error(request(REGISTER, Map.of(), null), 400, "VALIDATION_ERROR");
        error(request(LOGIN, Map.of(), null), 400, "VALIDATION_ERROR");
        for (var field : Map.of("fullName", " ", "email", "invalid", "password", "short").entrySet()) {
            var input = new HashMap<>(registration(email()));
            input.put(field.getKey(), field.getValue());
            var response = request(REGISTER, input, null);
            error(response, 400, "VALIDATION_ERROR");
            assertThat(mapper.readTree(response.body()).get("errors").has(field.getKey())).isTrue();
        }
        var input = new HashMap<>(registration(email()));
        input.put("password", "Aa1" + "界".repeat(24));
        var response = request(REGISTER, input, null);
        error(response, 400, "VALIDATION_ERROR");
        var fieldErrors = mapper.readTree(response.body()).get("errors");
        assertThat(fieldErrors.has("password")).isTrue();
        assertThat(fieldErrors.has("passwordWithinByteLimit")).isFalse();
        assertThat(response.body()).doesNotContain(input.get("password").toString());
    }

    @Test
    void registrationEnforcesPasswordRulesWithoutPersistingInvalidUsers() throws Exception {
        for (String password : List.of("lowercase9", "UPPERCASE9", "NoDigitsHere", "Aa1short".repeat(10))) {
            String email = email();
            var input = new HashMap<>(registration(email));
            input.put("password", password);
            var response = request(REGISTER, input, null);
            error(response, 400, "VALIDATION_ERROR");
            assertThat(mapper.readTree(response.body()).get("errors").has("password")).isTrue();
            assertThat(response.body()).doesNotContain(password);
            assertThat(users.existsByEmailIgnoreCase(email)).isFalse();
        }
    }

    @Test
    void acceptsAsciiAndUnicodePasswordsAtBcryptByteLimit() throws Exception {
        for (String password : List.of("Aa1" + "x".repeat(69), "Aa1" + "界".repeat(23))) {
            String email = email();
            var input = new HashMap<>(registration(email));
            input.put("password", password);
            assertThat(request(REGISTER, input, null).statusCode()).isEqualTo(201);
            assertThat(login(email, password).statusCode()).isEqualTo(200);
            assertThat(
                passwords.matches(
                    password,
                    users.findByEmailIgnoreCase(email).orElseThrow().getPasswordHash()
                )
            ).isTrue();
        }
    }

    @Test
    void existingUsersCanLoginWithoutReapplyingRegistrationStrengthRules() throws Exception {
        String email = registerUser();
        String legacyPassword = "oldpassword";
        jdbc.update(
            "UPDATE users SET password_hash = ? WHERE email = ?",
            passwords.encode(legacyPassword),
            email
        );
        assertThat(login(email, legacyPassword).statusCode()).isEqualTo(200);
    }

    @Test
    void logsInAndIssuesCompleteAccessClaims() throws Exception {
        String email = registerUser();
        var response = login(" " + email.toUpperCase(Locale.ROOT) + " ", PASSWORD);
        assertThat(response.statusCode()).isEqualTo(200);
        var payload = data(response);
        assertThat(payload.get("tokenType").asString()).isEqualTo("Bearer");
        assertThat(payload.get("expiresIn").asLong()).isEqualTo(900);
        var claims = tokens.validate(payload.get("accessToken").asString());
        assertThat(claims.getSubject()).isEqualTo(payload.get("user").get("id").asString());
        assertThat(claims.getIssuer()).isEqualTo("learnsphere");
        assertThat(claims.get("tokenType")).isEqualTo("access");
        assertThat(tokens.roles(claims)).containsExactly("USER");
        assertThat(claims.getExpiration().getTime() - claims.getIssuedAt().getTime()).isEqualTo(900000);
        assertThat(response.body()).doesNotContain(PASSWORD, "passwordHash");
    }

    @Test
    void hidesWrongEmailAndWrongPasswordBehindSameError() throws Exception {
        var wrongEmail = login(email(), PASSWORD);
        var wrongPassword = login(registerUser(), "Incorrect9!");
        error(wrongEmail, 401, "INVALID_CREDENTIALS");
        error(wrongPassword, 401, "INVALID_CREDENTIALS");
        assertThat(mapper.readTree(wrongEmail.body()).get("message")).isEqualTo(
            mapper.readTree(wrongPassword.body()).get("message")
        );
    }

    @Test
    void rejectsDisabledAndLockedAccountsAtLoginAndMe() throws Exception {
        for (String status : List.of("DISABLED", "LOCKED")) {
            String email = registerUser();
            String token = data(login(email, PASSWORD)).get("accessToken").asString();
            jdbc.update("UPDATE users SET status = ? WHERE email = ?", status, email);
            error(login(email, PASSWORD), 403, "ACCOUNT_" + status);
            error(login(email, "Incorrect9!"), 401, "INVALID_CREDENTIALS");
            error(request(ME, null, token), 403, "ACCOUNT_" + status);
        }
    }

    @Test
    void meLoadsDatabaseUserAndRequiresValidToken() throws Exception {
        String email = registerUser();
        String token = data(login(email, PASSWORD)).get("accessToken").asString();
        jdbc.update("UPDATE users SET full_name = ? WHERE email = ?", "Updated Name", email);
        var me = request(ME, null, token);
        assertThat(me.statusCode()).isEqualTo(200);
        assertThat(data(me).get("fullName").asString()).isEqualTo("Updated Name");
        error(request(ME, null, null), 401, "UNAUTHORIZED");
        error(request(ME, null, "broken"), 401, "UNAUTHORIZED");
        String expired = Jwts.builder()
            .subject("1")
            .issuer("learnsphere")
            .claim("role", "USER")
            .claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(120)))
            .expiration(Date.from(Instant.now().minusSeconds(60)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();
        error(request(ME, null, expired), 401, "UNAUTHORIZED");
        error(request(ME, null, tokens.createAccessToken("99999999", "USER")), 404, "USER_NOT_FOUND");
    }

    @Test
    void repositoryUserDetailsMapsAllAuthoritiesAndStatuses() throws Exception {
        String email = registerUser();
        var user = details.loadUserByUsername(" " + email.toUpperCase(Locale.ROOT) + " ");
        assertThat(user.getAuthorities()).extracting("authority").containsExactly("ROLE_USER");
        assertThat(passwords.matches(PASSWORD, user.getPassword())).isTrue();
        jdbc.update("UPDATE users SET status = 'LOCKED' WHERE email = ?", email);
        assertThat(details.loadUserByUsername(email).isAccountNonLocked()).isFalse();
        jdbc.update("UPDATE users SET status = 'DISABLED' WHERE email = ?", email);
        assertThat(details.loadUserByUsername(email).isEnabled()).isFalse();
    }

    @Test
    void multiRoleJwtEnforcesAdminAuthorization() throws Exception {
        String email = registerUser();
        String userToken = data(login(email, PASSWORD)).get("accessToken").asString();
        String adminPath = AuthServiceApplicationTests.BASE + "/admin";
        error(request(adminPath, null, userToken), 403, "FORBIDDEN");
        jdbc.update(
            "INSERT INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u CROSS JOIN roles r WHERE u.email = ? AND r.name = 'ADMIN'",
            email
        );
        String adminToken = data(login(email, PASSWORD)).get("accessToken").asString();
        assertThat(tokens.roles(tokens.validate(adminToken))).containsExactlyInAnyOrder("USER", "ADMIN");
        assertThat(request(adminPath, null, adminToken).statusCode()).isEqualTo(200);
        assertThat(details.loadUserByUsername(email).getAuthorities())
            .extracting("authority")
            .containsExactlyInAnyOrder("ROLE_USER", "ROLE_ADMIN");
    }

    @Test
    void flywayCreatesSchemaAndSeedsOnlyRoles() {
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM \"flyway_schema_history\" WHERE \"success\" = TRUE AND \"type\" = 'SQL'",
                Integer.class
            )
        ).isEqualTo(5);
        assertThat(jdbc.queryForList("SELECT name FROM roles", String.class)).containsExactlyInAnyOrder(
            "USER",
            "ADMIN"
        );
    }
}
