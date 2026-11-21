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
    static volatile boolean dependencyUp = true;

    static HttpServer upstream() {
        try {
            var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", exchange -> {
                if (exchange.getRequestURI().getPath().equals("/actuator/health/readiness")) {
                    byte[] health = "{\"status\":\"UP\"}".getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(dependencyUp ? 200 : 503, health.length);
                    try (var body = exchange.getResponseBody()) { body.write(health); }
                    return;
                }
                String result = (exchange.getRequestHeaders().getFirst("X-Internal-Service-Token") == null
                        ? exchange.getRequestURI().getPath() : "internal-header-was-not-stripped") +
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
                .issuer("sgedu")
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
    void checkHealth_whenBusinessServicesAreOffline_shouldStartGatewayAndReportLiveness() throws Exception {
        // Arrange
        // Act

        var actualStatusCode = request("/actuator/health", null, "GET", null).statusCode();

        // Assert
        assertThat(actualStatusCode).isEqualTo(200);
        assertThat(request("/v3/api-docs", null, "GET", null).body()).startsWith("/v3/api-docs|");
    }

    @Test
    void checkReadiness_whenDependencyBecomesUnavailable_shouldReportNotReadyWithoutExposingDetails() throws Exception {
        // Arrange

        // Act
        assertThat(request("/actuator/health/readiness", null, "GET", null).statusCode()).isEqualTo(200);
        // Assert
        dependencyUp = false;
        try {
            var readiness = request("/actuator/health/readiness", null, "GET", null);
            assertThat(readiness.statusCode()).isEqualTo(503);
            assertThat(mapper.readTree(readiness.body()).has("components")).isFalse();
            assertThat(request("/actuator/health/liveness", null, "GET", null).statusCode()).isEqualTo(200);
        } finally {
            dependencyUp = true;
        }
    }

    @Test
    void routeRequest_whenRequestsUseSupportedNamespaces_shouldForwardToServicesAndRemoveSpoofedHeaders() throws Exception {
        // Arrange

        for (String namespace : new String[] { "auth", "users", "courses", "learning", "payments", "ai" }) {
            String path = "/api/v1/" + namespace + "/probe";
            // Act
            var response = request(path, token(60), "GET", null);

            // Assert
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.body()).isEqualTo(path + "|null|null|null|true");
            assertThat(response.headers().firstValue("X-Request-ID")).isPresent();
        }
    }

    @Test
    void filter_whenPaymentRequestRequiresAuthentication_shouldForwardOnlyValidatedAuthorization() throws Exception {
        // Arrange
        String path = "/api/v1/payments/history";
        // Act
        assertThat(request(path, null, "GET", null).statusCode()).isEqualTo(401);
        assertThat(request(path, "broken", "GET", null).statusCode()).isEqualTo(401);
        assertThat(request(path, token(-60), "GET", null).statusCode()).isEqualTo(401);

        var response = request(path, token(60), "GET", null);
        // Assert
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).isEqualTo(path + "|null|null|null|true");
        assertThat(response.headers().firstValue("X-Test-Payment-Client-IP"))
            .isPresent().isNotEqualTo(java.util.Optional.of("203.0.113.99"));
    }

    @Test
    void filter_whenGuestRequestsApi_shouldPermitOnlyPublicOperations() throws Exception {
        // Arrange
        // Act

        var actualStatusCode = request("/api/v1/auth/login", null, "POST", null).statusCode();

        // Assert
        assertThat(actualStatusCode).isEqualTo(200);
        assertThat(request("/api/v1/auth/register", null, "POST", null).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/courses", null, "GET", null).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/auth/private", null, "GET", null).statusCode()).isEqualTo(401);
        assertThat(request("/api/v1/courses", null, "POST", null).statusCode()).isEqualTo(401);
        assertThat(request("/api/v1/courses/1/lessons", null, "GET", null).statusCode()).isEqualTo(401);
    }

    @Test
    void filter_whenRequestTargetsVnpayCallback_shouldRequireExplicitPathAndGetMethod() throws Exception {
        // Arrange
        // Act
        for (String suffix : new String[] {"return", "ipn"}) {
            String path = "/api/v1/payments/vnpay/" + suffix;
            var result = request(path + "?vnp_Amount=1&vnp_SecureHash=invalid", null, "GET", null);
            assertThat(result.statusCode()).isEqualTo(200);
            assertThat(result.body()).isEqualTo(path + "|null|null|null|false");
            assertThat(request(path, null, "POST", null).statusCode()).isEqualTo(401);
            assertThat(request(path + "/private", null, "GET", null).statusCode()).isEqualTo(401);
        }
        // Assert
        assertThat(request("/api/v1/payments/checkout", null, "POST", null).statusCode()).isEqualTo(401);
        assertThat(request("/api/v1/payments/admin/analytics", null, "GET", null).statusCode()).isEqualTo(401);
    }

    @Test
    void routeRequest_whenMediaRequestHasValidToken_shouldForwardLessonAndResourceRequests() throws Exception {
        // Arrange
        // Act
        String adminToken = token(60);

        // Assert
        assertThat(request("/api/v1/media/download/documents/test.txt", null, "GET", null).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/lessons/42/resources", null, "GET", null).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/admin/media/upload", adminToken, "POST", null).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/admin/lessons/42/resources", adminToken, "POST", null).statusCode()).isEqualTo(200);
    }

    @Test
    void handleException_whenAuthenticationFails_shouldReturnSafeErrorWithCorsHeaders() throws Exception {
        // Arrange

        for (String jwt : new String[] { "broken", token(-60) }) {
            var response = request("/api/v1/users/me", jwt, "GET", "http://localhost:5173");
            assertThat(response.statusCode()).isEqualTo(401);
            // Act
            var json = mapper.readTree(response.body());

            // Assert
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
    void routeRequest_whenRequestIsPreflightOrUnmapped_shouldReturnCorsOrNotFound() throws Exception {
        // Arrange
        var preflight = request("/api/v1/users/me", null, "OPTIONS", "http://localhost:5173");
        // Act
        assertThat(preflight.statusCode()).isEqualTo(200);
        assertThat(preflight.headers().firstValue("X-Request-ID")).isPresent();
        var rejected = request("/api/v1/users/me", null, "OPTIONS", "https://untrusted.example");
        assertThat(rejected.statusCode()).isEqualTo(403);
        assertThat(mapper.readTree(rejected.body()).get("code").asString()).isEqualTo("FORBIDDEN");
        var missing = request("/api/v1/unknown", token(60), "GET", null);
        // Assert
        assertThat(missing.statusCode()).isEqualTo(404);
        assertThat(mapper.readTree(missing.body()).get("code").asString()).isEqualTo("NOT_FOUND");
    }

    @Test
    void filter_whenAuthCookieEndpointHasNoValidAccessToken_shouldAllowCookieOperationsAndCredentialCors() throws Exception {
        // Arrange
        // Act
        for (String path : new String[] { "/api/v1/auth/refresh", "/api/v1/auth/logout",
            "/api/v1/auth/forgot-password", "/api/v1/auth/reset-password",
            "/api/v1/auth/google/start", "/api/v1/auth/google/exchange" }) {
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
        // Assert
        assertThatThrownBy(config::validateAllowCredentials).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void filter_whenRequestTargetsGoogleBrowserEndpoint_shouldMatchOnlyExplicitPublicEndpoints() throws Exception {
        // Arrange
        // Act
        for (String path : List.of(
            "/api/v1/auth/google/authorize/google",
            "/api/v1/auth/google/callback/google"
        )) {
            var response = request(path, null, "GET", null);
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.body()).startsWith(path + "|null|null|null|false");
            assertThat(request(path, null, "POST", null).statusCode()).isEqualTo(401);
        }
        // Assert
        assertThat(request("/api/v1/auth/google/private", null, "GET", null).statusCode()).isEqualTo(401);
    }

    @Test
    void filter_whenGuestRequestsGoogleLinkOrMethodStatus_shouldRequireValidToken() throws Exception {
        // Arrange

        for (String path : List.of("/api/v1/auth/google/link/start", "/api/v1/auth/google/link/complete",
            "/api/v1/users/me/linked-accounts")) {
            // Act
            String method = path.endsWith("linked-accounts") ? "GET" : "POST";

            // Assert
            assertThat(request(path, null, method, null).statusCode()).isEqualTo(401);
            assertThat(request(path, token(60), method, null).statusCode()).isEqualTo(200);
        }
    }
}
