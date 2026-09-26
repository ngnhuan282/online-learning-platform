package com.elearning.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.elearning.auth.entity.User;
import com.elearning.auth.repository.*;
import com.elearning.auth.security.JwtTokenProvider;
import java.net.URI;
import java.net.http.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class AdminManagementTests {

    static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
        registry.add(
            "spring.datasource.url",
            () -> "jdbc:h2:mem:admin_management;MODE=MySQL;DB_CLOSE_DELAY=-1"
        );
    }

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper mapper;

    @Autowired
    UserRepository users;

    @Autowired
    RoleRepository roles;

    @Autowired
    PasswordEncoder passwords;

    @Autowired
    JwtTokenProvider tokens;

    final HttpClient client = HttpClient.newHttpClient();

    private User user(String role) {
        return users.saveAndFlush(
            new User(
                UUID.randomUUID() + "@test.com",
                passwords.encode("Password123!"),
                "Admin test",
                roles.findByName(role).orElseThrow()
            )
        );
    }

    private String token(User user, String role) {
        return tokens.createAccessToken(user.getId().toString(), role);
    }

    private HttpResponse<String> request(String method, String path, String token, Object body)
        throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1" + path))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json");
        builder.method(
            method,
            body == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))
        );
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode data(HttpResponse<String> response) {
        assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(200);
        return mapper.readTree(response.body()).get("data");
    }

    @Test
    void customRoleLifecycleEnforcesDependenciesReservedPermissionsAndStaleVersion() throws Exception {
        String admin = token(user("ADMIN"), "ADMIN");
        String name = "SUPPORT_" + UUID.randomUUID().toString().replace("-", "").toUpperCase();
        var payload = new HashMap<String, Object>(
            Map.of(
                "name",
                name,
                "label",
                "Hỗ trợ",
                "description",
                "Test",
                "permissions",
                List.of("USER_CREATE"),
                "version",
                0
            )
        );
        JsonNode role = data(request("POST", "/admin/roles", admin, payload));
        long id = role.get("id").asLong();
        assertThat(role.get("permissions").toString()).contains("USER_VIEW", "ADMIN_ACCESS", "USER_CREATE");
        payload.put("version", role.get("version").asLong());
        payload.put("permissions", List.of("USER_STATUS_UPDATE"));
        JsonNode updated = data(request("PUT", "/admin/roles/" + id, admin, payload));
        assertThat(updated.get("version").asLong()).isGreaterThan(role.get("version").asLong());
        assertThat(request("PUT", "/admin/roles/" + id, admin, payload).statusCode()).isEqualTo(409);
        payload.put("version", updated.get("version").asLong());
        payload.put("permissions", List.of("ROLE_MANAGE"));
        assertThat(request("PUT", "/admin/roles/" + id, admin, payload).statusCode()).isEqualTo(403);
        User support = user(name);
        String supportToken = token(support, name);
        assertThat(request("GET", "/admin/users", supportToken, null).statusCode()).isEqualTo(200);
        assertThat(request("GET", "/admin/permissions", supportToken, null).statusCode()).isEqualTo(403);
        assertThat(request("POST", "/admin/roles", supportToken, payload).statusCode()).isEqualTo(403);
        assertThat(request("DELETE", "/admin/roles/" + id, admin, null).statusCode()).isEqualTo(409);
        payload.put("permissions", List.of("ADMIN_ACCESS"));
        data(request("PUT", "/admin/roles/" + id, admin, payload));
        // Auth admin authorization reads the database, not the stale JWT's role list.
        assertThat(request("GET", "/admin/users", supportToken, null).statusCode()).isEqualTo(403);
        data(
            request(
                "PUT",
                "/admin/users/" + support.getId() + "/roles",
                admin,
                Map.of("roles", List.of("USER"))
            )
        );
        assertThat(request("DELETE", "/admin/roles/" + id, admin, null).statusCode()).isEqualTo(200);
    }

    @Test
    void adminCanConfigureDefaultUserPermissionsForExistingAndNewAccounts() throws Exception {
        String admin = token(user("ADMIN"), "ADMIN");
        User existing = user("USER");
        String existingToken = token(existing, "USER");
        var userRole = roles.findByName("USER").orElseThrow();
        var originalPermissions = Set.copyOf(userRole.getPermissions());
        String path = "/admin/roles/" + userRole.getId();
        var payload = new HashMap<String, Object>(
            Map.of(
                "name",
                "USER",
                "label",
                userRole.getLabel(),
                "permissions",
                List.of("DASHBOARD_VIEW"),
                "version",
                userRole.getVersion()
            )
        );
        payload.put("description", userRole.getDescription());
        try {
            assertThat(request("PUT", path, existingToken, payload).statusCode()).isEqualTo(403);
            JsonNode updated = data(request("PUT", path, admin, payload));
            assertThat(updated.get("systemRole").asBoolean()).isTrue();
            assertThat(updated.get("permissions").toString()).contains("DASHBOARD_VIEW", "ADMIN_ACCESS");
            assertThat(request("PUT", path, admin, payload).statusCode()).isEqualTo(409);
            assertThat(request("GET", "/admin/overview", existingToken, null).statusCode()).isEqualTo(200);
            assertThat(request("GET", "/admin/users", existingToken, null).statusCode()).isEqualTo(403);

            String email = UUID.randomUUID() + "@test.com";
            assertThat(
                request(
                    "POST",
                    "/auth/register",
                    existingToken,
                    Map.of("fullName", "New default user", "email", email, "password", "Password123!")
                ).statusCode()
            ).isEqualTo(201);
            JsonNode login = data(
                request(
                    "POST",
                    "/auth/login",
                    existingToken,
                    Map.of("email", email, "password", "Password123!")
                )
            );
            assertThat(login.get("user").get("roles").toString()).isEqualTo("[\"USER\"]");
            assertThat(login.get("user").get("permissions").toString()).contains("DASHBOARD_VIEW");
            String newToken = login.get("accessToken").asString();
            assertThat(tokens.validate(newToken).get("permissions", List.class)).contains("DASHBOARD_VIEW");
            assertThat(request("GET", "/admin/overview", newToken, null).statusCode()).isEqualTo(200);

            payload.put("version", updated.get("version").asLong());
            payload.put("permissions", List.of("ROLE_MANAGE"));
            assertThat(request("PUT", path, admin, payload).statusCode()).isEqualTo(403);
            payload.put("permissions", List.of("USER_ROLES_ASSIGN"));
            assertThat(request("PUT", path, admin, payload).statusCode()).isEqualTo(403);
            assertThat(request("DELETE", path, admin, null).statusCode()).isEqualTo(403);
            payload.put("permissions", List.of());
            data(request("PUT", path, admin, payload));
            assertThat(request("GET", "/admin/overview", existingToken, null).statusCode()).isEqualTo(403);
            assertThat(request("GET", "/admin/overview", newToken, null).statusCode()).isEqualTo(403);
            assertThat(data(request("GET", "/admin/audit", admin, null)).toString()).contains(
                "ROLE_UPDATE",
                "USER"
            );

            var adminRole = roles.findByName("ADMIN").orElseThrow();
            payload.put("name", "ADMIN");
            payload.put("version", adminRole.getVersion());
            assertThat(
                request("PUT", "/admin/roles/" + adminRole.getId(), admin, payload).statusCode()
            ).isEqualTo(403);
        } finally {
            var current = roles.findByName("USER").orElseThrow();
            payload.put("name", "USER");
            payload.put("permissions", originalPermissions);
            payload.put("version", current.getVersion());
            data(request("PUT", path, admin, payload));
        }
    }

    @Test
    void usersFiltersAuditAndProtectedSystemRoles() throws Exception {
        User administrator = user("ADMIN");
        String admin = token(administrator, "ADMIN");
        String learner = token(user("USER"), "USER");
        assertThat(request("GET", "/admin/overview", learner, null).statusCode()).isEqualTo(403);
        String email = UUID.randomUUID() + "@test.com";
        JsonNode created = data(
            request(
                "POST",
                "/admin/users",
                admin,
                Map.of("fullName", "New learner", "email", email, "password", "Password123!")
            )
        );
        long id = created.get("id").asLong();
        assertThat(created.toString()).doesNotContain("password", "Password123!");
        assertThat(
            passwords.matches("Password123!", users.findById(id).orElseThrow().getPasswordHash())
        ).isTrue();
        JsonNode filtered = data(request("GET", "/admin/users?role=USER&keyword=" + email, admin, null));
        assertThat(filtered.get("totalElements").asLong()).isEqualTo(1);
        assertThat(
            request(
                "POST",
                "/admin/users",
                admin,
                Map.of("fullName", "Bad", "email", "bad", "password", "abc")
            ).statusCode()
        ).isEqualTo(400);
        assertThat(
            request(
                "PATCH",
                "/admin/users/" + administrator.getId() + "/status",
                admin,
                Map.of("status", "LOCKED")
            ).statusCode()
        ).isEqualTo(400);
        assertThat(
            request(
                "PUT",
                "/admin/users/" + administrator.getId() + "/roles",
                admin,
                Map.of("roles", List.of("USER"))
            ).statusCode()
        ).isEqualTo(400);
        for (String code : List.of("USER", "ADMIN")) {
            var role = roles.findByName(code).orElseThrow();
            assertThat(request("DELETE", "/admin/roles/" + role.getId(), admin, null).statusCode()).isEqualTo(
                403
            );
        }
        assertThat(data(request("GET", "/admin/audit", admin, null)).toString()).contains("USER_CREATE");
        assertThat(
            data(request("GET", "/admin/overview", admin, null))
                .get("monthly")
                .size()
        ).isEqualTo(6);
        data(request("PATCH", "/admin/users/" + id + "/status", admin, Map.of("status", "LOCKED")));
        assertThat(
            request(
                "GET",
                "/admin/users",
                token(users.findById(id).orElseThrow(), "ADMIN"),
                null
            ).statusCode()
        ).isEqualTo(403);
    }
}
