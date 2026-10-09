package com.elearning.payment;

import static org.assertj.core.api.Assertions.*;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.course.CourseSnapshotProvider;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class CourseSnapshotProviderTests {

    @Test
    void usesPublishedCoursePriceAndRejectsUnavailableCourses() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/v1/courses/", exchange -> {
            String id = exchange.getRequestURI().getPath().replace("/api/v1/courses/", "");
            int status = switch (id) {
                case "42", "43", "44" -> 200;
                case "404" -> 404;
                default -> 503;
            };
            String courseStatus = "43".equals(id) ? "DRAFT" : "PUBLISHED";
            long price = "44".equals(id) ? 0 : 790000;
            String body = String.format(
                "{\"success\":true,\"data\":{\"id\":%s,\"title\":\"Business English\"," +
                "\"price\":%d,\"status\":\"%s\"}}",
                id,
                price,
                courseStatus
            );
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            try (var stream = exchange.getResponseBody()) {
                stream.write(bytes);
            }
        });
        server.start();
        try {
            CourseSnapshotProvider provider = new CourseSnapshotProvider(
                "http://127.0.0.1:" + server.getAddress().getPort()
            );

            var course = provider.requirePurchasableCourse(42L);
            assertThat(course.id()).isEqualTo(42L);
            assertThat(course.title()).isEqualTo("Business English");
            assertThat(course.price()).isEqualByComparingTo("790000");
            assertThat(course.currency()).isEqualTo("VND");

            assertError(provider, 43L, ErrorCode.CONFLICT);
            assertError(provider, 44L, ErrorCode.CONFLICT);
            assertError(provider, 404L, ErrorCode.NOT_FOUND);
            assertError(provider, 500L, ErrorCode.SERVICE_UNAVAILABLE);
        } finally {
            server.stop(0);
        }
    }

    private void assertError(
        CourseSnapshotProvider provider,
        Long courseId,
        ErrorCode expected
    ) {
        assertThatThrownBy(() -> provider.requirePurchasableCourse(courseId))
            .isInstanceOf(AppException.class)
            .extracting("errorCode")
            .isEqualTo(expected);
    }
}
