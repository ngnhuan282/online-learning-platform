package com.elearning.auth;

import static org.assertj.core.api.Assertions.*;

import com.elearning.auth.repository.RefreshTokenRepository;
import com.elearning.auth.security.JwtTokenProvider;
import com.elearning.auth.security.RefreshTokenCookie;
import com.elearning.auth.service.RefreshTokenService;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class RefreshTokenTests {

    static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();
    static final String PASSWORD = "RefreshTest9!";

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:refresh_flow;MODE=MySQL;DB_CLOSE_DELAY=-1");
    }

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper mapper;

    @Autowired
    RefreshTokenRepository refreshTokens;

    @Autowired
    RefreshTokenService refreshService;

    @Autowired
    JwtTokenProvider jwt;

    @Autowired
    JdbcTemplate jdbc;

    final HttpClient client = HttpClient.newHttpClient();

    HttpResponse<String> post(String endpoint, Object body, String cookie) throws Exception {
        return post(endpoint, body, cookie, null);
    }

    HttpResponse<String> post(String endpoint, Object body, String cookie, String bearer) throws Exception {
        var builder = HttpRequest.newBuilder(
            URI.create("http://localhost:" + port + "/api/v1/auth/" + endpoint)
        )
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
        if (cookie != null) builder.header("Cookie", "refresh_token=" + cookie);
        if (bearer != null) builder.header("Authorization", "Bearer " + bearer);
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    String createUser() throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        assertThat(
            post(
                "register",
                Map.of("fullName", "Refresh User", "email", email, "password", PASSWORD),
                null
            ).statusCode()
        ).isEqualTo(201);
        return email;
    }

    HttpResponse<String> login(String email) throws Exception {
        var response = post("login", Map.of("email", email, "password", PASSWORD), null);
        assertThat(response.statusCode()).isEqualTo(200);
        return response;
    }

    String raw(HttpResponse<String> response) {
        return HttpCookie.parse(response.headers().firstValue("Set-Cookie").orElseThrow())
            .getFirst()
            .getValue();
    }

    String hash(String raw) throws Exception {
        return HexFormat.of().formatHex(
            MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8))
        );
    }

    JsonNode data(HttpResponse<String> response) {
        return mapper.readTree(response.body()).get("data");
    }

    void error(HttpResponse<String> response, int status, String code, String raw) {
        assertThat(response.statusCode()).isEqualTo(status);
        assertThat(mapper.readTree(response.body()).get("code").asString()).isEqualTo(code);
        if (raw != null) assertThat(response.body().contains(raw)).isFalse();
    }

    @Test
    void loginCreatesHashOnlyAndHttpOnlySessionCookie() throws Exception {
        var response = login(createUser());
        String raw = raw(response);
        assertThat(raw.matches("[A-Za-z0-9_-]{43}")).isTrue();
        var row = refreshTokens.findByTokenHash(hash(raw)).orElseThrow();
        assertThat(row.getTokenHash().equals(raw)).isFalse();
        assertThat(row.getTokenHash()).hasSize(64);
        assertThat(row.getExpiresAt()).isBetween(
            Instant.now().plusSeconds(604790),
            Instant.now().plusSeconds(604801)
        );
        assertThat(row.getRevokedAt()).isNull();
        assertThat(response.body()).doesNotContain(raw, "refreshToken", "tokenHash");
        String cookie = response.headers().firstValue("Set-Cookie").orElseThrow();
        assertThat(cookie)
            .contains("HttpOnly", "SameSite=Lax", "Path=/api/v1/auth")
            .doesNotContain("Max-Age", "Expires", "Secure", "Domain=");
        assertThat(response.headers().firstValue("Cache-Control")).contains("no-store");
        assertThat(new RefreshTokenCookie(true).issue("test")).contains("Secure", "HttpOnly", "SameSite=Lax");
    }

    @Test
    void refreshRotatesCookieRenewsAccessAndRejectsOldToken() throws Exception {
        var login = login(createUser());
        String old = raw(login);
        var response = post("refresh", Map.of(), old);
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(raw(response).equals(old)).isFalse();
        assertThat(
            data(response).get("accessToken").asString().equals(data(login).get("accessToken").asString())
        ).isFalse();
        var claims = jwt.validate(data(response).get("accessToken").asString());
        assertThat(claims.getSubject()).isEqualTo(data(login).get("user").get("id").asString());
        assertThat(claims.get("tokenType")).isEqualTo("access");
        assertThat(refreshTokens.findByTokenHash(hash(old)).orElseThrow().getRevokedAt()).isNotNull();
        assertThat(
            refreshTokens
                .findByTokenHash(hash(raw(response)))
                .orElseThrow()
                .getRevokedAt()
        ).isNull();
        error(post("refresh", Map.of(), old), 401, "REFRESH_TOKEN_REVOKED", old);
        assertThat(response.body().contains(raw(response))).isFalse();
    }

    @Test
    void missingMalformedUnknownAndBodyTokensAreRejected() throws Exception {
        error(post("refresh", Map.of(), null), 401, "REFRESH_TOKEN_MISSING", null);
        error(post("refresh", Map.of(), "broken"), 401, "REFRESH_TOKEN_INVALID", "broken");
        String unknown = "A".repeat(43);
        error(post("refresh", Map.of(), unknown), 401, "REFRESH_TOKEN_INVALID", unknown);
        String valid = raw(login(createUser()));
        error(post("refresh", Map.of("refreshToken", valid), null), 401, "REFRESH_TOKEN_MISSING", valid);
        assertThat(refreshService.validate(valid).getRevokedAt()).isNull();
    }

    @Test
    void expiredAndRevokedTokensAreRejected() throws Exception {
        String expired = raw(login(createUser()));
        jdbc.update(
            "UPDATE refresh_tokens SET expires_at = ? WHERE token_hash = ?",
            Timestamp.from(Instant.now().minusSeconds(1)),
            hash(expired)
        );
        error(post("refresh", Map.of(), expired), 401, "REFRESH_TOKEN_EXPIRED", expired);
        String revoked = raw(login(createUser()));
        refreshService.revoke(revoked);
        error(post("refresh", Map.of(), revoked), 401, "REFRESH_TOKEN_REVOKED", revoked);
    }

    @Test
    void disabledAndLockedUsersCannotRefresh() throws Exception {
        for (String status : List.of("DISABLED", "LOCKED")) {
            String email = createUser();
            String raw = raw(login(email));
            jdbc.update("UPDATE users SET status = ? WHERE email = ?", status, email);
            error(post("refresh", Map.of(), raw), 403, "ACCOUNT_" + status, raw);
            assertThat(refreshTokens.findByTokenHash(hash(raw)).orElseThrow().getRevokedAt()).isNull();
        }
    }

    @Test
    void logoutRevokesClearsCookieAndIsIdempotent() throws Exception {
        String raw = raw(login(createUser()));
        var response = post("logout", Map.of(), raw);
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("Set-Cookie").orElseThrow()).contains(
            "refresh_token=;",
            "Max-Age=0",
            "HttpOnly",
            "SameSite=Lax",
            "Path=/api/v1/auth"
        );
        assertThat(refreshTokens.findByTokenHash(hash(raw)).orElseThrow().getRevokedAt()).isNotNull();
        error(post("refresh", Map.of(), raw), 401, "REFRESH_TOKEN_REVOKED", raw);
        assertThat(post("logout", Map.of(), raw).statusCode()).isEqualTo(200);
        assertThat(post("logout", Map.of(), null).statusCode()).isEqualTo(200);
        assertThat(post("logout", Map.of(), "broken").statusCode()).isEqualTo(200);
        assertThat(post("logout", Map.of(), "A".repeat(43)).statusCode()).isEqualTo(200);
    }

    @Test
    void sessionsAreIndependent() throws Exception {
        String email = createUser();
        String first = raw(login(email)),
            second = raw(login(email));
        assertThat(first.equals(second)).isFalse();
        assertThat(post("logout", Map.of(), first).statusCode()).isEqualTo(200);
        assertThat(post("refresh", Map.of(), second).statusCode()).isEqualTo(200);
    }

    @Test
    void concurrentRotationHasExactlyOneWinner() throws Exception {
        String raw = raw(login(createUser()));
        var calls = new ArrayList<CompletableFuture<HttpResponse<String>>>();
        for (int i = 0; i < 2; i++) calls.add(
            CompletableFuture.supplyAsync(() -> {
                try {
                    return post("refresh", Map.of(), raw);
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
        ).containsExactlyInAnyOrder(200, 401);
    }

    @Test
    void publicCookieEndpointsIgnoreExpiredOrMalformedAccessBearer() throws Exception {
        String raw = raw(login(createUser()));
        var response = post("refresh", Map.of(), raw, "expired-or-malformed-access");
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(
            post("logout", Map.of(), raw(response), "expired-or-malformed-access").statusCode()
        ).isEqualTo(200);
    }
}
