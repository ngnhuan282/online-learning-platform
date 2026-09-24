package com.elearning.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.elearning.auth.entity.Role;
import com.elearning.auth.entity.User;
import com.elearning.auth.entity.enums.RoleName;
import com.elearning.auth.entity.enums.UserStatus;
import com.elearning.auth.repository.RoleRepository;
import com.elearning.auth.repository.UserRepository;
import com.elearning.auth.security.JwtTokenProvider;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(AuthServiceApplicationTests.Probes.class)
class UserFlowTests {

    static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:user_flow;MODE=MySQL;DB_CLOSE_DELAY=-1");
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

    HttpClient client;

    @BeforeEach
    void setUp() {
        client = HttpClient.newHttpClient();
    }

    private User createUser(String email, String rawPassword, String fullName, boolean isAdmin) {
        Role userRole = roles.findByName(RoleName.USER).orElseThrow();
        User user = new User(email, passwords.encode(rawPassword), fullName, userRole);
        if (isAdmin) {
            Role adminRole = roles.findByName(RoleName.ADMIN).orElseThrow();
            user.setRoles(Set.of(userRole, adminRole));
        }
        return users.saveAndFlush(user);
    }

    private String tokenFor(User user) {
        List<String> roleNames = user
            .getRoles()
            .stream()
            .map(r -> r.getName())
            .toList();
        return tokens.createAccessToken(user.getId().toString(), roleNames);
    }

    @Test
    void userCanUpdateProfile() throws Exception {
        User user = createUser(
            "updateprofile_" + UUID.randomUUID() + "@test.com",
            "Password123!",
            "Old Name",
            false
        );
        String token = tokenFor(user);

        String body = mapper.writeValueAsString(java.util.Map.of("fullName", "New Beautiful Name"));
        HttpRequest request = HttpRequest.newBuilder(
            URI.create("http://localhost:" + port + "/api/v1/users/me")
        )
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(body))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);

        JsonNode json = mapper.readTree(response.body());
        assertThat(json.get("success").asBoolean()).isTrue();
        assertThat(json.get("data").get("fullName").asText()).isEqualTo("New Beautiful Name");

        User updatedUser = users.findById(user.getId()).orElseThrow();
        assertThat(updatedUser.getFullName()).isEqualTo("New Beautiful Name");
    }

    @Test
    void userCanChangePasswordAndFailsWithWrongOldPassword() throws Exception {
        String oldPass = "OldPassword123!";
        String newPass = "NewPassword456!";
        User user = createUser("changepass_" + UUID.randomUUID() + "@test.com", oldPass, "User Pass", false);
        String token = tokenFor(user);

        // 1. Wrong old password
        String wrongBody = mapper.writeValueAsString(
            java.util.Map.of("currentPassword", "WrongCurrentPass1!", "newPassword", newPass)
        );
        HttpRequest badRequest = HttpRequest.newBuilder(
            URI.create("http://localhost:" + port + "/api/v1/users/change-password")
        )
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(wrongBody))
            .build();

        HttpResponse<String> badResponse = client.send(badRequest, HttpResponse.BodyHandlers.ofString());
        assertThat(badResponse.statusCode()).isEqualTo(400);
        JsonNode badJson = mapper.readTree(badResponse.body());
        assertThat(badJson.get("code").asText()).isEqualTo("OLD_PASSWORD_INCORRECT");

        // 2. Correct old password
        String correctBody = mapper.writeValueAsString(
            java.util.Map.of("currentPassword", oldPass, "newPassword", newPass)
        );
        HttpRequest goodRequest = HttpRequest.newBuilder(
            URI.create("http://localhost:" + port + "/api/v1/users/change-password")
        )
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(correctBody))
            .build();

        HttpResponse<String> goodResponse = client.send(goodRequest, HttpResponse.BodyHandlers.ofString());
        assertThat(goodResponse.statusCode()).isEqualTo(200);

        User updated = users.findById(user.getId()).orElseThrow();
        assertThat(passwords.matches(newPass, updated.getPasswordHash())).isTrue();
    }

    @Test
    void adminCanListUsersAndSearch() throws Exception {
        User admin = createUser(
            "admin_" + UUID.randomUUID() + "@test.com",
            "AdminPass123!",
            "Admin Person",
            true
        );
        User student = createUser(
            "student_unique_keyword_" + UUID.randomUUID() + "@test.com",
            "StudentPass123!",
            "Unique Student",
            false
        );

        String adminToken = tokenFor(admin);

        HttpRequest request = HttpRequest.newBuilder(
            URI.create("http://localhost:" + port + "/api/v1/admin/users?keyword=Unique")
        )
            .header("Authorization", "Bearer " + adminToken)
            .GET()
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);

        JsonNode json = mapper.readTree(response.body());
        assertThat(json.get("success").asBoolean()).isTrue();
        JsonNode content = json.get("data").get("content");
        assertThat(content.isArray()).isTrue();
        assertThat(content.size()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void regularUserCannotAccessAdminUsers() throws Exception {
        User regular = createUser(
            "regular_" + UUID.randomUUID() + "@test.com",
            "RegularPass123!",
            "Regular User",
            false
        );
        String regularToken = tokenFor(regular);

        HttpRequest request = HttpRequest.newBuilder(
            URI.create("http://localhost:" + port + "/api/v1/admin/users")
        )
            .header("Authorization", "Bearer " + regularToken)
            .GET()
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(403);
    }

    @Test
    void adminCanLockOtherUserAndCannotLockSelf() throws Exception {
        User admin = createUser(
            "admin2_" + UUID.randomUUID() + "@test.com",
            "AdminPass123!",
            "Admin Two",
            true
        );
        User victim = createUser(
            "victim_" + UUID.randomUUID() + "@test.com",
            "VictimPass123!",
            "Victim User",
            false
        );

        String adminToken = tokenFor(admin);

        // 1. Lock victim
        String lockBody = mapper.writeValueAsString(java.util.Map.of("status", "LOCKED"));
        HttpRequest lockRequest = HttpRequest.newBuilder(
            URI.create("http://localhost:" + port + "/api/v1/admin/users/" + victim.getId() + "/status")
        )
            .header("Authorization", "Bearer " + adminToken)
            .header("Content-Type", "application/json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(lockBody))
            .build();

        HttpResponse<String> lockResponse = client.send(lockRequest, HttpResponse.BodyHandlers.ofString());
        assertThat(lockResponse.statusCode()).isEqualTo(200);
        User lockedUser = users.findById(victim.getId()).orElseThrow();
        assertThat(lockedUser.getStatus()).isEqualTo(UserStatus.LOCKED);

        // 2. Lock self -> fails with CANNOT_LOCK_SELF
        HttpRequest selfLockRequest = HttpRequest.newBuilder(
            URI.create("http://localhost:" + port + "/api/v1/admin/users/" + admin.getId() + "/status")
        )
            .header("Authorization", "Bearer " + adminToken)
            .header("Content-Type", "application/json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(lockBody))
            .build();

        HttpResponse<String> selfResponse = client.send(
            selfLockRequest,
            HttpResponse.BodyHandlers.ofString()
        );
        assertThat(selfResponse.statusCode()).isEqualTo(400);
        JsonNode selfJson = mapper.readTree(selfResponse.body());
        assertThat(selfJson.get("code").asText()).isEqualTo("CANNOT_LOCK_SELF");
    }

    @Test
    void adminCanUpdateRolesAndCannotDemoteSelf() throws Exception {
        User admin = createUser(
            "admin3_" + UUID.randomUUID() + "@test.com",
            "AdminPass123!",
            "Admin Three",
            true
        );
        User target = createUser(
            "target_" + UUID.randomUUID() + "@test.com",
            "TargetPass123!",
            "Target User",
            false
        );

        String adminToken = tokenFor(admin);

        // 1. Promote target to ADMIN
        String promoteBody = mapper.writeValueAsString(java.util.Map.of("roles", List.of("USER", "ADMIN")));
        HttpRequest promoteRequest = HttpRequest.newBuilder(
            URI.create("http://localhost:" + port + "/api/v1/admin/users/" + target.getId() + "/roles")
        )
            .header("Authorization", "Bearer " + adminToken)
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(promoteBody))
            .build();

        HttpResponse<String> promoteResponse = client.send(
            promoteRequest,
            HttpResponse.BodyHandlers.ofString()
        );
        assertThat(promoteResponse.statusCode()).isEqualTo(200);
        User promoted = users.findById(target.getId()).orElseThrow();
        assertThat(promoted.getRoles())
            .extracting(r -> r.getName())
            .contains("ADMIN");

        // 2. Demote self -> fails with CANNOT_DEMOTE_SELF
        String demoteBody = mapper.writeValueAsString(java.util.Map.of("roles", List.of("USER")));
        HttpRequest demoteRequest = HttpRequest.newBuilder(
            URI.create("http://localhost:" + port + "/api/v1/admin/users/" + admin.getId() + "/roles")
        )
            .header("Authorization", "Bearer " + adminToken)
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(demoteBody))
            .build();

        HttpResponse<String> demoteResponse = client.send(
            demoteRequest,
            HttpResponse.BodyHandlers.ofString()
        );
        assertThat(demoteResponse.statusCode()).isEqualTo(400);
        JsonNode demoteJson = mapper.readTree(demoteResponse.body());
        assertThat(demoteJson.get("code").asText()).isEqualTo("CANNOT_DEMOTE_SELF");
    }
}
