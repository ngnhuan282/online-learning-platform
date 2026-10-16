package com.elearning.payment;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.course.CourseSnapshot;
import com.elearning.payment.course.CourseSnapshotProvider;
import com.elearning.payment.learning.LearningEnrollmentClient;
import com.elearning.payment.learning.PaidCourseActivationRetry;
import com.elearning.payment.learning.PaidCourseActivationService;
import com.elearning.payment.repository.CourseOrderRepository;
import com.elearning.payment.repository.PaymentRepository;
import com.elearning.payment.repository.PaymentTransactionRepository;
import com.elearning.payment.service.PaymentCoreService;
import com.elearning.payment.vnpay.VnpayOrderExpiry;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.datasource.url=${VNPAY_TEST_DB_URL:jdbc:h2:mem:vnpay;MODE=MySQL;DB_CLOSE_DELAY=-1}",
        "spring.datasource.username=${VNPAY_TEST_DB_USERNAME:sa}",
        "spring.datasource.password=${VNPAY_TEST_DB_PASSWORD:}",
        "spring.datasource.driver-class-name=${VNPAY_TEST_DB_DRIVER:org.h2.Driver}",
        "security.jwt.secret=test-jwt-vnpay-integration-secret-at-least-32-bytes",
        "integrations.vnpay.tmn-code=TEST0001",
        "integrations.vnpay.hash-secret=test-sandbox-signing-secret",
        "integrations.vnpay.ipn-url=https://gateway.test/api/v1/payments/vnpay/ipn",
        "integrations.vnpay.activation-retry-enabled=false",
    }
)
@ActiveProfiles("test")
class VnpayIntegrationTests {

    private static final String JWT_SECRET = "test-jwt-vnpay-integration-secret-at-least-32-bytes";
    private static final String SIGNING_SECRET = "test-sandbox-signing-secret";
    private static final String BASE = "/api/v1/payments";
    private static final BigDecimal PRICE = new BigDecimal("1490000.00");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(
        ZoneOffset.ofHours(7)
    );

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper mapper;

    @Autowired
    CourseOrderRepository orders;

    @Autowired
    PaymentRepository payments;

    @Autowired
    PaymentTransactionRepository transactions;

    @Autowired
    PaidCourseActivationService activation;

    @Autowired
    PaymentCoreService core;

    @PersistenceContext
    EntityManager entityManager;

    @Autowired
    TransactionTemplate transaction;

    @MockitoBean
    CourseSnapshotProvider courses;

    @MockitoBean
    LearningEnrollmentClient learning;

    final HttpClient client = HttpClient.newHttpClient();

    @BeforeEach
    void contracts() {
        given(courses.requirePurchasableCourse(101L)).willReturn(
            new CourseSnapshot(101L, "IELTS course", PRICE, "VND")
        );
        willDoNothing().given(learning).enroll(anyString(), anyLong(), anyLong());
    }

    String token(long userId, String role) {
        return Jwts.builder()
            .subject(Long.toString(userId))
            .issuer("learnsphere")
            .claim("role", role)
            .claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(1)))
            .expiration(Date.from(Instant.now().plusSeconds(300)))
            .signWith(Keys.hmacShaKeyFor(JWT_SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();
    }

    HttpRequest http(String path, String access, String method, String body) {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (access != null) builder.header("Authorization", "Bearer " + access);
        builder
            .header("Content-Type", "application/json")
            .method(
                method,
                body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)
            );
        return builder.build();
    }

    HttpResponse<String> request(String path, String access, String method, String body) throws Exception {
        return client.send(http(path, access, method, body), HttpResponse.BodyHandlers.ofString());
    }

    JsonNode checkout(long userId, String provider, String key) throws Exception {
        var response = request(
            BASE + "/checkout",
            token(userId, "USER"),
            "POST",
            "{\"courseId\":101,\"provider\":\"" +
                provider +
                "\",\"idempotencyKey\":\"" +
                key +
                "\",\"amount\":1,\"status\":\"SUCCESS\",\"returnUrl\":\"https://untrusted.test/return\"}"
        );
        assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(200);
        return mapper.readTree(response.body()).get("data");
    }

    JsonNode checkout() throws Exception {
        return checkout(71L, "VNPAY", UUID.randomUUID().toString());
    }

    Map<String, String> callback(String orderCode, String response, String status) {
        Map<String, String> fields = new TreeMap<>();
        fields.put("vnp_TmnCode", "TEST0001");
        fields.put("vnp_TxnRef", orderCode);
        fields.put("vnp_Amount", "149000000");
        fields.put("vnp_BankCode", "NCB");
        fields.put("vnp_OrderInfo", "Thanh toan khoa hoc " + orderCode);
        fields.put("vnp_TransactionNo", "123456789");
        fields.put("vnp_ResponseCode", response);
        fields.put("vnp_TransactionStatus", status);
        fields.put("vnp_PayDate", DATE.format(Instant.now()));
        return fields;
    }

    String query(Map<String, String> fields) {
        return new TreeMap<>(fields)
            .entrySet()
            .stream()
            .map(
                entry ->
                    URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8) +
                    "=" +
                    URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8)
            )
            .collect(Collectors.joining("&"));
    }

    String sign(String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA512");
        mac.init(new SecretKeySpec(SIGNING_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
        return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }

    String signed(Map<String, String> fields) throws Exception {
        String query = query(fields);
        return query + "&vnp_SecureHash=" + sign(query);
    }

    String ipn(String query) throws Exception {
        var result = request(BASE + "/vnpay/ipn?" + query, null, "GET", null);
        assertThat(result.statusCode()).isEqualTo(200);
        var json = mapper.readTree(result.body());
        assertThat(json.size()).isEqualTo(2);
        assertThat(json.has("Message")).isTrue();
        assertThat(json.has("success")).isFalse();
        assertThat(result.headers().firstValue("Cache-Control")).contains("no-store");
        return json.get("RspCode").asString();
    }

    JsonNode order(String code) throws Exception {
        return mapper
            .readTree(request(BASE + "/orders/" + code, token(71L, "USER"), "GET", null).body())
            .get("data");
    }

    Instant pastCheckoutWindow(String code) {
        Instant expiry = Instant.now().minusSeconds(60).truncatedTo(ChronoUnit.MICROS);
        Instant created = expiry.minusSeconds(900);
        // Use the same Instant mapping as checkout on both H2 and MySQL.
        transaction.executeWithoutResult(status -> {
            int updated = entityManager
                .createQuery(
                    "update CourseOrder o set o.createdAt = :created, o.expiresAt = :expiry where o.orderCode = :code"
                )
                .setParameter("created", created)
                .setParameter("expiry", expiry)
                .setParameter("code", code)
                .executeUpdate();
            assertThat(updated).isEqualTo(1);
        });
        var stored = orders.findByOrderCode(code).orElseThrow();
        assertThat(stored.getCreatedAt()).isEqualTo(created);
        assertThat(stored.getExpiresAt()).isEqualTo(expiry);
        return expiry;
    }

    JsonNode analytics() throws Exception {
        var response = request(BASE + "/admin/analytics", token(71L, "ADMIN"), "GET", null);
        assertThat(response.statusCode()).isEqualTo(200);
        return mapper.readTree(response.body()).get("data");
    }

    @Test
    void expiryWorkerClosesOnlyOverdueVnpayCheckoutsWithoutChangingProviderState() throws Exception {
        String expiredCode = checkout().get("orderCode").asString();
        String activeCode = checkout().get("orderCode").asString();
        String mockCode = checkout(71L, "MOCK", UUID.randomUUID().toString()).get("orderCode").asString();
        pastCheckoutWindow(expiredCode);
        pastCheckoutWindow(mockCode);
        long events = transactions.count();
        var worker = new VnpayOrderExpiry(orders, core);
        worker.expirePendingOrders();
        worker.expirePendingOrders();
        assertThat(order(expiredCode).get("status").asString()).isEqualTo("EXPIRED");
        assertThat(order(expiredCode).get("payment").get("status").asString()).isEqualTo("PENDING");
        assertThat(order(expiredCode).get("payment").get("paidAt").isNull()).isTrue();
        assertThat(order(activeCode).get("status").asString()).isEqualTo("PENDING_PAYMENT");
        assertThat(order(mockCode).get("status").asString()).isEqualTo("PENDING_PAYMENT");
        assertThat(core.expireVnpayOrder(mockCode)).isFalse();
        assertThat(core.expireVnpayOrder("missing-order")).isFalse();
        assertThat(transactions.count()).isEqualTo(events);
        then(learning).shouldHaveNoInteractions();
    }

    @Test
    void overdueOrdersHaveOwnedExpiredFiltersAndLeaveAwaitingAnalyticsEvenBeforeWorkerRuns()
        throws Exception {
        String code = checkout().get("orderCode").asString();
        JsonNode before = analytics();
        pastCheckoutWindow(code);
        JsonNode after = analytics();
        assertThat(after.get("totalOrders").asLong()).isEqualTo(before.get("totalOrders").asLong());
        assertThat(after.get("pendingPayments").asLong()).isEqualTo(
            before.get("pendingPayments").asLong() - 1
        );
        assertThat(new BigDecimal(after.get("pendingAmount").toString())).isEqualByComparingTo(
            new BigDecimal(before.get("pendingAmount").toString()).subtract(PRICE)
        );
        assertThat(after.get("failedPayments").asLong()).isEqualTo(before.get("failedPayments").asLong());
        assertThat(after.get("successfulPayments").asLong()).isEqualTo(
            before.get("successfulPayments").asLong()
        );
        assertThat(core.expireVnpayOrder(code)).isTrue();
        for (String route : new String[] { "/history", "/admin/orders" }) {
            String role = route.startsWith("/admin") ? "ADMIN" : "USER";
            var response = request(
                BASE + route + "?expired=true&keyword=" + code,
                token(71L, role),
                "GET",
                null
            );
            assertThat(response.statusCode()).isEqualTo(200);
            JsonNode data = mapper.readTree(response.body()).get("data");
            assertThat(data.get("totalElements").asLong()).isEqualTo(1);
            JsonNode row = data.get("content").get(0);
            assertThat(row.get("orderStatus").asString()).isEqualTo("EXPIRED");
            assertThat(row.get("paymentStatus").asString()).isEqualTo("PENDING");
            assertThat(row.get("provider").asString()).isEqualTo("VNPAY");
            assertThat(row.get("expiresAt").isNull()).isFalse();
            var pending = request(
                BASE + route + "?status=PENDING&keyword=" + code,
                token(71L, role),
                "GET",
                null
            );
            assertThat(mapper.readTree(pending.body()).get("data").get("totalElements").asLong()).isZero();
        }
        var otherUser = request(
            BASE + "/history?expired=true&keyword=" + code,
            token(72L, "USER"),
            "GET",
            null
        );
        assertThat(mapper.readTree(otherUser.body()).get("data").get("totalElements").asLong()).isZero();
        assertThat(
            request(BASE + "/admin/orders?expired=true", token(72L, "USER"), "GET", null).statusCode()
        ).isEqualTo(403);
    }

    @Test
    void validLateIpnRevivesExpiredOrderAndActivatesOnceWhenPaymentWasWithinWindow() throws Exception {
        String code = checkout().get("orderCode").asString();
        Instant expiry = pastCheckoutWindow(code);
        assertThat(core.expireVnpayOrder(code)).isTrue();
        long events = transactions.count();
        var fields = callback(code, "00", "00");
        fields.put("vnp_PayDate", DATE.format(expiry.minusSeconds(10)));
        String signed = signed(fields);
        assertThat(ipn(signed)).isEqualTo("00");
        assertThat(ipn(signed)).isEqualTo("02");
        JsonNode confirmed = order(code);
        assertThat(confirmed.get("status").asString()).isEqualTo("PAID");
        assertThat(confirmed.get("payment").get("status").asString()).isEqualTo("SUCCESS");
        assertThat(confirmed.get("payment").get("enrollmentReady").asBoolean()).isTrue();
        assertThat(core.expireVnpayOrder(code)).isFalse();
        assertThat(transactions.count()).isEqualTo(events + 1);
        then(learning).should(times(1)).enroll(code, 71L, 101L);
    }

    @Test
    void expiryAndLateIpnRaceCannotOverwriteConfirmedPayment() throws Exception {
        String code = checkout().get("orderCode").asString();
        Instant expiry = pastCheckoutWindow(code);
        var fields = callback(code, "00", "00");
        fields.put("vnp_PayDate", DATE.format(expiry.minusSeconds(10)));
        var expire = CompletableFuture.runAsync(() -> core.expireVnpayOrder(code));
        assertThat(ipn(signed(fields))).isEqualTo("00");
        expire.join();
        assertThat(order(code).get("status").asString()).isEqualTo("PAID");
        assertThat(order(code).get("payment").get("enrollmentReady").asBoolean()).isTrue();
        then(learning).should(times(1)).enroll(code, 71L, 101L);
    }

    @Test
    void invalidOrOutOfWindowIpnCannotReviveExpiredOrder() throws Exception {
        String code = checkout().get("orderCode").asString();
        Instant expiry = pastCheckoutWindow(code);
        assertThat(core.expireVnpayOrder(code)).isTrue();
        long events = transactions.count();
        var fields = callback(code, "00", "00");
        fields.put("vnp_PayDate", DATE.format(expiry.plusSeconds(1)));
        assertThat(ipn(signed(fields))).isEqualTo("99");
        assertThat(ipn(signed(fields).replace("149000000", "100"))).isEqualTo("97");
        assertThat(order(code).get("status").asString()).isEqualTo("EXPIRED");
        assertThat(order(code).get("payment").get("status").asString()).isEqualTo("PENDING");
        assertThat(transactions.count()).isEqualTo(events);
        then(learning).shouldHaveNoInteractions();
    }

    @Test
    void expiredIdempotentCheckoutDoesNotCreateAnotherOrderOrReturnDeadPaymentLink() throws Exception {
        String key = UUID.randomUUID().toString();
        String code = checkout(71L, "VNPAY", key).get("orderCode").asString();
        pastCheckoutWindow(code);
        long count = orders.count();
        var response = request(
            BASE + "/checkout",
            token(71L, "USER"),
            "POST",
            "{\"courseId\":101,\"provider\":\"VNPAY\",\"idempotencyKey\":\"" + key + "\"}"
        );
        assertThat(response.statusCode()).isEqualTo(409);
        assertThat(mapper.readTree(response.body()).get("code").asString()).isEqualTo("CHECKOUT_EXPIRED");
        assertThat(orders.count()).isEqualTo(count);
        JsonNode methods = mapper
            .readTree(request(BASE + "/methods", token(71L, "USER"), "GET", null).body())
            .get("data");
        assertThat(methods.get(1).get("label").asString()).isEqualTo("VNPay");
        assertThat(methods.get(1).get("description").asString()).isEqualTo("Thanh toán qua VNPay");
    }

    @Test
    void signsServerPriceAndCallbacksAndReusesIdempotencyKey() throws Exception {
        String key = UUID.randomUUID().toString();
        JsonNode first = checkout(71L, "VNPAY", key);
        JsonNode duplicate = checkout(71L, "VNPAY", key);
        assertThat(first.get("orderCode").asString()).isEqualTo(duplicate.get("orderCode").asString());
        assertThat(first.get("payment").get("status").asString()).isEqualTo("PENDING");
        assertThat(new BigDecimal(first.get("payment").get("amount").toString())).isEqualByComparingTo(PRICE);
        URI url = URI.create(first.get("checkoutUrl").asString());
        assertThat(url.getHost()).isEqualTo("sandbox.vnpayment.vn");
        Map<String, String> fields = new TreeMap<>();
        for (String part : url.getRawQuery().split("&")) {
            String[] pair = part.split("=", 2);
            fields.put(
                URLDecoder.decode(pair[0], StandardCharsets.UTF_8),
                URLDecoder.decode(pair[1], StandardCharsets.UTF_8)
            );
        }
        String signature = fields.remove("vnp_SecureHash");
        assertThat(signature).isEqualTo(sign(query(fields)));
        assertThat(fields.get("vnp_Amount")).isEqualTo("149000000");
        assertThat(fields.get("vnp_ReturnUrl")).isEqualTo(
            "http://localhost:8080/api/v1/payments/vnpay/return"
        );
        assertThat(fields.get("vnp_CreateDate")).matches("[0-9]{14}");
        assertThat(url.toString()).doesNotContain(SIGNING_SECRET, "untrusted.test");
        then(learning).shouldHaveNoInteractions();
    }

    @Test
    void browserReturnVerifiesButNeverConfirmsOrEnrolls() throws Exception {
        String code = checkout().get("orderCode").asString();
        long count = transactions.count();
        String query = signed(callback(code, "00", "00"));
        var result = request(BASE + "/vnpay/return?" + query, null, "GET", null);
        assertThat(result.statusCode()).isEqualTo(303);
        assertThat(result.headers().firstValue("Location")).contains(
            "http://localhost:5173/payment/result?orderCode=" + code
        );
        assertThat(order(code).get("payment").get("status").asString()).isEqualTo("PENDING");
        assertThat(transactions.count()).isEqualTo(count);
        then(learning).shouldHaveNoInteractions();
        var forged = request(BASE + "/vnpay/return?" + query.replace("149000000", "100"), null, "GET", null);
        assertThat(forged.headers().firstValue("Location")).contains(
            "http://localhost:5173/payment/result?callbackError=invalid"
        );
        assertThat(ipn(query)).isEqualTo("00");
        assertThat(order(code).get("payment").get("enrollmentReady").asBoolean()).isTrue();
        then(learning).should().enroll(code, 71L, 101L);
    }

    @Test
    void invalidSignatureDuplicatesMerchantAmountCurrencyAndMissingOrdersCannotWrite() throws Exception {
        String code = checkout().get("orderCode").asString();
        long count = transactions.count();
        var fields = callback(code, "00", "00");
        String valid = signed(fields);
        assertThat(ipn(valid.replace("149000000", "100"))).isEqualTo("97");
        assertThat(ipn(valid + "&vnp_Amount=149000000")).isEqualTo("97");
        fields.put("vnp_Amount", "100");
        assertThat(ipn(signed(fields))).isEqualTo("04");
        fields.put("vnp_Amount", "149000000");
        fields.put("vnp_CurrCode", "USD");
        assertThat(ipn(signed(fields))).isEqualTo("04");
        fields.remove("vnp_CurrCode");
        fields.put("vnp_TmnCode", "OTHER001");
        assertThat(ipn(signed(fields))).isEqualTo("01");
        fields.put("vnp_TmnCode", "TEST0001");
        fields.put("vnp_TxnRef", "LS-PAY-MISSING");
        assertThat(ipn(signed(fields))).isEqualTo("01");
        assertThat(transactions.count()).isEqualTo(count);
        assertThat(order(code).get("payment").get("status").asString()).isEqualTo("PENDING");
        then(learning).shouldHaveNoInteractions();
    }

    @Test
    void differentiatesFailureCancellationAndRequiresBothSuccessCodes() throws Exception {
        for (var scenario : new String[][] {
            { "24", "02", "CANCELLED" },
            { "51", "02", "FAILED" },
            { "12", "02", "FAILED" },
            { "13", "02", "FAILED" },
            { "99", "02", "FAILED" },
            { "05", "02", "FAILED" },
            { "00", "02", "FAILED" },
        }) {
            String code = checkout().get("orderCode").asString();
            long count = transactions.count();
            var fields = callback(code, scenario[0], scenario[1]);
            fields.put("vnp_TransactionNo", "0");
            fields.remove("vnp_PayDate");
            String query = signed(fields);
            var result = request(BASE + "/vnpay/return?" + query, null, "GET", null);
            assertThat(result.statusCode()).isEqualTo(303);
            assertThat(result.headers().firstValue("Location")).contains(
                "http://localhost:5173/payment/result?orderCode=" + code
            );
            assertThat(order(code).get("payment").get("status").asString()).isEqualTo("PENDING");
            assertThat(transactions.count()).isEqualTo(count);

            assertThat(ipn(query)).isEqualTo("00");
            JsonNode confirmed = order(code);
            assertThat(confirmed.get("status").asString()).isEqualTo("CANCELLED");
            assertThat(confirmed.get("payment").get("status").asString()).isEqualTo(scenario[2]);
            assertThat(confirmed.get("payment").get("paidAt").isNull()).isTrue();
            var payment = payments.findById(confirmed.get("payment").get("id").asLong()).orElseThrow();
            assertThat(payment.getFailureCode()).isEqualTo(scenario[0]);
            assertThat(payment.getEnrollmentActivatedAt()).isNull();
            assertThat(transactions.count()).isEqualTo(count + 1);

            assertThat(ipn(query)).isEqualTo("02");
            assertThat(order(code).get("payment").get("status").asString()).isEqualTo(scenario[2]);
            assertThat(transactions.count()).isEqualTo(count + 1);
        }
        then(learning).shouldHaveNoInteractions();
    }

    @Test
    void repeatedAndConcurrentIpnsHaveOneEventAndOneActivation() throws Exception {
        String code = checkout().get("orderCode").asString();
        String query = signed(callback(code, "00", "00"));
        long count = transactions.count();
        var futures = new ArrayList<CompletableFuture<HttpResponse<String>>>();
        for (int i = 0; i < 4; i++) {
            futures.add(
                client.sendAsync(
                    http(BASE + "/vnpay/ipn?" + query, null, "GET", null),
                    HttpResponse.BodyHandlers.ofString()
                )
            );
        }
        CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();
        int confirmed = 0;
        for (var future : futures) {
            var response = future.join();
            assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(200);
            String result = mapper.readTree(response.body()).get("RspCode").asString();
            assertThat(result).isIn("00", "02");
            if ("00".equals(result)) confirmed++;
        }
        assertThat(confirmed).isEqualTo(1);
        assertThat(ipn(query)).isEqualTo("02");
        assertThat(transactions.count()).isEqualTo(count + 1);
        then(learning).should(times(1)).enroll(code, 71L, 101L);
    }

    @Test
    void confirmedSuccessCannotBeDowngradedByLaterFailureOrCancellation() throws Exception {
        String code = checkout().get("orderCode").asString();
        long count = transactions.count();
        assertThat(ipn(signed(callback(code, "00", "00")))).isEqualTo("00");
        for (String response : new String[] { "51", "24" }) {
            assertThat(ipn(signed(callback(code, response, "02")))).isEqualTo("02");
        }
        JsonNode confirmed = order(code);
        assertThat(confirmed.get("status").asString()).isEqualTo("PAID");
        assertThat(confirmed.get("payment").get("status").asString()).isEqualTo("SUCCESS");
        assertThat(confirmed.get("payment").get("enrollmentReady").asBoolean()).isTrue();
        assertThat(transactions.count()).isEqualTo(count + 1);
        then(learning).should(times(1)).enroll(code, 71L, 101L);
    }

    @Test
    void paidStateSurvivesLearningFailureAndOwnedRetryRecoversWithoutDuplicateEvent() throws Exception {
        String code = checkout().get("orderCode").asString();
        willThrow(new AppException(ErrorCode.SERVICE_UNAVAILABLE)).given(learning).enroll(code, 71L, 101L);
        long count = transactions.count();
        String query = signed(callback(code, "00", "00"));
        assertThat(ipn(query)).isEqualTo("00");
        assertThat(order(code).get("payment").get("status").asString()).isEqualTo("SUCCESS");
        assertThat(order(code).get("payment").get("enrollmentReady").asBoolean()).isFalse();
        String path = BASE + "/orders/" + code + "/activation";
        assertThat(request(path, token(72L, "USER"), "POST", null).statusCode()).isEqualTo(403);
        assertThat(request(path, token(71L, "USER"), "POST", null).statusCode()).isEqualTo(503);
        assertThat(order(code).get("payment").get("status").asString()).isEqualTo("SUCCESS");
        willDoNothing().given(learning).enroll(code, 71L, 101L);
        assertThat(request(path, token(71L, "USER"), "POST", null).statusCode()).isEqualTo(200);
        assertThat(order(code).get("payment").get("enrollmentReady").asBoolean()).isTrue();
        assertThat(ipn(query)).isEqualTo("02");
        assertThat(transactions.count()).isEqualTo(count + 1);
        then(learning).should(times(3)).enroll(code, 71L, 101L);
    }

    @Test
    void restartSafeRetryUsesDurablePaidActivationMarker() throws Exception {
        String code = checkout().get("orderCode").asString();
        willThrow(new AppException(ErrorCode.SERVICE_UNAVAILABLE)).given(learning).enroll(code, 71L, 101L);
        assertThat(ipn(signed(callback(code, "00", "00")))).isEqualTo("00");
        willDoNothing().given(learning).enroll(code, 71L, 101L);
        var retry = new PaidCourseActivationRetry(payments, activation);
        retry.retryPendingActivation();
        retry.retryPendingActivation();
        assertThat(order(code).get("payment").get("enrollmentReady").asBoolean()).isTrue();
        then(learning).should(times(2)).enroll(code, 71L, 101L);
    }

    @Test
    void mockAdminAndAnonymousCallersCannotManufactureProviderStates() throws Exception {
        String code = checkout().get("orderCode").asString();
        String mock = BASE + "/mock/orders/" + code + "/complete";
        assertThat(
            request(mock, token(71L, "USER"), "POST", "{\"status\":\"SUCCESS\"}").statusCode()
        ).isEqualTo(409);
        String admin = BASE + "/admin/orders/" + code;
        for (String status : new String[] { "SUCCESS", "FAILED", "CANCELLED", "REFUNDED" }) {
            assertThat(
                request(
                    admin + "/status",
                    token(71L, "ADMIN"),
                    "PATCH",
                    "{\"status\":\"" + status + "\"}"
                ).statusCode()
            ).isEqualTo(409);
        }
        var detail = mapper.readTree(request(admin, token(71L, "ADMIN"), "GET", null).body()).get("data");
        assertThat(detail.get("availableStatuses").size()).isZero();
        assertThat(request(BASE + "/orders/" + code, token(72L, "USER"), "GET", null).statusCode()).isEqualTo(
            403
        );
        for (String path : new String[] { BASE + "/history", BASE + "/admin/analytics", BASE + "/methods" }) {
            assertThat(request(path, null, "GET", null).statusCode()).isEqualTo(401);
        }
        assertThat(request(BASE + "/vnpay/ipn", null, "POST", null).statusCode()).isEqualTo(401);
        assertThat(request(BASE + "/vnpay/ipn/private", null, "GET", null).statusCode()).isEqualTo(401);
        assertThat(order(code).get("payment").get("status").asString()).isEqualTo("PENDING");
    }
}
