package com.elearning.learning;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.service.CourseCatalogClient;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class CourseCatalogClientTests {

    @Test
    void validatesCourseThroughCourseServiceAndRejectsMissingOrUnavailableCourses() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/v1/courses/", exchange -> {
            String id = exchange.getRequestURI().getPath().replace("/api/v1/courses/", "");
            int status = switch (id) {
                case "42", "43" -> 200;
                case "404" -> 404;
                default -> 503;
            };
            String body = "{\"success\":true,\"data\":{\"id\":42}}";
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            try (var stream = exchange.getResponseBody()) {
                stream.write(bytes);
            }
        });
        server.start();
        try {
            CourseCatalogClient client = new CourseCatalogClient(
                "http://127.0.0.1:" + server.getAddress().getPort()
            );
            assertThatCode(() -> client.requireExistingCourse(42L)).doesNotThrowAnyException();
            assertThatThrownBy(() -> client.requireExistingCourse(43L))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.SERVICE_UNAVAILABLE);
            assertThatThrownBy(() -> client.requireExistingCourse(404L))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.NOT_FOUND);
            assertThatThrownBy(() -> client.requireExistingCourse(500L))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.SERVICE_UNAVAILABLE);
        } finally {
            server.stop(0);
        }
    }
}
