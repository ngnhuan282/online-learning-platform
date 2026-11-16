package com.elearning.payment;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.learning.LearningEnrollmentClient;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.datasource.url=jdbc:h2:mem:proPayments;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "security.jwt.secret=pro-payment-integration-secret-at-least-32-bytes",
        "payment.mock-enabled=true",
        "logging.level.root=WARN",
    }
)
@ActiveProfiles("test")
class ProPaymentIntegrationTests {

    private static final String SECRET = "pro-payment-integration-secret-at-least-32-bytes";

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JsonMapper json;

    @MockitoBean
    LearningEnrollmentClient learning;

    @BeforeEach
    void setup() {
        jdbc.update("DELETE FROM payment_transactions");
        jdbc.update("DELETE FROM payments");
        jdbc.update("DELETE FROM order_items");
        jdbc.update("DELETE FROM orders");
    }

    @Test
    void proCatalogAndCheckoutUseServerPriceAndProductSnapshot() throws Exception {
        var catalog = request(1, false, "GET", "/pro/plans", null);
        assertThat(catalog.statusCode()).isEqualTo(200);
        assertThat(json.readTree(catalog.body()).path("data").get(0).path("price").asInt()).isEqualTo(50000);
        String key = UUID.randomUUID().toString();
        JsonNode order = checkout(1, "PRO_YEAR", key);
        assertThat(order.path("order").path("productType").asString()).isEqualTo("PRO");
        assertThat(order.path("order").path("totalAmount").asInt()).isEqualTo(499000);
        assertThat(order.path("order").path("items").get(0).path("courseId").isNull()).isTrue();
        assertThat(checkout(1, "PRO_YEAR", key).path("orderCode").asString()).isEqualTo(
            order.path("orderCode").asString()
        );
        assertThat(
            request(1, false, "POST", "/pro/checkout", checkoutBody("PRO_MONTH", key)).statusCode()
        ).isEqualTo(409);
        assertThat(
            request(
                1,
                false,
                "POST",
                "/checkout",
                "{\"courseId\":10,\"provider\":\"MOCK\",\"idempotencyKey\":\"" + key + "\"}"
            ).statusCode()
        ).isEqualTo(409);
        assertThat(
            request(2, false, "GET", "/orders/" + order.path("orderCode").asString(), null).statusCode()
        ).isEqualTo(403);
        assertThat(jdbc.queryForObject("SELECT plan_duration_months FROM orders", Integer.class)).isEqualTo(
            12
        );
        verifyNoInteractions(learning);
    }

    @Test
    void concurrentCheckoutRetriesCreateOneOrder() throws Exception {
        String key = UUID.randomUUID().toString();
        try (var pool = Executors.newFixedThreadPool(6)) {
            var tasks = java.util.stream.IntStream.range(0, 8)
                .mapToObj(i ->
                    pool.submit(() -> checkout(2, "PRO_QUARTER", key).path("orderCode").asString())
                )
                .toList();
            var codes = new java.util.HashSet<String>();
            for (var task : tasks) codes.add(task.get(15, TimeUnit.SECONDS));
            assertThat(codes).hasSize(1);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM orders WHERE user_id=2", Long.class)).isEqualTo(
            1
        );
        assertThat(
            jdbc.queryForObject("SELECT total_amount FROM orders WHERE user_id=2", java.math.BigDecimal.class)
        ).isEqualByComparingTo("120000");
    }

    @Test
    void successfulMockPaymentGrantsProAndRefundRevokesItsReceipt() throws Exception {
        String order = checkout(3, "PRO_MONTH", UUID.randomUUID().toString()).path("orderCode").asString();
        assertThat(
            request(
                3,
                false,
                "POST",
                "/mock/orders/" + order + "/complete",
                "{\"status\":\"SUCCESS\"}"
            ).statusCode()
        ).isEqualTo(200);
        assertThat(
            request(
                3,
                false,
                "POST",
                "/mock/orders/" + order + "/complete",
                "{\"status\":\"SUCCESS\"}"
            ).statusCode()
        ).isEqualTo(200);
        verify(learning, atLeastOnce()).grantPro(order, 3L, "PRO_MONTH", 1);
        verify(learning, never()).enroll(anyString(), anyLong(), anyLong());
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM payment_transactions WHERE status='SUCCESS'",
                Long.class
            )
        ).isEqualTo(1);
        assertThat(
            request(
                8,
                true,
                "PATCH",
                "/admin/orders/" + order + "/status",
                "{\"status\":\"REFUNDED\"}"
            ).statusCode()
        ).isEqualTo(200);
        verify(learning).revokePro(order, 3L);
    }

    @Test
    void failuresNeverGrantProAndUnavailableActivationIsRetryable() throws Exception {
        String failed = checkout(4, "PRO_MONTH", UUID.randomUUID().toString()).path("orderCode").asString();
        assertThat(
            request(
                4,
                false,
                "POST",
                "/mock/orders/" + failed + "/complete",
                "{\"status\":\"FAILED\"}"
            ).statusCode()
        ).isEqualTo(200);
        verifyNoInteractions(learning);
        String order = checkout(4, "PRO_QUARTER", UUID.randomUUID().toString()).path("orderCode").asString();
        doThrow(new AppException(ErrorCode.SERVICE_UNAVAILABLE))
            .doNothing()
            .when(learning)
            .grantPro(order, 4L, "PRO_QUARTER", 3);
        assertThat(
            request(
                4,
                false,
                "POST",
                "/mock/orders/" + order + "/complete",
                "{\"status\":\"SUCCESS\"}"
            ).statusCode()
        ).isEqualTo(503);
        assertThat(
            json
                .readTree(request(4, false, "GET", "/orders/" + order, null).body())
                .path("data")
                .path("payment")
                .path("status")
                .asString()
        ).isEqualTo("PENDING");
        assertThat(
            request(
                4,
                false,
                "POST",
                "/mock/orders/" + order + "/complete",
                "{\"status\":\"SUCCESS\"}"
            ).statusCode()
        ).isEqualTo(200);
    }

    private JsonNode checkout(long user, String plan, String key) throws Exception {
        var response = request(user, false, "POST", "/pro/checkout", checkoutBody(plan, key));
        assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(200);
        return json.readTree(response.body()).path("data");
    }

    private String checkoutBody(String plan, String key) {
        return (
            "{\"planCode\":\"" +
            plan +
            "\",\"provider\":\"MOCK\",\"idempotencyKey\":\"" +
            key +
            "\",\"amount\":1,\"durationMonths\":999}"
        );
    }

    private HttpResponse<String> request(long user, boolean admin, String method, String path, String body)
        throws Exception {
        Instant now = Instant.now();
        String token = Jwts.builder()
            .subject(Long.toString(user))
            .issuer("sgedu")
            .claim("role", admin ? "ADMIN" : "USER")
            .claim("tokenType", "access")
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(300)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();
        var request = HttpRequest.newBuilder(
            URI.create("http://localhost:" + port + "/api/v1/payments" + path)
        )
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .method(
                method,
                body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)
            )
            .build();
        return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
    }
}
