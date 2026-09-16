package com.elearning.auth;

import static org.assertj.core.api.Assertions.*;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.common.exception.ErrorCode;
import com.elearning.auth.common.response.ApiResponse;
import com.elearning.auth.common.response.PageResponse;
import com.elearning.auth.security.JwtTokenProvider;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(AuthServiceApplicationTests.Probes.class)
class AuthServiceApplicationTests {

    static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();
    static final String BASE = "/api/v1/_foundation-test";

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
    }

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper mapper;

    @Autowired
    JwtTokenProvider tokens;

    final HttpClient client = HttpClient.newHttpClient();

    String token(String role, long seconds) {
        return Jwts.builder()
            .subject("test-user")
            .issuer("learnsphere")
            .claim("role", role)
            .claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(120)))
            .expiration(Date.from(Instant.now().plusSeconds(seconds)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();
    }

    HttpResponse<String> request(String path, String token, String body) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (body != null) builder
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body));
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    void error(HttpResponse<String> response, int status, String code, String path) throws Exception {
        assertThat(response.statusCode()).isEqualTo(status);
        JsonNode json = mapper.readTree(response.body());
        assertThat(json.get("success").asBoolean()).isFalse();
        assertThat(json.get("code").asString()).isEqualTo(code);
        assertThat(json.get("path").asString()).isEqualTo(path);
        assertThat(json.has("errors")).isTrue();
        assertThat(json.has("timestamp")).isTrue();
        assertThat(json.has("trace")).isFalse();
        assertThat(response.body()).doesNotContain("sensitive-test-detail");
    }

    @Test
    void startsIndependentlyAndExposesHealth() throws Exception {
        assertThat(request("/actuator/health", null, null).statusCode()).isEqualTo(200);
    }

    @Test
    void authenticatesWithoutTrustingIdentityHeaders() throws Exception {
        error(request(BASE, null, null), 401, "UNAUTHORIZED", BASE);
        error(request(BASE, "malformed", null), 401, "UNAUTHORIZED", BASE);
        error(request(BASE, token("USER", -60), null), 401, "UNAUTHORIZED", BASE);
        error(request(BASE, token("OTHER", 60), null), 401, "UNAUTHORIZED", BASE);
        error(request(BASE, token(null, 60), null), 401, "UNAUTHORIZED", BASE);
        var success = request(BASE, token("USER", 60), null);
        assertThat(success.statusCode()).isEqualTo(200);
        JsonNode json = mapper.readTree(success.body());
        assertThat(json.get("success").asBoolean()).isTrue();
        assertThat(json.get("message").asString()).isEqualTo("Success");
        assertThat(json.get("data").get("ready").asBoolean()).isTrue();
        assertThat(json.has("timestamp")).isTrue();
    }

    @Test
    void enforcesAdminAuthority() throws Exception {
        error(request(BASE + "/admin", token("USER", 60), null), 403, "FORBIDDEN", BASE + "/admin");
        assertThat(request(BASE + "/admin", token("ADMIN", 60), null).statusCode()).isEqualTo(200);
    }

    @Test
    void normalizesValidationAndMalformedBodies() throws Exception {
        var invalid = request(BASE, token("USER", 60), "{}");
        error(invalid, 400, "VALIDATION_ERROR", BASE);
        assertThat(mapper.readTree(invalid.body()).get("errors").get("name").isArray()).isTrue();
        error(request(BASE, token("USER", 60), "{"), 400, "MALFORMED_REQUEST", BASE);
    }

    @Test
    void normalizesDomainFallbackAndNotFound() throws Exception {
        error(request(BASE + "/conflict", token("USER", 60), null), 409, "CONFLICT", BASE + "/conflict");
        error(request(BASE + "/failure", token("USER", 60), null), 500, "INTERNAL_ERROR", BASE + "/failure");
        error(request(BASE + "/missing", token("USER", 60), null), 404, "NOT_FOUND", BASE + "/missing");
    }

    @Test
    void preservesPaginationMetadata() {
        var page = PageResponse.from(new PageImpl<>(List.of("item"), PageRequest.of(1, 2), 3));
        assertThat(page.page()).isEqualTo(1);
        assertThat(page.totalPages()).isEqualTo(2);
        assertThat(page.last()).isTrue();
    }

    @Test
    void rejectsWrongSignatureIssuerTypeAndMissingExpiry() {
        var key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String noExpiry = Jwts.builder()
            .subject("u")
            .issuer("learnsphere")
            .claim("role", "USER")
            .claim("tokenType", "access")
            .issuedAt(new Date())
            .signWith(key)
            .compact();
        assertThatThrownBy(() -> tokens.validate(noExpiry)).isInstanceOf(JwtException.class);
        String wrongIssuer = Jwts.builder().subject("u").issuer("other").signWith(key).compact();
        assertThatThrownBy(() -> tokens.validate(wrongIssuer)).isInstanceOf(JwtException.class);
        String wrongType = Jwts.builder()
            .subject("u")
            .issuer("learnsphere")
            .claim("tokenType", "refresh")
            .signWith(key)
            .compact();
        assertThatThrownBy(() -> tokens.validate(wrongType)).isInstanceOf(JwtException.class);
        var otherKey = Jwts.SIG.HS256.key().build();
        String wrongSignature = Jwts.builder().subject("u").signWith(otherKey).compact();
        assertThatThrownBy(() -> tokens.validate(wrongSignature)).isInstanceOf(JwtException.class);
    }

    @Autowired
    com.elearning.auth.security.CustomUserDetailsService users;

    @Test
    void issuesValidAccessTokenAndRejectsUnconfiguredCredentials() {
        String jwt = tokens.createAccessToken("user-id", "ADMIN");
        assertThat(tokens.validate(jwt).get("role", String.class)).isEqualTo("ADMIN");
        assertThatThrownBy(() -> users.loadUserByUsername("any@example.com")).isInstanceOf(
            UsernameNotFoundException.class
        );
    }

    @TestConfiguration
    static class Probes {

        @Bean
        ProbeController probeController() {
            return new ProbeController();
        }
    }

    @RestController
    @RequestMapping(BASE)
    static class ProbeController {

        record Input(@NotBlank String name) {}

        @GetMapping
        ApiResponse<?> success() {
            return ApiResponse.success(Map.of("ready", true));
        }

        @PostMapping
        ApiResponse<?> input(@Valid @RequestBody Input input) {
            return ApiResponse.success(input);
        }

        @GetMapping("/admin")
        @PreAuthorize("hasRole('ADMIN')")
        public ApiResponse<?> admin() {
            return success();
        }

        @GetMapping("/conflict")
        ApiResponse<?> conflict() {
            throw new AppException(ErrorCode.CONFLICT);
        }

        @GetMapping("/failure")
        ApiResponse<?> failure() {
            throw new IllegalStateException("sensitive-test-detail");
        }
    }
}
