package com.elearning.payment;

import static org.assertj.core.api.Assertions.*;

import com.elearning.payment.dto.ProPaymentModels;
import com.elearning.payment.entity.enums.PaymentProvider;
import com.elearning.payment.service.*;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.datasource.url=jdbc:h2:mem:pro_plan_admin;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "security.jwt.secret=pro-plan-admin-integration-test-secret-32-bytes",
        "payment.mock-enabled=true",
        "logging.level.root=WARN",
    }
)
@ActiveProfiles("test")
class ProPlanAdminIntegrationTests {

    static final String SECRET = "pro-plan-admin-integration-test-secret-32-bytes";

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JsonMapper json;

    @Autowired
    ProPlanService plans;

    @Autowired
    PaymentCheckoutService checkout;

    @BeforeEach
    void setup() {
        jdbc.update("UPDATE pro_plans SET price=50000,active=TRUE,version=0 WHERE code='PRO_MONTH'");
        jdbc.update("DELETE FROM payment_admin_audit");
    }

    private String token(String role, String... permissions) {
        return Jwts.builder()
            .subject("91")
            .issuer("sgedu")
            .claim("tokenType", "access")
            .claim("role", role.equals("ADMIN") ? "ADMIN" : "USER")
            .claim("roles", List.of(role))
            .claim("permissions", List.of(permissions))
            .issuedAt(new Date())
            .expiration(Date.from(Instant.now().plusSeconds(600)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
            .compact();
    }

    private HttpResponse<String> request(String method, String path, String token, Object body)
        throws Exception {
        return HttpClient.newHttpClient().send(
            HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/payments/admin" + path))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .method(
                    method,
                    body == null
                        ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))
                )
                .build(),
            HttpResponse.BodyHandlers.ofString()
        );
    }

    private Map<String, Object> update(int price, boolean active, long version) {
        return Map.of(
            "name",
            "Monthly Pro",
            "price",
            price,
            "active",
            active,
            "version",
            version,
            "reason",
            "new price policy"
        );
    }

    @Test
    void readAndUpdatePermissionsAreDistinctAndLearnerCannotUseClaimedPermissions() throws Exception {
        assertThat(
            request("GET", "/pro/plans", token("USER", "ADMIN_ACCESS", "PRO_PLAN_VIEW"), null).statusCode()
        ).isEqualTo(403);
        String viewer = token("SUPPORT", "ADMIN_ACCESS", "PRO_PLAN_VIEW");
        assertThat(request("GET", "/pro/plans", viewer, null).statusCode()).isEqualTo(200);
        assertThat(
            request("PUT", "/pro/plans/PRO_MONTH", viewer, update(60000, true, 0)).statusCode()
        ).isEqualTo(403);
        assertThat(
            request(
                "PUT",
                "/pro/plans/PRO_MONTH",
                token("SUPPORT", "ADMIN_ACCESS", "PRO_PLAN_VIEW", "PRO_PLAN_UPDATE"),
                update(60000, true, 0)
            ).statusCode()
        ).isEqualTo(200);
        assertThat(plans.requirePlan("PRO_MONTH").price()).isEqualByComparingTo("60000");
    }

    @Test
    void oldOrderKeepsPriceAndInactivePlanCannotBePurchased() throws Exception {
        String key = UUID.randomUUID().toString();
        var order = checkout.createProCheckout(
            new ProPaymentModels.CheckoutRequest("PRO_MONTH", PaymentProvider.MOCK, key, null, null),
            91L,
            "127.0.0.1"
        );
        assertThat(
            request("PUT", "/pro/plans/PRO_MONTH", token("ADMIN"), update(65000, false, 0)).statusCode()
        ).isEqualTo(200);
        assertThat(
            jdbc.queryForObject(
                "SELECT total_amount FROM orders WHERE order_code=?",
                java.math.BigDecimal.class,
                order.orderCode()
            )
        ).isEqualByComparingTo("50000");
        assertThat(
            plans
                .plans()
                .stream()
                .anyMatch(p -> p.code().equals("PRO_MONTH"))
        ).isFalse();
        assertThatThrownBy(() ->
            checkout.createProCheckout(
                new ProPaymentModels.CheckoutRequest(
                    "PRO_MONTH",
                    PaymentProvider.MOCK,
                    UUID.randomUUID().toString(),
                    null,
                    null
                ),
                92L,
                "127.0.0.1"
            )
        ).isInstanceOf(com.elearning.payment.common.exception.AppException.class);
        assertThat(
            request("PUT", "/pro/plans/PRO_MONTH", token("ADMIN"), update(70000, true, 0)).statusCode()
        ).isEqualTo(409);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM payment_admin_audit", Integer.class)).isEqualTo(
            1
        );
    }

    @Test
    void invalidPriceAndMissingReasonAreRejected() throws Exception {
        assertThat(
            request("PUT", "/pro/plans/PRO_MONTH", token("ADMIN"), update(0, true, 0)).statusCode()
        ).isEqualTo(400);
        assertThat(
            request(
                "PUT",
                "/pro/plans/PRO_MONTH",
                token("ADMIN"),
                Map.of("name", "Monthly", "price", 50000, "active", true, "version", 0)
            ).statusCode()
        ).isEqualTo(400);
        assertThat(
            request("GET", "/audit", token("SUPPORT", "ADMIN_ACCESS", "PRO_PLAN_VIEW"), null).statusCode()
        ).isEqualTo(403);
    }
}
