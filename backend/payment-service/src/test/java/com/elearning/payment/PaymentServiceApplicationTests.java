package com.elearning.payment;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.common.response.ApiResponse;
import com.elearning.payment.common.response.PageResponse;
import com.elearning.payment.course.CourseSnapshot;
import com.elearning.payment.course.CourseSnapshotProvider;
import com.elearning.payment.entity.enums.PaymentStatus;
import com.elearning.payment.learning.LearningEnrollmentClient;
import com.elearning.payment.repository.CourseOrderRepository;
import com.elearning.payment.repository.PaymentRepository;
import com.elearning.payment.security.JwtTokenProvider;
import com.elearning.payment.vnpay.VnpayProperties;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
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
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(PaymentServiceApplicationTests.Probes.class)
class PaymentServiceApplicationTests {

    static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();
    static final String BASE = "/api/v1/_foundation-test";

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
        registry.add("integrations.vnpay.tmn-code", () -> "test-merchant");
        registry.add("integrations.vnpay.hash-secret", () -> "test-vnpay-secret-not-for-responses");
    }

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper mapper;

    @Autowired
    JwtTokenProvider tokens;

    @Autowired
    CourseOrderRepository orders;

    @Autowired
    PaymentRepository payments;

    @Autowired
    VnpayProperties vnpay;

    @MockitoBean
    CourseSnapshotProvider courses;

    @MockitoBean
    LearningEnrollmentClient learning;

    final HttpClient client = HttpClient.newHttpClient();

    @BeforeEach
    void stubCrossServiceContracts() {
        given(courses.requirePurchasableCourse(anyLong())).willAnswer(invocation -> {
            Long courseId = invocation.getArgument(0);
            return switch (courseId.intValue()) {
                case 101 -> new CourseSnapshot(101L, "IELTS Intensive", BigDecimal.valueOf(1_690_000), "VND");
                case 102 -> new CourseSnapshot(
                    102L,
                    "English for Tech",
                    BigDecimal.valueOf(1_290_000),
                    "VND"
                );
                case 103 -> new CourseSnapshot(103L, "TOEIC 850+", BigDecimal.valueOf(1_090_000), "VND");
                default -> throw new AppException(ErrorCode.NOT_FOUND);
            };
        });
        willDoNothing().given(learning).enroll(anyString(), anyLong(), anyLong());
    }

    String token(String role, long seconds) {
        return token(1L, role, List.of(), seconds);
    }

    String token(long userId, String role, long seconds) {
        return token(userId, role, List.of(), seconds);
    }

    String token(long userId, String role, List<String> permissions, long seconds) {
        return Jwts.builder()
            .subject(Long.toString(userId))
            .issuer("sgedu")
            .claim("role", role)
            .claim("permissions", permissions)
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

    HttpResponse<String> patch(String path, String token, String body) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (token != null) builder.header("Authorization", "Bearer " + token);
        builder
            .header("Content-Type", "application/json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(body));
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
    void rejectsAnotherCheckoutForPaidCourseButKeepsOriginalReplayAndOtherUsersAvailable() throws Exception {
        String owner = token(88001L, "USER", 120);
        String body =
            "{\"courseId\":101,\"provider\":\"MOCK\",\"idempotencyKey\":\"paid-course-original-key\"}";
        var first = request("/api/v1/payments/checkout", owner, body);
        assertThat(first.statusCode()).isEqualTo(200);
        String code = mapper.readTree(first.body()).path("data").path("orderCode").asString();
        var paid = request(
            "/api/v1/payments/mock/orders/" + code + "/complete",
            owner,
            "{\"status\":\"SUCCESS\"}"
        );
        assertThat(paid.statusCode()).isEqualTo(200);
        long count = orders.count();

        error(
            request(
                "/api/v1/payments/checkout",
                owner,
                "{\"courseId\":101,\"provider\":\"MOCK\",\"idempotencyKey\":\"paid-course-another-key\"}"
            ),
            409,
            "COURSE_ALREADY_PURCHASED",
            "/api/v1/payments/checkout"
        );
        assertThat(orders.count()).isEqualTo(count);
        var replay = request("/api/v1/payments/checkout", owner, body);
        assertThat(replay.statusCode()).isEqualTo(200);
        assertThat(mapper.readTree(replay.body()).path("data").path("orderCode").asString()).isEqualTo(code);
        assertThat(
            request("/api/v1/payments/checkout", token(88002L, "USER", 120), body).statusCode()
        ).isEqualTo(200);
    }

    @Test
    void snapshotsServerOriginalPriceAndDiscountAndKeepsThemStableOnReplay() throws Exception {
        given(courses.requirePurchasableCourse(101L)).willReturn(
            new CourseSnapshot(
                101L,
                "Discounted English",
                new BigDecimal("490000"),
                "VND",
                new BigDecimal("690000")
            )
        );
        String body =
            "{\"courseId\":101,\"provider\":\"MOCK\",\"idempotencyKey\":\"discount-price-snapshot-key\",\"amount\":1,\"originalPrice\":1,\"discountAmount\":0}";
        String access = token(88003L, "USER", 120);
        var first = request("/api/v1/payments/checkout", access, body);
        assertThat(first.statusCode()).isEqualTo(200);
        JsonNode original = mapper.readTree(first.body()).path("data");
        JsonNode item = original.path("order").path("items").get(0);
        assertThat(item.path("unitPrice").decimalValue()).isEqualByComparingTo("690000");
        assertThat(item.path("discountAmount").decimalValue()).isEqualByComparingTo("200000");
        assertThat(item.path("finalPrice").decimalValue()).isEqualByComparingTo("490000");
        assertThat(original.path("payment").path("amount").decimalValue()).isEqualByComparingTo("490000");

        given(courses.requirePurchasableCourse(101L)).willReturn(
            new CourseSnapshot(
                101L,
                "Updated English",
                new BigDecimal("790000"),
                "VND",
                new BigDecimal("890000")
            )
        );
        var replay = request("/api/v1/payments/checkout", access, body);
        assertThat(replay.statusCode()).isEqualTo(200);
        JsonNode replayItem = mapper.readTree(replay.body()).path("data").path("order").path("items").get(0);
        for (String field : List.of("unitPrice", "discountAmount", "finalPrice")) {
            assertThat(replayItem.path(field).decimalValue()).isEqualByComparingTo(
                item.path(field).decimalValue()
            );
        }
        var detail = request(
            "/api/v1/payments/admin/orders/" + original.path("orderCode").asString(),
            token("ADMIN", 120),
            null
        );
        assertThat(detail.statusCode()).isEqualTo(200);
        JsonNode savedItem = mapper.readTree(detail.body()).path("data").path("order").path("items").get(0);
        for (String field : List.of("unitPrice", "discountAmount", "finalPrice")) {
            assertThat(savedItem.path(field).decimalValue()).isEqualByComparingTo(
                item.path(field).decimalValue()
            );
        }
        then(courses).should(times(1)).requirePurchasableCourse(101L);
    }

    @Test
    void concurrentSameKeyCheckoutsReturnOneCommittedOrderWithoutServerError() throws Exception {
        var barrier = new CyclicBarrier(2);
        given(courses.requirePurchasableCourse(101L)).willAnswer(invocation -> {
            barrier.await(15, TimeUnit.SECONDS);
            return new CourseSnapshot(101L, "Concurrent English", new BigDecimal("490000"), "VND");
        });
        long count = orders.count();
        long paymentCount = payments.count();
        var post = checkoutPost(88004L, 101L, "concurrent-identical-checkout-key");
        var first = client.sendAsync(post, HttpResponse.BodyHandlers.ofString());
        var second = client.sendAsync(post, HttpResponse.BodyHandlers.ofString());
        var left = first.get(30, TimeUnit.SECONDS);
        var right = second.get(30, TimeUnit.SECONDS);
        assertThat(left.statusCode()).withFailMessage(left.body()).isEqualTo(200);
        assertThat(right.statusCode()).withFailMessage(right.body()).isEqualTo(200);
        JsonNode winner = mapper.readTree(left.body()).path("data");
        JsonNode replay = mapper.readTree(right.body()).path("data");
        assertThat(replay.path("orderCode")).isEqualTo(winner.path("orderCode"));
        assertThat(replay.path("checkoutUrl")).isEqualTo(winner.path("checkoutUrl"));
        assertThat(orders.count()).isEqualTo(count + 1);
        assertThat(payments.count()).isEqualTo(paymentCount + 1);
        var detail = request(
            "/api/v1/payments/admin/orders/" + winner.path("orderCode").asString(),
            token("ADMIN", 120),
            null
        );
        assertThat(mapper.readTree(detail.body()).path("data").path("transactions").size()).isEqualTo(1);
    }

    @Test
    void concurrentSameKeyForDifferentCoursesCannotReplayAnotherCourse() throws Exception {
        var barrier = new CyclicBarrier(2);
        willAnswer(invocation -> {
            barrier.await(15, TimeUnit.SECONDS);
            return new CourseSnapshot(
                invocation.getArgument(0),
                "Concurrent course",
                new BigDecimal("490000"),
                "VND"
            );
        })
            .given(courses)
            .requirePurchasableCourse(anyLong());
        long count = orders.count();
        var first = client.sendAsync(
            checkoutPost(88005L, 101L, "concurrent-different-course-key"),
            HttpResponse.BodyHandlers.ofString()
        );
        var second = client.sendAsync(
            checkoutPost(88005L, 102L, "concurrent-different-course-key"),
            HttpResponse.BodyHandlers.ofString()
        );
        var left = first.get(30, TimeUnit.SECONDS);
        var right = second.get(30, TimeUnit.SECONDS);
        assertThat(List.of(left.statusCode(), right.statusCode())).containsExactlyInAnyOrder(200, 409);
        var rejected = left.statusCode() == 409 ? left : right;
        assertThat(mapper.readTree(rejected.body()).path("code").asString()).isEqualTo("CONFLICT");
        assertThat(orders.count()).isEqualTo(count + 1);
    }

    private HttpRequest checkoutPost(long userId, long courseId, String key) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/payments/checkout"))
            .header("Authorization", "Bearer " + token(userId, "USER", 120))
            .header("Content-Type", "application/json")
            .POST(
                HttpRequest.BodyPublishers.ofString(
                    "{\"courseId\":" + courseId + ",\"provider\":\"MOCK\",\"idempotencyKey\":\"" + key + "\"}"
                )
            )
            .build();
    }

    @Test
    void unsuccessfulAndRefundedPaymentsDoNotBlockANewPurchase() throws Exception {
        for (PaymentStatus outcome : List.of(
            PaymentStatus.FAILED,
            PaymentStatus.CANCELLED,
            PaymentStatus.REFUNDED
        )) {
            String access = token(88100L + outcome.ordinal(), "USER", 120);
            String firstBody =
                "{\"courseId\":101,\"provider\":\"MOCK\",\"idempotencyKey\":\"retry-before-" +
                outcome +
                "\"}";
            var first = request("/api/v1/payments/checkout", access, firstBody);
            assertThat(first.statusCode()).isEqualTo(200);
            String code = mapper.readTree(first.body()).path("data").path("orderCode").asString();
            String initial = outcome == PaymentStatus.REFUNDED ? "SUCCESS" : outcome.name();
            assertThat(
                request(
                    "/api/v1/payments/mock/orders/" + code + "/complete",
                    access,
                    "{\"status\":\"" + initial + "\"}"
                ).statusCode()
            ).isEqualTo(200);
            if (outcome == PaymentStatus.REFUNDED) {
                assertThat(
                    patch(
                        "/api/v1/payments/admin/orders/" + code + "/status",
                        token("ADMIN", 120),
                        "{\"status\":\"REFUNDED\"}"
                    ).statusCode()
                ).isEqualTo(200);
            }
            var retry = request(
                "/api/v1/payments/checkout",
                access,
                "{\"courseId\":101,\"provider\":\"MOCK\",\"idempotencyKey\":\"retry-after-" + outcome + "\"}"
            );
            assertThat(retry.statusCode()).withFailMessage(retry.body()).isEqualTo(200);
            assertThat(mapper.readTree(retry.body()).path("data").path("orderCode").asString()).isNotEqualTo(
                code
            );
        }
    }

    @Test
    void granularReportPermissionIsRequiredAndSignedClaimsAreValidated() throws Exception {
        String path = "/api/v1/payments/admin/analytics";
        assertThat(request(path, token("USER", 60), null).statusCode()).isEqualTo(403);
        for (Object claim : List.of(
            List.of("PAYMENT_REPORT_VIEW"),
            List.of("USER_VIEW"),
            "PAYMENT_REPORT_VIEW"
        )) {
            String access = Jwts.builder()
                .subject("123")
                .issuer("sgedu")
                .claim("role", "USER")
                .claim("permissions", claim)
                .claim("tokenType", "access")
                .issuedAt(Date.from(Instant.now().minusSeconds(1)))
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();
            var result = request(path, access, null);
            if (claim.equals(List.of("PAYMENT_REPORT_VIEW"))) {
                assertThat(result.statusCode()).withFailMessage(result.body()).isEqualTo(200);
                assertThat(
                    mapper.readTree(result.body()).get("data").get("grossRevenue").isNumber()
                ).isTrue();
            } else assertThat(result.statusCode()).isEqualTo(claim instanceof String ? 401 : 403);
        }
    }

    @Test
    void startsIndependentlyAndExposesHealth() throws Exception {
        assertThat(request("/actuator/health", null, null).statusCode()).isEqualTo(200);
    }

    @Test
    void exposesOnlySafePaymentMethodsAndKeepsVnpayUnavailable() throws Exception {
        String path = "/api/v1/payments/methods";
        error(request(path, null, null), 401, "UNAUTHORIZED", path);
        var response = request(path, token("USER", 60), null);
        assertThat(response.statusCode()).isEqualTo(200);
        JsonNode methods = mapper.readTree(response.body()).get("data");
        assertThat(methods.get(0).get("provider").asString()).isEqualTo("MOCK");
        assertThat(methods.get(0).get("available").asBoolean()).isTrue();
        assertThat(methods.get(1).get("provider").asString()).isEqualTo("VNPAY");
        assertThat(methods.get(1).get("available").asBoolean()).isFalse();
        assertThat(vnpay.getTmnCode()).isEqualTo("test-merchant");
        assertThat(vnpay.getExpireMinutes()).isEqualTo(15);
        assertThat(response.body()).doesNotContain(vnpay.getHashSecret(), vnpay.getTmnCode(), "hashSecret");
    }

    @Test
    void rejectsUnconfiguredVnpayBeforeCreatingOrdersOrCallingCourseAndLearning() throws Exception {
        long orderCount = orders.count();
        long paymentCount = payments.count();
        String path = "/api/v1/payments/checkout";
        error(
            request(
                path,
                token("USER", 60),
                "{\"courseId\":101,\"provider\":\"VNPAY\",\"idempotencyKey\":\"week-eight-vnpay-disabled\"}"
            ),
            503,
            "VNPAY_UNAVAILABLE",
            path
        );
        assertThat(orders.count()).isEqualTo(orderCount);
        assertThat(payments.count()).isEqualTo(paymentCount);
        then(courses).shouldHaveNoInteractions();
        then(learning).shouldHaveNoInteractions();
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
    void createsInternalCheckoutAndExposesUserHistory() throws Exception {
        long successfulBefore = payments.countByStatus(PaymentStatus.SUCCESS);
        error(
            request("/api/v1/payments/history", null, null),
            401,
            "UNAUTHORIZED",
            "/api/v1/payments/history"
        );

        var invalidCheckout = request("/api/v1/payments/checkout", token("USER", 60), "{}");
        error(invalidCheckout, 400, "VALIDATION_ERROR", "/api/v1/payments/checkout");
        assertThat(mapper.readTree(invalidCheckout.body()).get("errors").get("courseId").isArray()).isTrue();

        error(
            request(
                "/api/v1/payments/checkout",
                token("USER", 60),
                "{\"courseId\":999,\"idempotencyKey\":\"checkout-missing-course-001\"}"
            ),
            404,
            "NOT_FOUND",
            "/api/v1/payments/checkout"
        );

        var checkout = request(
            "/api/v1/payments/checkout",
            token("USER", 60),
            "{\"courseId\":101,\"provider\":\"MOCK\",\"idempotencyKey\":\"checkout-course-101-main\"," +
                "\"amount\":1,\"returnUrl\":\"http://localhost:5173/payment/result\"}"
        );
        assertThat(checkout.statusCode()).isEqualTo(200);
        JsonNode checkoutJson = mapper.readTree(checkout.body());
        JsonNode checkoutData = checkoutJson.get("data");
        assertThat(checkoutJson.get("success").asBoolean()).isTrue();
        assertThat(checkoutData.get("orderCode").asString()).startsWith("LS-PAY-");
        assertThat(checkoutData.get("payment").get("provider").asString()).isEqualTo("MOCK");
        assertThat(checkoutData.get("payment").get("status").asString()).isEqualTo("PENDING");
        assertThat(checkoutData.get("order").get("items").get(0).get("courseId").asLong()).isEqualTo(101L);
        assertThat(checkoutData.get("order").get("totalAmount").decimalValue()).isEqualByComparingTo(
            "1690000.00"
        );
        assertThat(checkoutData.get("checkoutUrl").asString()).contains("/payment/mock");
        assertThat(checkoutData.get("checkoutUrl").asString()).contains("orderCode=");

        String orderCode = checkoutData.get("orderCode").asString();
        var repeatedCheckout = request(
            "/api/v1/payments/checkout",
            token("USER", 60),
            "{\"courseId\":101,\"provider\":\"MOCK\",\"idempotencyKey\":\"checkout-course-101-main\"}"
        );
        assertThat(repeatedCheckout.statusCode()).isEqualTo(200);
        assertThat(
            mapper.readTree(repeatedCheckout.body()).get("data").get("orderCode").asString()
        ).isEqualTo(orderCode);

        error(
            request(
                "/api/v1/payments/checkout",
                token("USER", 60),
                "{\"courseId\":102,\"provider\":\"MOCK\",\"idempotencyKey\":\"checkout-course-101-main\"}"
            ),
            409,
            "CONFLICT",
            "/api/v1/payments/checkout"
        );
        var order = request("/api/v1/payments/orders/" + orderCode, token("USER", 60), null);
        assertThat(order.statusCode()).isEqualTo(200);
        assertThat(mapper.readTree(order.body()).get("data").get("orderCode").asString()).isEqualTo(
            orderCode
        );

        var history = request("/api/v1/payments/history", token("USER", 60), null);
        assertThat(history.statusCode()).isEqualTo(200);
        JsonNode historyData = mapper.readTree(history.body()).get("data");
        assertThat(historyData.get("content").size()).isEqualTo(1);
        assertThat(historyData.get("content").get(0).get("orderCode").asString()).isEqualTo(orderCode);
        assertThat(historyData.get("content").get(0).get("paymentStatus").asString()).isEqualTo("PENDING");

        var pendingHistory = request(
            "/api/v1/payments/history?status=PENDING&keyword=IELTS&page=0&size=1",
            token("USER", 60),
            null
        );
        assertThat(pendingHistory.statusCode()).isEqualTo(200);
        JsonNode pendingHistoryData = mapper.readTree(pendingHistory.body()).get("data");
        assertThat(pendingHistoryData.get("content").size()).isEqualTo(1);
        assertThat(pendingHistoryData.get("totalElements").asLong()).isGreaterThanOrEqualTo(1);

        var unmatchedHistory = request(
            "/api/v1/payments/history?status=SUCCESS&keyword=missing-course",
            token("USER", 60),
            null
        );
        assertThat(unmatchedHistory.statusCode()).isEqualTo(200);
        JsonNode unmatchedHistoryData = mapper.readTree(unmatchedHistory.body()).get("data");
        assertThat(unmatchedHistoryData.get("content").size()).isZero();
        assertThat(unmatchedHistoryData.get("totalElements").asLong()).isZero();

        error(
            request("/api/v1/payments/admin/analytics", token("USER", 60), null),
            403,
            "FORBIDDEN",
            "/api/v1/payments/admin/analytics"
        );

        var analytics = request("/api/v1/payments/admin/analytics", token("ADMIN", 60), null);
        assertThat(analytics.statusCode()).isEqualTo(200);
        JsonNode analyticsData = mapper.readTree(analytics.body()).get("data");
        assertThat(analyticsData.get("totalOrders").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(analyticsData.get("pendingPayments").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(analyticsData.get("successfulPayments").asLong()).isEqualTo(successfulBefore);
        assertThat(analyticsData.get("pendingAmount").asDouble()).isGreaterThan(0);
        assertThat(analyticsData.get("crossService").get("activeLearners").asLong()).isGreaterThanOrEqualTo(
            1
        );
        assertThat(analyticsData.get("crossService").get("paidCourses").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(analyticsData.get("revenueSeries").size()).isEqualTo(6);
        boolean containsCreatedOrder = false;
        for (JsonNode transaction : analyticsData.get("recentTransactions")) {
            if (orderCode.equals(transaction.get("orderCode").asString())) containsCreatedOrder = true;
        }
        assertThat(containsCreatedOrder).isTrue();

        error(
            request("/api/v1/payments/admin/orders", token("USER", 60), null),
            403,
            "FORBIDDEN",
            "/api/v1/payments/admin/orders"
        );

        var adminOrders = request(
            "/api/v1/payments/admin/orders?status=PENDING&keyword=IELTS&page=0&size=5",
            token("ADMIN", 60),
            null
        );
        assertThat(adminOrders.statusCode()).isEqualTo(200);
        JsonNode adminOrdersData = mapper.readTree(adminOrders.body()).get("data");
        assertThat(adminOrdersData.get("content").size()).isGreaterThanOrEqualTo(1);
        assertThat(adminOrdersData.get("content").get(0).get("orderCode").asString()).isEqualTo(orderCode);
        assertThat(adminOrdersData.get("content").get(0).get("provider").asString()).isEqualTo("MOCK");

        var detail = request("/api/v1/payments/admin/orders/" + orderCode, token("ADMIN", 60), null);
        assertThat(detail.statusCode()).isEqualTo(200);
        JsonNode detailData = mapper.readTree(detail.body()).get("data");
        assertThat(detailData.get("order").get("orderCode").asString()).isEqualTo(orderCode);
        assertThat(detailData.get("transactions").get(0).get("eventType").asString()).isEqualTo("CREATED");
        boolean canMarkSuccess = false;
        for (JsonNode status : detailData.get("availableStatuses")) {
            if ("SUCCESS".equals(status.asString())) canMarkSuccess = true;
        }
        assertThat(canMarkSuccess).isTrue();

        var paid = patch(
            "/api/v1/payments/admin/orders/" + orderCode + "/status",
            token("ADMIN", 60),
            "{\"status\":\"SUCCESS\"}"
        );
        assertThat(paid.statusCode()).isEqualTo(200);
        JsonNode paidData = mapper.readTree(paid.body()).get("data");
        assertThat(paidData.get("order").get("status").asString()).isEqualTo("PAID");
        assertThat(paidData.get("order").get("payment").get("status").asString()).isEqualTo("SUCCESS");
        assertThat(paidData.get("order").get("payment").get("paidAt").isNull()).isFalse();
        assertThat(paidData.get("transactions").size()).isEqualTo(2);
        assertThat(paidData.get("transactions").get(1).get("eventType").asString()).isEqualTo(
            "STATUS_CHANGED"
        );

        error(
            patch(
                "/api/v1/payments/admin/orders/" + orderCode + "/status",
                token("ADMIN", 60),
                "{\"status\":\"FAILED\"}"
            ),
            409,
            "CONFLICT",
            "/api/v1/payments/admin/orders/" + orderCode + "/status"
        );

        var refunded = patch(
            "/api/v1/payments/admin/orders/" + orderCode + "/status",
            token("ADMIN", 60),
            "{\"status\":\"REFUNDED\"}"
        );
        assertThat(refunded.statusCode()).isEqualTo(200);
        JsonNode refundedData = mapper.readTree(refunded.body()).get("data");
        assertThat(refundedData.get("order").get("status").asString()).isEqualTo("CANCELLED");
        assertThat(refundedData.get("order").get("payment").get("status").asString()).isEqualTo("REFUNDED");
        assertThat(refundedData.get("availableStatuses").size()).isZero();
    }

    @Test
    void mockProviderCompletesCheckoutAndRejectsInvalidTransitions() throws Exception {
        var checkout = request(
            "/api/v1/payments/checkout",
            token("USER", 60),
            "{\"courseId\":102,\"provider\":\"MOCK\",\"idempotencyKey\":\"mock-success-course-102\"," +
                "\"returnUrl\":\"http://localhost:5173/payment/result\"}"
        );
        assertThat(checkout.statusCode()).isEqualTo(200);
        String orderCode = mapper.readTree(checkout.body()).get("data").get("orderCode").asString();
        String mockPath = "/api/v1/payments/mock/orders/" + orderCode + "/complete";

        var paid = request(mockPath, token("USER", 60), "{\"status\":\"SUCCESS\"}");
        assertThat(paid.statusCode()).withFailMessage(paid.body()).isEqualTo(200);
        JsonNode paidData = mapper.readTree(paid.body()).get("data");
        assertThat(paidData.get("status").asString()).isEqualTo("PAID");
        assertThat(paidData.get("payment").get("status").asString()).isEqualTo("SUCCESS");
        assertThat(paidData.get("payment").get("paidAt").isNull()).isFalse();

        var repeatedSuccess = request(mockPath, token("USER", 60), "{\"status\":\"SUCCESS\"}");
        assertThat(repeatedSuccess.statusCode()).isEqualTo(200);
        then(learning).should(times(2)).enroll(orderCode, 1L, 102L);

        error(request(mockPath, token("USER", 60), "{\"status\":\"FAILED\"}"), 409, "CONFLICT", mockPath);

        var secondCheckout = request(
            "/api/v1/payments/checkout",
            token("USER", 60),
            "{\"courseId\":103,\"provider\":\"MOCK\",\"idempotencyKey\":\"mock-failed-course-103\"," +
                "\"returnUrl\":\"http://localhost:5173/payment/result\"}"
        );
        assertThat(secondCheckout.statusCode()).isEqualTo(200);
        String failedOrderCode = mapper
            .readTree(secondCheckout.body())
            .get("data")
            .get("orderCode")
            .asString();
        String failedPath = "/api/v1/payments/mock/orders/" + failedOrderCode + "/complete";

        var failed = request(
            failedPath,
            token("USER", 60),
            "{\"status\":\"FAILED\",\"failureMessage\":\"Mock provider declined\"}"
        );
        assertThat(failed.statusCode()).withFailMessage(failed.body()).isEqualTo(200);
        JsonNode failedData = mapper.readTree(failed.body()).get("data");
        assertThat(failedData.get("status").asString()).isEqualTo("CANCELLED");
        assertThat(failedData.get("payment").get("status").asString()).isEqualTo("FAILED");
        assertThat(failedData.get("payment").get("paidAt").isNull()).isTrue();

        error(
            request(failedPath, token("USER", 60), "{\"status\":\"REFUNDED\"}"),
            400,
            "BAD_REQUEST",
            failedPath
        );
    }

    @Test
    void ignoresClientOwnedPaymentFieldsAndPreventsCrossUserAccess() throws Exception {
        long ownerId = 7_101L;
        long otherUserId = 7_102L;
        String ownerAccess = token(ownerId, "USER", 60);
        String otherAccess = token(otherUserId, "USER", 60);

        var checkout = request(
            "/api/v1/payments/checkout",
            ownerAccess,
            "{\"courseId\":101,\"provider\":\"MOCK\"," +
                "\"idempotencyKey\":\"hardening-owner-checkout-101\"," +
                "\"amount\":1,\"status\":\"SUCCESS\",\"userId\":" +
                otherUserId +
                "}"
        );
        assertThat(checkout.statusCode()).withFailMessage(checkout.body()).isEqualTo(200);
        JsonNode checkoutData = mapper.readTree(checkout.body()).get("data");
        String orderCode = checkoutData.get("orderCode").asString();
        assertThat(checkoutData.get("order").get("userId").asLong()).isEqualTo(ownerId);
        assertThat(checkoutData.get("order").get("totalAmount").decimalValue()).isEqualByComparingTo(
            "1690000.00"
        );
        assertThat(checkoutData.get("payment").get("amount").decimalValue()).isEqualByComparingTo(
            "1690000.00"
        );
        assertThat(checkoutData.get("payment").get("status").asString()).isEqualTo("PENDING");

        String orderPath = "/api/v1/payments/orders/" + orderCode;
        error(request(orderPath, otherAccess, null), 403, "FORBIDDEN", orderPath);

        String mockPath = "/api/v1/payments/mock/orders/" + orderCode + "/complete";
        error(request(mockPath, otherAccess, "{\"status\":\"SUCCESS\"}"), 403, "FORBIDDEN", mockPath);

        var otherHistory = request("/api/v1/payments/history?keyword=" + orderCode, otherAccess, null);
        assertThat(otherHistory.statusCode()).isEqualTo(200);
        assertThat(mapper.readTree(otherHistory.body()).get("data").get("totalElements").asLong()).isZero();

        String adminStatusPath = "/api/v1/payments/admin/orders/" + orderCode + "/status";
        error(
            patch(adminStatusPath, ownerAccess, "{\"status\":\"SUCCESS\"}"),
            403,
            "FORBIDDEN",
            adminStatusPath
        );
        assertThat(request(orderPath, ownerAccess, null).statusCode()).isEqualTo(200);
    }

    @Test
    void rollsBackSuccessWhenLearningIsUnavailableAndRetriesSafely() throws Exception {
        long userId = 7_201L;
        String access = token(userId, "USER", 60);
        var checkout = request(
            "/api/v1/payments/checkout",
            access,
            "{\"courseId\":102,\"provider\":\"MOCK\"," +
                "\"idempotencyKey\":\"hardening-learning-retry-102\"}"
        );
        assertThat(checkout.statusCode()).withFailMessage(checkout.body()).isEqualTo(200);
        String orderCode = mapper.readTree(checkout.body()).get("data").get("orderCode").asString();
        willThrow(new AppException(ErrorCode.SERVICE_UNAVAILABLE))
            .willDoNothing()
            .given(learning)
            .enroll(orderCode, userId, 102L);

        String mockPath = "/api/v1/payments/mock/orders/" + orderCode + "/complete";
        error(request(mockPath, access, "{\"status\":\"SUCCESS\"}"), 503, "SERVICE_UNAVAILABLE", mockPath);

        JsonNode pending = mapper
            .readTree(request("/api/v1/payments/orders/" + orderCode, access, null).body())
            .get("data");
        assertThat(pending.get("status").asString()).isEqualTo("PENDING_PAYMENT");
        assertThat(pending.get("payment").get("status").asString()).isEqualTo("PENDING");

        var retry = request(mockPath, access, "{\"status\":\"SUCCESS\"}");
        assertThat(retry.statusCode()).withFailMessage(retry.body()).isEqualTo(200);
        assertThat(
            mapper.readTree(retry.body()).get("data").get("payment").get("status").asString()
        ).isEqualTo("SUCCESS");

        var repeated = request(mockPath, access, "{\"status\":\"SUCCESS\"}");
        assertThat(repeated.statusCode()).isEqualTo(200);
        then(learning).should(times(3)).enroll(orderCode, userId, 102L);

        var detail = request("/api/v1/payments/admin/orders/" + orderCode, token("ADMIN", 60), null);
        assertThat(detail.statusCode()).isEqualTo(200);
        assertThat(mapper.readTree(detail.body()).get("data").get("transactions").size()).isEqualTo(2);

        JsonNode analytics = mapper
            .readTree(request("/api/v1/payments/admin/analytics", token("ADMIN", 60), null).body())
            .get("data");
        assertThat(analytics.get("successfulPayments").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(analytics.get("grossRevenue").decimalValue()).isGreaterThanOrEqualTo(
            BigDecimal.valueOf(1_290_000)
        );
    }

    @Test
    void separatesPaymentReportingFromStatusManagementPermission() throws Exception {
        long reporterId = 7_301L;
        String reporter = token(reporterId, "USER", List.of("PAYMENT_REPORT_VIEW"), 60);

        assertThat(request("/api/v1/payments/admin/orders", reporter, null).statusCode()).isEqualTo(200);
        assertThat(request("/api/v1/payments/admin/analytics", reporter, null).statusCode()).isEqualTo(200);

        var checkout = request(
            "/api/v1/payments/checkout",
            token(reporterId, "USER", 60),
            "{\"courseId\":103,\"idempotencyKey\":\"hardening-reporter-order-103\"}"
        );
        String orderCode = mapper.readTree(checkout.body()).get("data").get("orderCode").asString();
        String detailPath = "/api/v1/payments/admin/orders/" + orderCode;
        assertThat(request(detailPath, reporter, null).statusCode()).isEqualTo(200);
        error(
            patch(detailPath + "/status", reporter, "{\"status\":\"SUCCESS\"}"),
            403,
            "FORBIDDEN",
            detailPath + "/status"
        );
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
            .issuer("sgedu")
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
            .issuer("sgedu")
            .claim("tokenType", "refresh")
            .signWith(key)
            .compact();
        assertThatThrownBy(() -> tokens.validate(wrongType)).isInstanceOf(JwtException.class);
        var otherKey = Jwts.SIG.HS256.key().build();
        String wrongSignature = Jwts.builder().subject("u").signWith(otherKey).compact();
        assertThatThrownBy(() -> tokens.validate(wrongSignature)).isInstanceOf(JwtException.class);
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
