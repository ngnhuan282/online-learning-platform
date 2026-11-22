package com.elearning.learning;

import static org.assertj.core.api.Assertions.*;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.service.ShopService;
import java.net.URI;
import java.net.http.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=${GEM_TEST_DB_URL:jdbc:h2:mem:gem-topup;MODE=MySQL;DB_CLOSE_DELAY=-1}",
    "spring.datasource.username=${GEM_TEST_DB_USERNAME:sa}",
    "spring.datasource.password=${GEM_TEST_DB_PASSWORD:}",
    "spring.datasource.driver-class-name=${GEM_TEST_DB_DRIVER:org.h2.Driver}",
    "security.jwt.secret=gem-topup-test-secret-at-least-32-bytes",
    "logging.level.root=WARN"
})
@ActiveProfiles("test")
class GemTopUpIntegrationTests {
    @Autowired ShopService shop;
    @Autowired JdbcTemplate jdbc;
    @LocalServerPort int port;
    final HttpClient client = HttpClient.newHttpClient();

    @BeforeEach
    void cleanReceipts() {
        jdbc.update("DELETE FROM gem_topup_receipts");
        jdbc.update("DELETE FROM learner_profiles");
    }

    @Test
    void credit_whenPaymentOrderIsReplayed_shouldCreditOnceAndRejectConflict() {
        // Arrange
        // Act
        shop.grantGems("GEM_ORDER_1", 701, 200);
        shop.grantGems("GEM_ORDER_1", 701, 200);
        // Assert
        assertThat(balance(701)).isEqualTo(200);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gem_topup_receipts", Long.class)).isEqualTo(1);
        assertThatThrownBy(() -> shop.grantGems("GEM_ORDER_1", 701, 500))
            .isInstanceOf(AppException.class).extracting("errorCode").isEqualTo(ErrorCode.CONFLICT);
        assertThatThrownBy(() -> shop.grantGems("GEM_ORDER_1", 702, 200))
            .isInstanceOf(AppException.class).extracting("errorCode").isEqualTo(ErrorCode.CONFLICT);
        assertThat(balance(701)).isEqualTo(200);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM learner_profiles WHERE user_id=702", Long.class)).isZero();
    }

    @Test
    void credit_whenConcurrentOrdersAndRetriesArrive_shouldPreserveExactBalance() throws Exception {
        // Arrange
        // Act
        try (var executor = Executors.newFixedThreadPool(6)) {
            List<Callable<Void>> tasks = new ArrayList<>();
            for (int i = 0; i < 8; i++) {
                tasks.add(() -> { shop.grantGems("GEM_REPLAY", 703, 200); return null; });
            }
            for (int i = 0; i < 5; i++) {
                String order = "GEM_DISTINCT_" + i;
                tasks.add(() -> { shop.grantGems(order, 703, 500); return null; });
            }
            for (var result : executor.invokeAll(tasks)) result.get(20, TimeUnit.SECONDS);
        }
        // Assert
        assertThat(balance(703)).isEqualTo(2700);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gem_topup_receipts", Long.class)).isEqualTo(6);
    }

    @Test
    void credit_whenRequestIsUnauthenticatedOrInvalid_shouldRejectBeforeCrediting() throws Exception {
        // Arrange
        String payload = "{\"orderCode\":\"GEM_HTTP\",\"userId\":704,\"gems\":200}";
        // Act
        assertThat(post(payload, null).statusCode()).isEqualTo(401);
        assertThat(post(payload, "wrong-internal-token").statusCode()).isEqualTo(401);
        assertThat(post(payload, internalToken()).statusCode()).isEqualTo(200);
        assertThat(post(payload, internalToken()).statusCode()).isEqualTo(200);
        assertThat(post(payload.replace("200", "500"), internalToken()).statusCode()).isEqualTo(409);
        assertThat(balance(704)).isEqualTo(200);
        for (String invalid : List.of(
            "{\"userId\":704,\"gems\":200}",
            "{\"orderCode\":\"bad/order\",\"userId\":704,\"gems\":200}",
            "{\"orderCode\":\"BAD\",\"userId\":0,\"gems\":200}",
            "{\"orderCode\":\"BAD\",\"userId\":704,\"gems\":0}"
        )) assertThat(post(invalid, internalToken()).statusCode()).isEqualTo(400);
        // Assert
        assertThat(balance(704)).isEqualTo(200);
    }

    @Test
    void credit_whenServiceInputIsInvalid_shouldAvoidCreatingWalletOrReceipt() {
        // Arrange
        // Act
        for (String order : Arrays.asList(null, "", "../bad", "x".repeat(65))) {
            assertThatThrownBy(() -> shop.grantGems(order, 705, 200))
                .isInstanceOf(AppException.class).extracting("errorCode").isEqualTo(ErrorCode.BAD_REQUEST);
        }
        // Assert
        assertThatThrownBy(() -> shop.grantGems("INVALID", 0, 200)).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> shop.grantGems("INVALID", 705, -1)).isInstanceOf(AppException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gem_topup_receipts", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM learner_profiles", Long.class)).isZero();
    }

    @Test
    void credit_whenWalletUpdateFails_shouldRollBackReceiptAndAllowRetry() {
        // Arrange
        // Act
        shop.grantGems("FULL_WALLET", 706, Integer.MAX_VALUE);
        assertThatThrownBy(() -> shop.grantGems("OVERFLOW", 706, 1)).isInstanceOf(RuntimeException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gem_topup_receipts WHERE order_code='OVERFLOW'", Long.class)).isZero();
        jdbc.update("UPDATE learner_profiles SET gems=0 WHERE user_id=706");
        shop.grantGems("OVERFLOW", 706, 1);
        // Assert
        assertThat(balance(706)).isEqualTo(1);
    }

    int balance(long userId) {
        return jdbc.queryForObject("SELECT gems FROM learner_profiles WHERE user_id=?", Integer.class, userId);
    }

    String internalToken() { return "test-internal-service-token-1234567890"; }

    HttpResponse<String> post(String payload, String token) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/internal/v1/learning/gem-topup"))
            .header("Content-Type", "application/json");
        if (token != null) request.header("X-Internal-Service-Token", token);
        return client.send(request.POST(HttpRequest.BodyPublishers.ofString(payload)).build(), HttpResponse.BodyHandlers.ofString());
    }
}
