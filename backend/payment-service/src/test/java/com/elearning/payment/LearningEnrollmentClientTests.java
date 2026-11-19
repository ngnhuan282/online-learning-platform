package com.elearning.payment;

import static org.assertj.core.api.Assertions.*;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.learning.LearningEnrollmentClient;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

class LearningEnrollmentClientTests {
    @Test
    void verifiesLearningReceiptsAndPreservesConflictAndAvailabilityErrors() throws Exception {
        String token = "learning-test-internal-token-at-least-32-bytes";
        var received = new AtomicReference<String>();
        var response = new AtomicReference<>("{\"success\":true,\"data\":{\"courseId\":42,\"userId\":7}}");
        var status = new AtomicInteger(200);
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/learning/", exchange -> {
            try (exchange) {
                received.set(exchange.getRequestURI().getPath() + " " +
                    exchange.getRequestHeaders().getFirst("X-Internal-Service-Token") + " " +
                    exchange.getRequestHeaders().getFirst("X-Request-ID") + " " +
                    new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                byte[] bytes = response.get().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(status.get(), bytes.length);
                exchange.getResponseBody().write(bytes);
            }
        });
        server.start();
        try (var requestId = MDC.putCloseable("requestId", "request-pay-42")) {
            String endpoint = "http://127.0.0.1:" + server.getAddress().getPort();
            var client = new LearningEnrollmentClient(endpoint, token);
            assertThatThrownBy(() -> new LearningEnrollmentClient(endpoint, "weak")).isInstanceOf(IllegalArgumentException.class);
            client.grantPro("ORDER-PRO", 7L, "PRO_MONTH", 1);
            assertThat(received.get()).startsWith("/internal/v1/learning/pro/grants " + token + " request-pay-42 ")
                .contains("\"orderCode\":\"ORDER-PRO\"", "\"planCode\":\"PRO_MONTH\"", "\"durationMonths\":1");
            client.revokePro("ORDER-PRO", 7L);
            assertThat(received.get()).startsWith("/internal/v1/learning/pro/revocations ");
            client.grantGems("ORDER-GEMS", 7L, 500);
            assertThat(received.get()).startsWith("/internal/v1/learning/gem-topup ")
                .contains("\"orderCode\":\"ORDER-GEMS\"", "\"userId\":7", "\"gems\":500");

            Runnable[] calls = {
                () -> client.enroll("ORDER-COURSE", 7L, 42L),
                () -> client.grantPro("ORDER-PRO", 7L, "PRO_MONTH", 1),
                () -> client.grantGems("ORDER-GEMS", 7L, 500),
            };
            for (var call : calls) {
                status.set(409);
                assertError(call, ErrorCode.CONFLICT);
                status.set(503);
                assertError(call, ErrorCode.SERVICE_UNAVAILABLE);
                status.set(200);
                for (String invalid : new String[]{"", "not JSON", "{\"success\":false}", "{\"success\":true,\"data\":{\"courseId\":99,\"userId\":99}}"}) {
                    response.set(invalid);
                    assertError(call, ErrorCode.SERVICE_UNAVAILABLE);
                }
            }
        } finally {
            server.stop(0);
        }
    }

    private void assertError(Runnable call, ErrorCode code) {
        assertThatThrownBy(call::run).isInstanceOf(AppException.class)
            .extracting("errorCode").isEqualTo(code);
    }


    @Test
    void sendsAuthenticatedPaymentEnrollmentContract() throws Exception {
        String internalToken = "test-internal-service-token-1234567890";
        AtomicReference<String> receivedToken = new AtomicReference<>();
        AtomicReference<String> receivedBody = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/learning/enrollments", exchange -> {
            receivedToken.set(exchange.getRequestHeaders().getFirst("X-Internal-Service-Token"));
            receivedBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] bytes = (
                "{\"success\":true,\"data\":{\"id\":9,\"courseId\":42,\"status\":\"ACTIVE\"}}"
            ).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (var stream = exchange.getResponseBody()) {
                stream.write(bytes);
            }
        });
        server.start();
        try {
            LearningEnrollmentClient client = new LearningEnrollmentClient(
                "http://127.0.0.1:" + server.getAddress().getPort(),
                internalToken
            );

            client.enroll("LS-PAY-CONTRACT-001", 7L, 42L);

            assertThat(receivedToken.get()).isEqualTo(internalToken);
            assertThat(receivedBody.get())
                .contains("\"orderCode\":\"LS-PAY-CONTRACT-001\"")
                .contains("\"userId\":7")
                .contains("\"courseId\":42");
        } finally {
            server.stop(0);
        }
    }
}
