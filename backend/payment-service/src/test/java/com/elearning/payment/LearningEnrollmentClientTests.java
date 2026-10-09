package com.elearning.payment;

import static org.assertj.core.api.Assertions.*;

import com.elearning.payment.learning.LearningEnrollmentClient;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class LearningEnrollmentClientTests {

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
