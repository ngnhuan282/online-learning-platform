package com.elearning.course.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.elearning.course.security.JwtTokenProvider;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class CourseControllerTest {

    static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
    }

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper mapper;

    HttpClient client = HttpClient.newHttpClient();

    String generateToken(String role, List<String> permissions) {
        return Jwts.builder()
            .subject("100")
            .issuer("sgedu")
            .claim("role", role)
            .claim("roles", List.of(role))
            .claim("permissions", permissions)
            .claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(10)))
            .expiration(Date.from(Instant.now().plusSeconds(3600)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();
    }

    @Test
    void getCourses_public_returns200AndPagination() throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/courses"))
            .GET()
            .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());

        assertThat(resp.statusCode()).isEqualTo(200);
        JsonNode json = mapper.readTree(resp.body());
        assertThat(json.get("success").asBoolean()).isTrue();
        assertThat(json.get("data").has("content")).isTrue();
        assertThat(json.get("data").has("totalElements")).isTrue();
        assertThat(json.get("data").has("totalPages")).isTrue();
    }

    @Test
    void createCourse_withoutAuth_returns401() throws Exception {
        String payload = """
            {
              "title": "Unauthorized Course",
              "description": "Desc",
              "categoryId": 1,
              "price": 100000
            }
            """;

        HttpRequest req = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/admin/courses"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());

        assertThat(resp.statusCode()).isEqualTo(401);
    }

    @Test
    void createCourse_userRoleWithoutPermission_returns403() throws Exception {
        String token = generateToken("USER", List.of());
        String payload = """
            {
              "title": "Forbidden Course",
              "description": "Desc",
              "categoryId": 1,
              "price": 100000
            }
            """;

        HttpRequest req = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/admin/courses"))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + token)
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());

        assertThat(resp.statusCode()).isEqualTo(403);
    }

    @Test
    void createCourse_invalidPayload_returns400Validation() throws Exception {
        String token = generateToken("ADMIN", List.of("COURSE_CREATE"));
        // Empty title and invalid price (-50)
        String invalidPayload = """
            {
              "title": "",
              "description": "",
              "categoryId": null,
              "price": -50
            }
            """;

        HttpRequest req = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/admin/courses"))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + token)
            .POST(HttpRequest.BodyPublishers.ofString(invalidPayload))
            .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());

        assertThat(resp.statusCode()).isEqualTo(400);
        JsonNode json = mapper.readTree(resp.body());
        assertThat(json.get("success").asBoolean()).isFalse();
        assertThat(json.get("code").asText()).isEqualTo("VALIDATION_ERROR");
    }
}
