package com.elearning.gateway;

import static org.assertj.core.api.Assertions.*;

import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.Duration;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.cors.CorsConfiguration;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ApiGatewayApplicationTests {

    static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();
    static final HttpServer upstream = upstream();

    static HttpServer upstream() {
        try {
            var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", exchange -> {
                String result = exchange.getRequestURI().getPath() +
                        "|" +
                        exchange.getRequestHeaders().getFirst("X-User-Id") +
                        "|" +
                        exchange.getRequestHeaders().getFirst("X-User-Role") +
                        "|" +
                        exchange.getRequestHeaders().getFirst("X-User-Roles") +
                        "|" +
                        (exchange.getRequestHeaders().getFirst("Authorization") != null);
                byte[] bytes = result.getBytes(StandardCharsets.UTF_8);
                String clientIp = exchange.getRequestHeaders().getFirst("X-Payment-Client-IP");
                if (clientIp != null) exchange.getResponseHeaders().add("X-Test-Payment-Client-IP", clientIp);
                exchange.sendResponseHeaders(200, bytes.length);
                try (var body = exchange.getResponseBody()) {
                    body.write(bytes);
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
        upstream.stop(0);
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
        for (String service : new String[] { "AUTH", "COURSE", "LEARNING", "PAYMENT", "AI" }) {
            registry.add(
                    service + "_SERVICE_URL",
                    () -> "http://127.0.0.1:" + upstream.getAddress().getPort());
        }
    }

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper mapper;

    final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    String token(long seconds) {
        return Jwts.builder()
                .subject("user")
                .issuer("learnsphere")
                .claim("role", "USER")
                .claim("tokenType", "access")
                .issuedAt(Date.from(Instant.now().minusSeconds(120)))
                .expiration(Date.from(Instant.now().plusSeconds(seconds)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();
    }

    HttpResponse<String> request(String path, String token, String method, String origin) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).header(
                "X-User-Id",
                "spoofed")
                .header("X-User-Role", "ADMIN")
                .header("X-User-Roles", "ADMIN,PAYMENT_REPORT_VIEW");
        request.header("X-Payment-Client-IP", "203.0.113.99");
        request.timeout(Duration.ofSeconds(15));
        if (token != null)
            request.header("Authorization", "Bearer " + token);
        if (origin != null)
            request.header("Origin", origin);
        if (method.equals("OPTIONS"))
            request
                    .header("Access-Control-Request-Method", "POST")
                    .header("Access-Control-Request-Headers", "authorization,content-type");
        request.method(method, HttpRequest.BodyPublishers.noBody());
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void startsWithoutBusinessServicesOrDatabase() throws Exception {
        assertThat(request("/actuator/health", null, "GET", null).statusCode()).isEqualTo(200);
        assertThat(request("/v3/api-docs", null, "GET", null).body()).startsWith("/v3/api-docs|");
    }

    @Test
    void routesAllSixNamespacesAndStripsSpoofedHeaders() throws Exception {
        for (String namespace : new String[] { "auth", "users", "courses", "learning", "payments", "ai" }) {
            String path = "/api/v1/" + namespace + "/probe";
            var response = request(path, token(60), "GET", null);
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.body()).isEqualTo(path + "|null|null|null|true");
            assertThat(response.headers().firstValue("X-Request-ID")).isPresent();
        }
    }

    @Test
    void protectsPaymentRoutesAndForwardsOnlyValidatedAuthorization() throws Exception {
        String path = "/api/v1/payments/history";
        assertThat(request(path, null, "GET", null).statusCode()).isEqualTo(401);
        assertThat(request(path, "broken", "GET", null).statusCode()).isEqualTo(401);
        assertThat(request(path, token(-60), "GET", null).statusCode()).isEqualTo(401);

        var response = request(path, token(60), "GET", null);
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).isEqualTo(path + "|null|null|null|true");
        assertThat(response.headers().firstValue("X-Test-Payment-Client-IP"))
            .isPresent().isNotEqualTo(java.util.Optional.of("203.0.113.99"));
    }

    @Test
    void permitsOnlyExplicitGuestOperations() throws Exception {
        assertThat(request("/api/v1/auth/login", null, "POST", null).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/auth/register", null, "POST", null).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/courses", null, "GET", null).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/auth/private", null, "GET", null).statusCode()).isEqualTo(401);
        assertThat(request("/api/v1/courses", null, "POST", null).statusCode()).isEqualTo(401);
        assertThat(request("/api/v1/courses/1/lessons", null, "GET", null).statusCode()).isEqualTo(401);
    }

    @Test
    void permitsOnlyExactGetVnpayCallbacksWithoutRelaxingPaymentAuth() throws Exception {
        for (String suffix : new String[] {"return", "ipn"}) {
            String path = "/api/v1/payments/vnpay/" + suffix;
            var result = request(path + "?vnp_Amount=1&vnp_SecureHash=invalid", null, "GET", null);
            assertThat(result.statusCode()).isEqualTo(200);
            assertThat(result.body()).isEqualTo(path + "|null|null|null|false");
            assertThat(request(path, null, "POST", null).statusCode()).isEqualTo(401);
            assertThat(request(path + "/private", null, "GET", null).statusCode()).isEqualTo(401);
        }
        assertThat(request("/api/v1/payments/checkout", null, "POST", null).statusCode()).isEqualTo(401);
        assertThat(request("/api/v1/payments/admin/analytics", null, "GET", null).statusCode()).isEqualTo(401);
    }

    @Test
    void forwardsMediaAndLessonResourceRoutesWithValidAuth() throws Exception {
        String adminToken = token(60);
        assertThat(request("/api/v1/media/download/documents/test.txt", null, "GET", null).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/lessons/42/resources", null, "GET", null).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/admin/media/upload", adminToken, "POST", null).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/admin/lessons/42/resources", adminToken, "POST", null).statusCode()).isEqualTo(200);
    }

    @Test
    void normalizesAuthenticationErrorsWithCors() throws Exception {
        for (String jwt : new String[] { "broken", token(-60) }) {
            var response = request("/api/v1/users/me", jwt, "GET", "http://localhost:5173");
            assertThat(response.statusCode()).isEqualTo(401);
            var json = mapper.readTree(response.body());
            assertThat(json.get("success").asBoolean()).isFalse();
            assertThat(json.get("code").asString()).isEqualTo("UNAUTHORIZED");
            assertThat(json.get("path").asString()).isEqualTo("/api/v1/users/me");
            assertThat(json.has("errors")).isTrue();
            assertThat(json.has("timestamp")).isTrue();
            assertThat(json.has("trace")).isFalse();
            assertThat(response.headers().firstValue("Access-Control-Allow-Origin")).contains(
                    "http://localhost:5173");
        }
    }

    @Test
    void handlesPreflightAndUnknownRoutes() throws Exception {
        var preflight = request("/api/v1/users/me", null, "OPTIONS", "http://localhost:5173");
        assertThat(preflight.statusCode()).isEqualTo(200);
        assertThat(preflight.headers().firstValue("X-Request-ID")).isPresent();
        var rejected = request("/api/v1/users/me", null, "OPTIONS", "https://untrusted.example");
        assertThat(rejected.statusCode()).isEqualTo(403);
        assertThat(mapper.readTree(rejected.body()).get("code").asString()).isEqualTo("FORBIDDEN");
        var missing = request("/api/v1/unknown", token(60), "GET", null);
        assertThat(missing.statusCode()).isEqualTo(404);
        assertThat(mapper.readTree(missing.body()).get("code").asString()).isEqualTo("NOT_FOUND");
    }

    @Test
    void permitsCookieAuthEndpointsWithoutValidAccessAndEnablesCredentialCors() throws Exception {
        for (String path : new String[] { "/api/v1/auth/refresh", "/api/v1/auth/logout" }) {
            for (String access : new String[] { null, "broken", token(-60) }) {
                var response = request(path, access, "POST", "http://localhost:5173");
                assertThat(response.statusCode()).isEqualTo(200);
                assertThat(response.headers().firstValue("Access-Control-Allow-Origin")).contains(
                        "http://localhost:5173");
                assertThat(response.headers().firstValue("Access-Control-Allow-Credentials")).contains(
                        "true");
            }
            assertThat(request(path, null, "GET", null).statusCode()).isEqualTo(401);
            assertThat(request(path, null, "POST", "https://untrusted.example").statusCode()).isEqualTo(403);
        }
        var config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("*"));
        config.setAllowCredentials(true);
        assertThatThrownBy(config::validateAllowCredentials).isInstanceOf(IllegalArgumentException.class);
    }
}
