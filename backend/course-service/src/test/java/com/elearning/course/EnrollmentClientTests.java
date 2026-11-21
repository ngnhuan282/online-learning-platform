package com.elearning.course;

import static org.assertj.core.api.Assertions.assertThat;

import com.elearning.course.integration.learning.EnrollmentClient;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

class EnrollmentClientTests {

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void enrolledLessonCheckForwardsAuthenticationToLearning() throws Exception {
        var authorization = new AtomicReference<String>();
        var query = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/v1/learning/enrollments/check", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            query.set(exchange.getRequestURI().getQuery());
            byte[] body = "{\"success\":true,\"data\":{\"enrolled\":true,\"status\":\"ACTIVE\",\"userId\":42,\"courseId\":7}}"
                .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            var request = new MockHttpServletRequest();
            request.addHeader("Authorization", "Bearer validated-user-jwt");
            RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
            var client = new EnrollmentClient("http://127.0.0.1:" + server.getAddress().getPort(), false);

            assertThat(client.isEnrolled(42L, 7L)).isTrue();
            assertThat(authorization.get()).isEqualTo("Bearer validated-user-jwt");
            assertThat(query.get()).contains("userId=42", "courseId=7");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void missingAuthenticationNeverAttemptsEnrollmentLookup() {
        var client = new EnrollmentClient("http://127.0.0.1:1", false);
        assertThat(client.isEnrolled(42L, 7L)).isFalse();
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(new MockHttpServletRequest()));
        assertThat(client.isEnrolled(42L, 7L)).isFalse();
    }

    @Test
    void isEnrolled_whenMockEnabled_shouldRequireBothIdentifiers() {
        // Arrange
        var client = new EnrollmentClient("http://127.0.0.1:1", true);

        // Act
        boolean missingUser = client.isEnrolled(null, 7L);
        boolean missingCourse = client.isEnrolled(42L, null);
        boolean bothPresent = client.isEnrolled(42L, 7L);

        // Assert
        assertThat(missingUser).isFalse();
        assertThat(missingCourse).isFalse();
        assertThat(bothPresent).isTrue();
    }

    @Test
    void isEnrolled_whenLearningResponseIsMissingOrUnavailable_shouldDenyEnrollment() throws Exception {
        // Arrange
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/v1/learning/enrollments/check", exchange -> {
            try (exchange) {
                if (exchange.getRequestURI().getQuery().contains("courseId=8")) {
                    exchange.sendResponseHeaders(503, -1);
                    return;
                }
                byte[] body = "{\"success\":true}".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            }
        });
        server.start();
        try {
            var request = new MockHttpServletRequest();
            request.addHeader("Authorization", "Bearer validated-user-jwt");
            RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
            var client = new EnrollmentClient("http://127.0.0.1:" + server.getAddress().getPort(), false);

            // Act
            boolean missingPayload = client.isEnrolled(42L, 7L);
            boolean unavailable = client.isEnrolled(42L, 8L);

            // Assert
            assertThat(missingPayload).isFalse();
            assertThat(unavailable).isFalse();
        } finally {
            server.stop(0);
        }
    }
}
