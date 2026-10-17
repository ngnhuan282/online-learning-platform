package com.elearning.auth;

import static org.assertj.core.api.Assertions.*;

import com.elearning.auth.dto.LoginRequest;
import com.elearning.auth.repository.UserExternalIdentityRepository;
import com.elearning.auth.repository.UserRepository;
import com.elearning.auth.security.GoogleLoginProperties;
import com.elearning.auth.service.GoogleLoginCodeService;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// Real Spring OIDC filters + RSA-signed ID tokens; only Google's HTTP endpoints are replaced.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(GoogleLoginTests.ProviderConfiguration.class)
class GoogleLoginTests {

    static final JsonMapper JSON = JsonMapper.builder().build();
    static final RSAKey KEY = key();
    static final Map<String, Map<String, Object>> IDENTITIES = new ConcurrentHashMap<>();
    static final AtomicInteger TOKEN_REQUESTS = new AtomicInteger();
    static final HttpServer PROVIDER = provider();
    static final String PREFIX = "/api/v1/auth/google";
    static final String VERIFIER = "v".repeat(43);
    static final String PASSWORD = "StrongPassword9!";

    @LocalServerPort
    int port;

    @Autowired
    UserRepository users;

    @Autowired
    UserExternalIdentityRepository identities;

    @Autowired
    GoogleLoginCodeService codes;

    @Autowired
    JdbcTemplate jdbc;

    final HttpClient client = HttpClient.newHttpClient();

    static RSAKey key() {
        try {
            return new RSAKeyGenerator(2048).keyID("test-key").generate();
        } catch (JOSEException ex) {
            throw new IllegalStateException(ex);
        }
    }

    static HttpServer provider() {
        try {
            var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", exchange -> {
                try {
                    Object result;
                    String path = exchange.getRequestURI().getPath();
                    if (path.equals("/jwks")) result = new JWKSet(KEY.toPublicJWK()).toJSONObject();
                    else if (path.equals("/token")) {
                        TOKEN_REQUESTS.incrementAndGet();
                        var form = parameters(
                            new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)
                        );
                        String code = form.get("code");
                        var claims = IDENTITIES.get(code);
                        var builder = new JWTClaimsSet.Builder()
                            .issuer((String) claims.getOrDefault("iss", "https://accounts.google.com"))
                            .audience((String) claims.getOrDefault("aud", "test-client"))
                            .subject((String) claims.get("sub"))
                            .issueTime(Date.from(Instant.now().minusSeconds(10)))
                            .expirationTime(
                                Date.from(
                                    Instant.now().plusSeconds((long) claims.getOrDefault("lifetime", 300L))
                                )
                            );
                        claims.forEach(builder::claim);
                        var token = new SignedJWT(
                            new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test-key").build(),
                            builder.build()
                        );
                        RSAKey signingKey = Boolean.TRUE.equals(claims.get("badSignature")) ? key() : KEY;
                        token.sign(new RSASSASigner(signingKey));
                        result = Map.of(
                            "access_token",
                            code,
                            "token_type",
                            "Bearer",
                            "expires_in",
                            300,
                            "scope",
                            "openid email profile",
                            "id_token",
                            token.serialize()
                        );
                    } else if (path.equals("/userinfo")) {
                        String access = exchange.getRequestHeaders().getFirst("Authorization").substring(7);
                        result = IDENTITIES.get(access);
                    } else result = Map.of();
                    byte[] bytes = JSON.writeValueAsBytes(result);
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, bytes.length);
                    try (var body = exchange.getResponseBody()) {
                        body.write(bytes);
                    }
                } catch (Exception failure) {
                    exchange.sendResponseHeaders(500, -1);
                    exchange.close();
                }
            });
            server.start();
            return server;
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    @AfterAll
    static void stop() {
        PROVIDER.stop(0);
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () ->
            Optional.ofNullable(System.getenv("GOOGLE_BUSINESS_TEST_JWT_SECRET")).orElseGet(() ->
                UUID.randomUUID().toString().repeat(2)
            )
        );
        String mysql = System.getenv("GOOGLE_TEST_DB_URL");
        if (mysql == null) {
            registry.add(
                "spring.datasource.url",
                () -> "jdbc:h2:mem:google_login;MODE=MySQL;DB_CLOSE_DELAY=-1"
            );
        } else {
            // Optional disposable MySQL schema verifies migrations and locking on the production engine.
            registry.add("spring.datasource.url", () -> mysql);
            registry.add("spring.datasource.username", () -> System.getenv("GOOGLE_TEST_DB_USERNAME"));
            registry.add("spring.datasource.password", () -> System.getenv("GOOGLE_TEST_DB_PASSWORD"));
            registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
        }
        registry.add("security.google.enabled", () -> true);
        registry.add("security.google.client-id", () -> "test-client");
        registry.add("security.google.client-secret", () -> "test-secret");
    }

    @TestConfiguration
    static class ProviderConfiguration {

        @Bean
        @Primary
        ClientRegistrationRepository testRegistrations() {
            String base = "http://127.0.0.1:" + PROVIDER.getAddress().getPort();
            return new InMemoryClientRegistrationRepository(
                CommonOAuth2Provider.GOOGLE.getBuilder("google")
                    .clientId("test-client")
                    .clientSecret("test-secret")
                    .redirectUri("{baseUrl}" + GoogleLoginProperties.CALLBACK)
                    .authorizationUri(base + "/authorize")
                    .tokenUri(base + "/token")
                    .jwkSetUri(base + "/jwks")
                    .userInfoUri(base + "/userinfo")
                    .scope("openid", "email", "profile")
                    .build()
            );
        }
    }

    HttpResponse<String> request(String path, Object body, String cookie, String bearer) throws Exception {
        return request(path, body, cookie, bearer, body == null ? "GET" : "POST");
    }

    HttpResponse<String> request(String path, Object body, String cookie, String bearer, String method)
        throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (body != null) builder
            .header("Content-Type", "application/json")
            .method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        if (cookie != null) builder.header("Cookie", cookie);
        if (bearer != null) builder.header("Authorization", "Bearer " + bearer);
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    static Map<String, String> parameters(String query) {
        var values = new HashMap<String, String>();
        for (String part : query.split("&")) {
            String[] pair = part.split("=", 2);
            values.put(
                URLDecoder.decode(pair[0], StandardCharsets.UTF_8),
                URLDecoder.decode(pair.length > 1 ? pair[1] : "", StandardCharsets.UTF_8)
            );
        }
        return values;
    }

    String challenge() throws Exception {
        return Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(
                MessageDigest.getInstance("SHA-256").digest(VERIFIER.getBytes(StandardCharsets.US_ASCII))
            );
    }

    record Start(String state, String nonce, String cookie) {}

    Start begin() throws Exception {
        var start = request(PREFIX + "/start", Map.of("challenge", challenge()), null, null);
        assertThat(start.statusCode()).isEqualTo(200);
        String path = JSON.readTree(start.body()).get("data").get("authorizationPath").asString();
        var authorize = request(path, null, null, null);
        assertThat(authorize.statusCode()).isEqualTo(302);
        var params = parameters(
            URI.create(authorize.headers().firstValue("Location").orElseThrow()).getRawQuery()
        );
        assertThat(params.get("scope"))
            .contains("openid", "email", "profile")
            .doesNotContain("gmail", "drive");
        String cookie = authorize.headers().firstValue("Set-Cookie").orElseThrow();
        assertThat(cookie).contains("HttpOnly", "SameSite=Lax", "Path=/api/v1/auth/google");
        return new Start(params.get("state"), params.get("nonce"), cookie.split(";", 2)[0]);
    }

    String callback(Start start, String subject, String email, Map<String, Object> overrides)
        throws Exception {
        String code = UUID.randomUUID().toString();
        var claims = new HashMap<String, Object>();
        claims.putAll(
            Map.of(
                "sub",
                subject,
                "email",
                email,
                "email_verified",
                true,
                "name",
                "Google Learner",
                "nonce",
                start.nonce()
            )
        );
        claims.putAll(overrides);
        IDENTITIES.put(code, claims);
        var callback = request(
            PREFIX + "/callback/google?state=" + start.state() + "&code=" + code,
            null,
            start.cookie(),
            null
        );
        assertThat(callback.statusCode()).isEqualTo(302);
        assertThat(callback.headers().firstValue("Cache-Control")).hasValue("no-store");
        String location = callback.headers().firstValue("Location").orElseThrow();
        assertThat(location)
            .startsWith("http://localhost:5173/auth/google/callback?")
            .doesNotContain("access_token", "accessToken", "id_token", "test-secret");
        assertThat(callback.headers().allValues("Set-Cookie")).noneMatch(value ->
            value.startsWith("refresh_token=")
        );
        return location;
    }

    String loginCode(String subject, String email) throws Exception {
        return parameters(URI.create(callback(begin(), subject, email, Map.of())).getRawQuery()).get("code");
    }

    HttpResponse<String> exchange(String code, String verifier) throws Exception {
        return request(PREFIX + "/exchange", Map.of("code", code, "verifier", verifier), null, null);
    }

    JsonNode data(HttpResponse<String> response) {
        return JSON.readTree(response.body()).get("data");
    }

    String email() {
        return UUID.randomUUID() + "@example.com";
    }

    @Test
    void createsUserAndReusesIdentityWithInternalJwtRefreshMeAndLogout() throws Exception {
        String email = email(),
            subject = UUID.randomUUID().toString();
        var response = exchange(loginCode(subject, email), VERIFIER);
        assertThat(response.statusCode()).isEqualTo(200);
        var user = data(response).get("user");
        long id = user.get("id").asLong();
        assertThat(user.get("roles").toString()).isEqualTo("[\"USER\"]");
        assertThat(user.get("fullName").asString()).isEqualTo("Google Learner");
        var stored = users.findById(id).orElseThrow();
        assertThat(stored.getPasswordHash()).isNull();
        assertThat(identities.findByUserIdAndProvider(id, "GOOGLE")).isPresent();
        String token = data(response).get("accessToken").asString();
        var methods = request("/api/v1/users/me/linked-accounts", null, null, token);
        assertThat(methods.statusCode()).isEqualTo(200);
        assertThat(data(methods).get("passwordEnabled").asBoolean()).isFalse();
        assertThat(data(methods).get("google").get("email").asString()).isEqualTo(email);
        var cannotLink = request(
            PREFIX + "/link/start",
            Map.of("currentPassword", PASSWORD, "challenge", challenge()),
            response.headers().firstValue("Set-Cookie").orElseThrow().split(";", 2)[0],
            token
        );
        assertThat(cannotLink.statusCode()).isEqualTo(400);
        assertThat(cannotLink.body()).contains("GOOGLE_LINK_LOCAL_REQUIRED");
        assertThat(request("/api/v1/users/me", null, null, token).statusCode()).isEqualTo(200);
        var passwordChange = request(
            "/api/v1/users/change-password",
            Map.of("currentPassword", PASSWORD, "newPassword", "DifferentPassword9!"),
            null,
            token,
            "PUT"
        );
        assertThat(passwordChange.statusCode()).isEqualTo(400);
        assertThat(passwordChange.body()).contains("LOCAL_PASSWORD_UNAVAILABLE");
        assertThat(request("/api/v1/admin/users", null, null, token).statusCode()).isEqualTo(403);
        var again = exchange(loginCode(subject, "changed-" + email), VERIFIER);
        assertThat(data(again).get("user").get("id").asLong()).isEqualTo(id);
        assertThat(data(again).get("user").get("email").asString()).isEqualTo(email);
        var password = request("/api/v1/auth/login", new LoginRequest(email, PASSWORD), null, null);
        assertThat(password.statusCode()).isEqualTo(401);
        assertThat(password.body()).contains("GOOGLE_LOGIN_REQUIRED");
        String cookie = response.headers().firstValue("Set-Cookie").orElseThrow().split(";", 2)[0];
        var refresh = request("/api/v1/auth/refresh", Map.of(), cookie, null);
        assertThat(refresh.statusCode()).isEqualTo(200);
        String rotated = refresh.headers().firstValue("Set-Cookie").orElseThrow().split(";", 2)[0];
        assertThat(request("/api/v1/auth/refresh", Map.of(), cookie, null).statusCode()).isEqualTo(401);
        assertThat(request("/api/v1/auth/logout", Map.of(), rotated, null).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/auth/refresh", Map.of(), rotated, null).statusCode()).isEqualTo(401);
    }

    @Test
    void localEmailConflictNeverLinksOrChangesPassword() throws Exception {
        String email = email();
        assertThat(
            request(
                "/api/v1/auth/register",
                Map.of("fullName", "Local", "email", email, "password", PASSWORD),
                null,
                null
            ).statusCode()
        ).isEqualTo(201);
        var before = users.findByEmailIgnoreCase(email).orElseThrow();
        String location = callback(begin(), UUID.randomUUID().toString(), email, Map.of());
        assertThat(location).endsWith("error=GOOGLE_EMAIL_CONFLICT");
        assertThat(users.findById(before.getId()).orElseThrow().getPasswordHash()).isEqualTo(
            before.getPasswordHash()
        );
        assertThat(
            request("/api/v1/auth/login", new LoginRequest(email, PASSWORD), null, null).statusCode()
        ).isEqualTo(200);
    }

    @Test
    void lockedDisabledAndDeletedUsersCannotLoginOrExchangePreviouslyIssuedCode() throws Exception {
        for (String status : List.of("LOCKED", "DISABLED", "DELETED")) {
            String email = email(),
                subject = UUID.randomUUID().toString();
            String code = loginCode(subject, email);
            jdbc.update(
                "UPDATE users SET status = ?, deleted_at = ? WHERE email = ?",
                status.equals("DELETED") ? "ACTIVE" : status,
                status.equals("DELETED") ? Timestamp.from(Instant.now()) : null,
                email
            );
            String expected = status.equals("LOCKED") ? "ACCOUNT_LOCKED" : "ACCOUNT_DISABLED";
            assertThat(callback(begin(), subject, email, Map.of())).endsWith("error=" + expected);
            var response = exchange(code, VERIFIER);
            assertThat(response.statusCode()).isEqualTo(403);
            assertThat(response.body()).contains(expected);
        }
    }

    @Test
    void requiresVerifiedValidEmailAndRejectsInvalidOidcTokens() throws Exception {
        for (Map<String, Object> override : List.of(
            Map.<String, Object>of("email_verified", false),
            Map.<String, Object>of("email", "bad-email"),
            Map.<String, Object>of("nonce", "wrong"),
            Map.<String, Object>of("iss", "https://wrong.test"),
            Map.<String, Object>of("aud", "wrong-client"),
            Map.<String, Object>of("lifetime", -600L),
            Map.<String, Object>of("badSignature", true)
        )) {
            String email = email();
            String location = callback(begin(), UUID.randomUUID().toString(), email, override);
            assertThat(location).contains("?error=");
            assertThat(users.existsByEmailIgnoreCase(email)).isFalse();
        }
    }

    @Test
    void rejectsWrongStateMissingBrowserSessionAndCancellationWithoutTokenRequest() throws Exception {
        var start = begin();
        int before = TOKEN_REQUESTS.get();
        for (String cookie : Arrays.asList(start.cookie(), null)) {
            var response = request(PREFIX + "/callback/google?state=wrong&code=not-used", null, cookie, null);
            assertThat(response.headers().firstValue("Location")).hasValue(
                "http://localhost:5173/auth/google/callback?error=GOOGLE_LOGIN_FAILED"
            );
        }
        var cancelled = begin();
        var response = request(
            PREFIX + "/callback/google?state=" + cancelled.state() + "&error=access_denied",
            null,
            cancelled.cookie(),
            null
        );
        assertThat(response.headers().firstValue("Location")).hasValue(
            "http://localhost:5173/auth/google/callback?error=GOOGLE_LOGIN_CANCELLED"
        );
        assertThat(TOKEN_REQUESTS.get()).isEqualTo(before);
    }

    @Test
    void exchangeIsBrowserBoundExpiringAndConsumedOnceEvenConcurrently() throws Exception {
        String code = loginCode(UUID.randomUUID().toString(), email());
        assertThat(exchange(code, "x".repeat(43)).statusCode()).isEqualTo(401);
        var first = CompletableFuture.supplyAsync(() -> exchangeUnchecked(code));
        var second = CompletableFuture.supplyAsync(() -> exchangeUnchecked(code));
        assertThat(List.of(first.join(), second.join())).containsExactlyInAnyOrder(200, 401);
        assertThat(exchange(code, VERIFIER).statusCode()).isEqualTo(401);
        String expired = loginCode(UUID.randomUUID().toString(), email());
        jdbc.update(
            "UPDATE oauth_login_codes SET expires_at = ?",
            Timestamp.from(Instant.now().minusSeconds(120))
        );
        assertThat(exchange(expired, VERIFIER).statusCode()).isEqualTo(401);
    }

    int exchangeUnchecked(String code) {
        try {
            return exchange(code, VERIFIER).statusCode();
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    @Test
    void concurrentFirstLoginsResolveOneInternalUser() throws Exception {
        String subject = UUID.randomUUID().toString(),
            email = email();
        var start1 = begin();
        var start2 = begin();
        var calls = List.of(start1, start2)
            .stream()
            .map(start ->
                CompletableFuture.supplyAsync(() -> {
                    try {
                        return callback(start, subject, email, Map.of());
                    } catch (Exception ex) {
                        throw new IllegalStateException(ex);
                    }
                })
            )
            .toList();
        for (var call : calls) assertThat(call.join()).contains("?code=");
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_external_identities WHERE provider = 'GOOGLE' AND provider_subject = ?",
                Long.class,
                subject.getBytes(StandardCharsets.UTF_8)
            )
        ).isEqualTo(1L);
    }

    @Test
    void providerSubjectsAreCaseSensitiveOnEveryDatabase() throws Exception {
        String subject = "CaseSensitive-" + UUID.randomUUID();
        var upper = exchange(loginCode(subject, email()), VERIFIER);
        var lower = exchange(loginCode(subject.toLowerCase(Locale.ROOT), email()), VERIFIER);
        assertThat(upper.statusCode()).isEqualTo(200);
        assertThat(lower.statusCode()).isEqualTo(200);
        assertThat(data(upper).get("user").get("id").asLong()).isNotEqualTo(
            data(lower).get("user").get("id").asLong()
        );
        assertThat(
            identities.findByProviderAndProviderSubject("GOOGLE", subject).orElseThrow().getProviderSubject()
        ).isEqualTo(subject);
    }

    record LocalSession(long id, String email, String access, String cookie) {
        @Override
        public String toString() {
            return "LocalSession[redacted]";
        }
    }

    LocalSession localSession() throws Exception {
        String email = email();
        assertThat(
            request(
                "/api/v1/auth/register",
                Map.of("fullName", "Local Learner", "email", email, "password", PASSWORD),
                null,
                null
            ).statusCode()
        ).isEqualTo(201);
        return localLogin(email, PASSWORD);
    }

    LocalSession localLogin(String email, String password) throws Exception {
        var response = request("/api/v1/auth/login", new LoginRequest(email, password), null, null);
        assertThat(response.statusCode()).isEqualTo(200);
        return new LocalSession(
            data(response).get("user").get("id").asLong(),
            email,
            data(response).get("accessToken").asString(),
            response.headers().firstValue("Set-Cookie").orElseThrow().split(";", 2)[0]
        );
    }

    Start beginLink(LocalSession local) throws Exception {
        var start = request(
            PREFIX + "/link/start",
            Map.of(
                "currentPassword",
                PASSWORD,
                "challenge",
                challenge(),
                "userId",
                -100,
                "email",
                "ignored@example.com",
                "roles",
                List.of("ADMIN")
            ),
            local.cookie(),
            local.access()
        );
        assertThat(start.statusCode()).isEqualTo(200);
        String temporary = start
            .headers()
            .allValues("Set-Cookie")
            .stream()
            .filter(value -> value.startsWith("GOOGLE_OAUTH_SESSION="))
            .findFirst()
            .orElseThrow()
            .split(";", 2)[0];
        String cookie = local.cookie() + "; " + temporary;
        var authorize = request(data(start).get("authorizationPath").asString(), null, cookie, null);
        assertThat(authorize.statusCode()).isEqualTo(302);
        var params = parameters(
            URI.create(authorize.headers().firstValue("Location").orElseThrow()).getRawQuery()
        );
        return new Start(params.get("state"), params.get("nonce"), cookie);
    }

    String linkCode(LocalSession local, String subject) throws Exception {
        String location = callback(beginLink(local), subject, local.email(), Map.of());
        assertThat(location).contains("&flow=link");
        String code = parameters(URI.create(location).getRawQuery()).get("code");
        assertThat(code).isNotBlank();
        return code;
    }

    HttpResponse<String> completeLink(LocalSession local, String code, String verifier) throws Exception {
        return request(
            PREFIX + "/link/complete",
            Map.of("code", code, "verifier", verifier),
            local.cookie(),
            local.access()
        );
    }

    @Test
    void localLinksWithoutChangingUserPasswordProfileRolesOrIssuingAnotherSession() throws Exception {
        var local = localSession();
        String subject = UUID.randomUUID().toString();
        var before = users.findById(local.id()).orElseThrow();
        var profileBefore = data(request("/api/v1/users/me", null, null, local.access()));
        long count = users.count();
        String code = linkCode(local, subject);
        assertThat(identities.findByUserIdAndProvider(local.id(), "GOOGLE")).isEmpty();
        assertThat(users.count()).isEqualTo(count);
        var completed = completeLink(local, code, VERIFIER);
        assertThat(completed.statusCode()).isEqualTo(200);
        assertThat(completed.headers().allValues("Set-Cookie")).isEmpty();
        assertThat(completed.body()).doesNotContain("accessToken", "refresh_token", "passwordHash");
        assertThat(data(completed).get("linkedAccounts").get("passwordEnabled").asBoolean()).isTrue();
        assertThat(data(completed).get("linkedAccounts").get("google").get("email").asString()).isEqualTo(
            local.email()
        );
        var after = users.findById(local.id()).orElseThrow();
        assertThat(after.getPasswordHash()).isEqualTo(before.getPasswordHash());
        assertThat(after.getFullName()).isEqualTo(before.getFullName());
        assertThat(after.getEmail()).isEqualTo(before.getEmail());
        assertThat(data(request("/api/v1/users/me", null, null, local.access()))).isEqualTo(profileBefore);
        var googleLogin = exchange(loginCode(subject, local.email()), VERIFIER);
        var passwordLogin = request(
            "/api/v1/auth/login",
            new LoginRequest(local.email(), PASSWORD),
            null,
            null
        );
        assertThat(data(googleLogin).get("user")).isEqualTo(data(passwordLogin).get("user"));
        assertThat(data(googleLogin).get("user").get("id").asLong()).isEqualTo(local.id());
        assertThat(data(googleLogin).get("user").get("roles").toString()).isEqualTo("[\"USER\"]");
        var repeated = completeLink(local, linkCode(local, subject), VERIFIER);
        assertThat(repeated.statusCode()).isEqualTo(200);
        assertThat(data(repeated).get("alreadyLinked").asBoolean()).isTrue();
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_external_identities WHERE user_id = ?",
                Long.class,
                local.id()
            )
        ).isEqualTo(1L);
    }

    // Optional integration against disposable Course/Learning/Payment databases through a real Gateway.
    @Test
    @EnabledIfEnvironmentVariable(named = "GOOGLE_BUSINESS_GATEWAY_URL", matches = ".+")
    void linkedLoginRetainsRealCoursesEnrollmentsProgressAndPaymentHistory() throws Exception {
        var adminSession = localSession();
        jdbc.update(
            "INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = 'ADMIN'",
            adminSession.id()
        );
        var admin = localLogin(adminSession.email(), PASSWORD);
        var local = localSession();
        String suffix = UUID.randomUUID().toString();
        var category = business(
            "POST",
            "/api/v1/admin/categories",
            Map.of("name", "Link " + suffix),
            admin.access()
        );
        long categoryId = category.get("id").asLong();
        var free = business(
            "POST",
            "/api/v1/admin/courses",
            Map.of(
                "title",
                "Link free " + suffix,
                "description",
                "Disposable link integration",
                "categoryId",
                categoryId,
                "price",
                0,
                "level",
                "BEGINNER",
                "status",
                "PUBLISHED"
            ),
            admin.access()
        );
        var paid = business(
            "POST",
            "/api/v1/admin/courses",
            Map.of(
                "title",
                "Link paid " + suffix,
                "description",
                "Disposable link integration",
                "categoryId",
                categoryId,
                "price",
                100000,
                "level",
                "BEGINNER",
                "status",
                "PUBLISHED"
            ),
            admin.access()
        );
        long courseId = free.get("id").asLong();
        var section = business(
            "POST",
            "/api/v1/admin/courses/" + courseId + "/sections",
            Map.of("title", "Chapter", "orderIndex", 0),
            admin.access()
        );
        var lesson = business(
            "POST",
            "/api/v1/admin/sections/" + section.get("id").asLong() + "/lessons",
            Map.of(
                "title",
                "Lesson",
                "lessonType",
                "TEXT",
                "content",
                "Private lesson",
                "duration",
                60,
                "orderIndex",
                0,
                "preview",
                false
            ),
            admin.access()
        );
        business("POST", "/api/v1/learning/enrollments", Map.of("courseId", courseId), local.access());
        String progressPath = "/api/v1/learning/progress/courses/" + courseId;
        String lessonPath = progressPath + "/lessons/" + lesson.get("id").asLong();
        business("POST", lessonPath + "/access", Map.of(), local.access());
        business("PATCH", lessonPath + "/complete", Map.of(), local.access());
        var checkout = business(
            "POST",
            "/api/v1/payments/checkout",
            Map.of("courseId", paid.get("id").asLong(), "provider", "MOCK", "idempotencyKey", suffix),
            local.access()
        );
        business(
            "POST",
            "/api/v1/payments/mock/orders/" + checkout.get("orderCode").asString() + "/complete",
            Map.of("status", "SUCCESS", "providerTransactionCode", suffix),
            local.access()
        );
        List<String> paths = List.of(
            "/api/v1/learning/enrollments/me",
            progressPath,
            "/api/v1/payments/history",
            "/api/v1/courses/" + courseId + "/sections"
        );
        Map<String, JsonNode> before = new LinkedHashMap<>();
        for (String path : paths) before.put(path, business("GET", path, null, local.access()));
        assertThat(before.get(paths.get(0)).size()).isEqualTo(2);
        assertThat(before.get(progressPath).get(0).get("status").asString()).isEqualTo("COMPLETED");
        assertThat(before.get("/api/v1/payments/history").toString()).contains(
            checkout.get("orderCode").asString()
        );

        String subject = UUID.randomUUID().toString();
        assertThat(completeLink(local, linkCode(local, subject), VERIFIER).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/auth/logout", Map.of(), local.cookie(), null).statusCode()).isEqualTo(
            200
        );
        var googleLogin = data(exchange(loginCode(subject, local.email()), VERIFIER));
        var passwordLogin = data(
            request("/api/v1/auth/login", new LoginRequest(local.email(), PASSWORD), null, null)
        );
        assertThat(googleLogin.get("user")).isEqualTo(passwordLogin.get("user"));
        assertThat(googleLogin.get("user").get("id").asLong()).isEqualTo(local.id());
        for (JsonNode login : List.of(googleLogin, passwordLogin)) {
            for (String path : paths)
                assertThat(business("GET", path, null, login.get("accessToken").asString()))
                    .as("Ownership retained for %s", path)
                    .isEqualTo(before.get(path));
        }
    }

    JsonNode business(String method, String path, Object body, String bearer) throws Exception {
        String[] parts = bearer.split("\\.");
        var claims = JSON.readTree(Base64.getUrlDecoder().decode(parts[1]));
        assertThat(claims.get("iss").asString()).isEqualTo("sgedu");
        var signer = Mac.getInstance("HmacSHA256");
        signer.init(
            new SecretKeySpec(
                System.getenv("GOOGLE_BUSINESS_TEST_JWT_SECRET").getBytes(StandardCharsets.UTF_8),
                "HmacSHA256"
            )
        );
        assertThat(
            MessageDigest.isEqual(
                signer.doFinal((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII)),
                Base64.getUrlDecoder().decode(parts[2])
            )
        )
            .as("Business stack and test Auth must share the signing secret")
            .isTrue();
        var builder = HttpRequest.newBuilder(URI.create(System.getenv("GOOGLE_BUSINESS_GATEWAY_URL") + path))
            .timeout(Duration.ofSeconds(20))
            .header("Authorization", "Bearer " + bearer);
        if (body == null) builder.method(method, HttpRequest.BodyPublishers.noBody());
        else builder
            .header("Content-Type", "application/json")
            .method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        var response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode())
            .as(
                "Business API %s %s (error code: %s)",
                method,
                path,
                response.statusCode() >= 400 ? JSON.readTree(response.body()).get("code") : "none"
            )
            .isBetween(200, 201);
        return data(response);
    }

    @Test
    void linkEndpointsRequireJwtPasswordAndTheMatchingRefreshSession() throws Exception {
        var local = localSession();
        var other = localSession();
        var input = Map.of("currentPassword", PASSWORD, "challenge", challenge());
        assertThat(request(PREFIX + "/link/start", input, local.cookie(), null).statusCode()).isEqualTo(401);
        assertThat(
            request(
                PREFIX + "/link/complete",
                Map.of("code", "c".repeat(43), "verifier", VERIFIER),
                local.cookie(),
                null
            ).statusCode()
        ).isEqualTo(401);
        assertThat(request("/api/v1/users/me/linked-accounts", null, null, null).statusCode()).isEqualTo(401);
        var wrong = request(
            PREFIX + "/link/start",
            Map.of("currentPassword", "WrongPassword9!", "challenge", challenge()),
            local.cookie(),
            local.access()
        );
        assertThat(wrong.statusCode()).isEqualTo(400);
        assertThat(wrong.body()).contains("GOOGLE_LINK_PASSWORD_INVALID");
        for (String cookie : Arrays.asList(null, other.cookie())) {
            var missing = request(PREFIX + "/link/start", input, cookie, local.access());
            assertThat(missing.statusCode()).isEqualTo(409);
            assertThat(missing.body()).contains("GOOGLE_LINK_SESSION_INVALID");
        }
        assertThat(request("/api/v1/users/me", null, null, local.access()).statusCode()).isEqualTo(200);
    }

    @Test
    void linkRequiresMatchingVerifiedEmailAndNeverCreatesUsersAtCallback() throws Exception {
        var local = localSession();
        long count = users.count();
        String mismatch = callback(beginLink(local), UUID.randomUUID().toString(), email(), Map.of());
        assertThat(mismatch).contains("error=GOOGLE_LINK_EMAIL_MISMATCH", "flow=link");
        String unverified = callback(
            beginLink(local),
            UUID.randomUUID().toString(),
            local.email(),
            Map.of("email_verified", false)
        );
        assertThat(unverified).contains("error=GOOGLE_IDENTITY_INVALID", "flow=link");
        assertThat(users.count()).isEqualTo(count);
        assertThat(identities.findByUserIdAndProvider(local.id(), "GOOGLE")).isEmpty();
        assertThat(request("/api/v1/users/me", null, null, local.access()).statusCode()).isEqualTo(200);
    }

    @Test
    void identityCannotMoveBetweenUsersAndEachUserHasAtMostOneGoogle() throws Exception {
        String ownedSubject = UUID.randomUUID().toString();
        var googleOwner = exchange(loginCode(ownedSubject, email()), VERIFIER);
        long ownerId = data(googleOwner).get("user").get("id").asLong();
        var local = localSession();
        var conflict = completeLink(local, linkCode(local, ownedSubject), VERIFIER);
        assertThat(conflict.statusCode()).isEqualTo(409);
        assertThat(conflict.body()).contains("GOOGLE_IDENTITY_IN_USE");
        assertThat(
            identities
                .findByProviderAndProviderSubject("GOOGLE", ownedSubject)
                .orElseThrow()
                .getUser()
                .getId()
        ).isEqualTo(ownerId);
        String first = UUID.randomUUID().toString();
        assertThat(completeLink(local, linkCode(local, first), VERIFIER).statusCode()).isEqualTo(200);
        var second = completeLink(local, linkCode(local, UUID.randomUUID().toString()), VERIFIER);
        assertThat(second.statusCode()).isEqualTo(409);
        assertThat(second.body()).contains("GOOGLE_ACCOUNT_ALREADY_LINKED");
        assertThat(
            identities.findByUserIdAndProvider(local.id(), "GOOGLE").orElseThrow().getProviderSubject()
        ).isEqualTo(first);
    }

    @Test
    void loginAndLinkCodesCannotBeUsedAcrossPurposesOrAccounts() throws Exception {
        var local = localSession();
        var other = localSession();
        String login = loginCode(UUID.randomUUID().toString(), email());
        assertThat(completeLink(local, login, VERIFIER).statusCode()).isEqualTo(400);
        assertThat(exchange(login, VERIFIER).statusCode()).isEqualTo(200);
        String link = linkCode(local, UUID.randomUUID().toString());
        assertThat(exchange(link, VERIFIER).statusCode()).isEqualTo(401);
        assertThat(completeLink(other, link, VERIFIER).statusCode()).isEqualTo(409);
        assertThat(completeLink(localLogin(local.email(), PASSWORD), link, VERIFIER).statusCode()).isEqualTo(
            409
        );
        assertThat(completeLink(local, link, VERIFIER).statusCode()).isEqualTo(200);
        assertThat(identities.findByUserIdAndProvider(other.id(), "GOOGLE")).isEmpty();
    }

    @Test
    void normalRotationPreservesTheInitiatingLinkSession() throws Exception {
        var local = localSession();
        var started = beginLink(local);
        var rotated = request("/api/v1/auth/refresh", Map.of(), local.cookie(), null);
        assertThat(rotated.statusCode()).isEqualTo(200);
        String cookie = rotated.headers().firstValue("Set-Cookie").orElseThrow().split(";", 2)[0];
        var active = new LocalSession(
            local.id(),
            local.email(),
            data(rotated).get("accessToken").asString(),
            cookie
        );
        var afterRotation = new Start(
            started.state(),
            started.nonce(),
            cookie + "; " + started.cookie().split("; ", 2)[1]
        );
        String location = callback(afterRotation, UUID.randomUUID().toString(), local.email(), Map.of());
        String code = parameters(URI.create(location).getRawQuery()).get("code");
        assertThat(completeLink(active, code, VERIFIER).statusCode()).isEqualTo(200);
    }

    @Test
    void logoutAndPasswordChangesInvalidatePendingLinkWithoutCreatingAnotherSession() throws Exception {
        var local = localSession();
        String code = linkCode(local, UUID.randomUUID().toString());
        assertThat(request("/api/v1/auth/logout", Map.of(), local.cookie(), null).statusCode()).isEqualTo(
            200
        );
        assertThat(completeLink(local, code, VERIFIER).statusCode()).isEqualTo(409);
        var signedInAgain = localLogin(local.email(), PASSWORD);
        assertThat(completeLink(signedInAgain, code, VERIFIER).statusCode()).isEqualTo(400);
        String beforePasswordChange = linkCode(signedInAgain, UUID.randomUUID().toString());
        assertThat(
            request(
                "/api/v1/users/change-password",
                Map.of("currentPassword", PASSWORD, "newPassword", "ChangedPassword9!"),
                null,
                signedInAgain.access(),
                "PUT"
            ).statusCode()
        ).isEqualTo(200);
        assertThat(completeLink(signedInAgain, beforePasswordChange, VERIFIER).statusCode()).isEqualTo(400);
        assertThat(users.findById(local.id()).orElseThrow().getCredentialVersion()).isEqualTo(1);
        assertThat(localLogin(local.email(), "ChangedPassword9!").id()).isEqualTo(local.id());
        assertThat(identities.findByUserIdAndProvider(local.id(), "GOOGLE")).isEmpty();
    }

    @Test
    void cancelledOrInvalidLinkOidcDoesNotEndTheLocalSession() throws Exception {
        var local = localSession();
        var cancel = beginLink(local);
        var response = request(
            PREFIX + "/callback/google?state=" + cancel.state() + "&error=access_denied",
            null,
            cancel.cookie(),
            null
        );
        assertThat(response.headers().firstValue("Location").orElseThrow()).contains(
            "GOOGLE_LOGIN_CANCELLED",
            "flow=link"
        );
        assertThat(
            callback(beginLink(local), UUID.randomUUID().toString(), local.email(), Map.of("nonce", "wrong"))
        ).contains("GOOGLE_LOGIN_FAILED", "flow=link");
        var state = beginLink(local);
        var wrong = request(PREFIX + "/callback/google?state=wrong&code=unused", null, state.cookie(), null);
        assertThat(wrong.headers().firstValue("Location").orElseThrow()).contains(
            "GOOGLE_LOGIN_FAILED",
            "flow=link"
        );
        assertThat(request("/api/v1/users/me", null, null, local.access()).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/auth/refresh", Map.of(), local.cookie(), null).statusCode()).isEqualTo(
            200
        );
        assertThat(identities.findByUserIdAndProvider(local.id(), "GOOGLE")).isEmpty();
    }

    @Test
    void linkChecksStatusAgainBeforeCallbackAndCompletion() throws Exception {
        for (String status : List.of("LOCKED", "DISABLED", "DELETED")) {
            var local = localSession();
            String code = linkCode(local, UUID.randomUUID().toString());
            var start = beginLink(local);
            jdbc.update(
                "UPDATE users SET status = ?, deleted_at = ? WHERE id = ?",
                status.equals("DELETED") ? "ACTIVE" : status,
                status.equals("DELETED") ? Timestamp.from(Instant.now()) : null,
                local.id()
            );
            var response = completeLink(local, code, VERIFIER);
            assertThat(response.statusCode()).isEqualTo(403);
            assertThat(callback(start, UUID.randomUUID().toString(), local.email(), Map.of())).contains(
                status.equals("LOCKED") ? "ACCOUNT_LOCKED" : "ACCOUNT_DISABLED"
            );
            assertThat(identities.findByUserIdAndProvider(local.id(), "GOOGLE")).isEmpty();
        }
    }

    @Test
    void linkRejectsWrongVerifierExpiredConfirmationAndExpiredCode() throws Exception {
        var local = localSession();
        String code = linkCode(local, UUID.randomUUID().toString());
        assertThat(completeLink(local, code, "x".repeat(43)).statusCode()).isEqualTo(400);
        jdbc.update(
            "UPDATE oauth_login_codes SET expires_at = ? WHERE user_id = ? AND purpose = 'LINK'",
            Timestamp.from(Instant.now().minusSeconds(120)),
            local.id()
        );
        assertThat(completeLink(local, code, VERIFIER).statusCode()).isEqualTo(400);
        var start = beginLink(local);
        jdbc.update(
            "UPDATE google_link_intents SET expires_at = ? WHERE user_id = ?",
            Timestamp.from(Instant.now().minusSeconds(1)),
            local.id()
        );
        assertThat(callback(start, UUID.randomUUID().toString(), local.email(), Map.of())).contains(
            "GOOGLE_LINK_EXPIRED",
            "flow=link"
        );
        assertThat(identities.findByUserIdAndProvider(local.id(), "GOOGLE")).isEmpty();
    }

    @Test
    void concurrentLinkCompletionIsAtomicAndCannotCreateTwoIdentities() throws Exception {
        var local = localSession();
        String code = linkCode(local, UUID.randomUUID().toString());
        var first = CompletableFuture.supplyAsync(() -> completeUnchecked(local, code));
        var second = CompletableFuture.supplyAsync(() -> completeUnchecked(local, code));
        assertThat(List.of(first.join(), second.join())).containsExactlyInAnyOrder(200, 400);
        assertThat(completeLink(local, code, VERIFIER).statusCode()).isEqualTo(400);
        var another = localSession();
        String code1 = linkCode(another, UUID.randomUUID().toString());
        String code2 = linkCode(another, UUID.randomUUID().toString());
        var one = CompletableFuture.supplyAsync(() -> completeUnchecked(another, code1));
        var two = CompletableFuture.supplyAsync(() -> completeUnchecked(another, code2));
        assertThat(List.of(one.join(), two.join())).containsExactlyInAnyOrder(200, 409);
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_external_identities WHERE user_id = ?",
                Long.class,
                another.id()
            )
        ).isEqualTo(1L);
    }

    int completeUnchecked(LocalSession local, String code) {
        try {
            return completeLink(local, code, VERIFIER).statusCode();
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }
}
