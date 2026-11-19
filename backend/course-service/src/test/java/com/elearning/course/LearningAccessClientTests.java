package com.elearning.course;

import static org.assertj.core.api.Assertions.*;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.integration.learning.LearningAccessClient;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

class LearningAccessClientTests {
    @Test
    void accessRequiresActiveOrCompletedEnrollmentAndFailsClosedDuringUpstreamErrors() throws Exception {
        var body = new AtomicReference<>("""
            {"success":true,"data":[{"courseId":1,"status":"ACTIVE"},
             {"courseId":2,"status":"COMPLETED"},{"courseId":3,"status":"CANCELLED"}]}
            """);
        var status = new AtomicInteger(200);
        var authorization = new AtomicReference<String>();
        var requestId = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/v1/learning/enrollments/me", exchange -> {
            try (exchange) {
                authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
                requestId.set(exchange.getRequestHeaders().getFirst("X-Request-ID"));
                var bytes = body.get().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(status.get(), bytes.length);
                exchange.getResponseBody().write(bytes);
            }
        });
        server.start();
        try (var mdc = MDC.putCloseable("requestId", "course-request-1")) {
            var client = new LearningAccessClient("http://127.0.0.1:" + server.getAddress().getPort());
            assertThat(client.isEnrolled(1L, "Bearer test")).isTrue();
            assertThat(client.isEnrolled(2L, "Bearer test")).isTrue();
            assertThat(client.isEnrolled(3L, "Bearer test")).isFalse();
            assertThat(client.isEnrolled(4L, "Bearer test")).isFalse();
            assertThat(authorization.get()).isEqualTo("Bearer test");
            assertThat(requestId.get()).isEqualTo("course-request-1");
            status.set(401);
            assertError(client, ErrorCode.UNAUTHORIZED);
            status.set(503);
            assertError(client, ErrorCode.SERVICE_UNAVAILABLE);
            status.set(200);
            for (String invalid : new String[]{"", "{\"success\":false}", "{\"success\":true,\"data\":null}", "not JSON"}) {
                body.set(invalid);
                assertError(client, ErrorCode.SERVICE_UNAVAILABLE);
            }
        } finally {
            server.stop(0);
        }
    }

    private void assertError(LearningAccessClient client, ErrorCode code) {
        assertThatThrownBy(() -> client.isEnrolled(1L, "Bearer test"))
            .isInstanceOf(AppException.class).extracting("errorCode").isEqualTo(code);
    }
}
