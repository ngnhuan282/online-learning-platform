package com.elearning.learning;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.service.CourseCatalogClient;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

class CourseCatalogClientTests {

    @Test
    void delegatesOnlyTheAuthenticatedCurrentRequestToReadPrivateCurriculum() throws Exception {
        var received = new AtomicReference<String>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/v1/courses/42", exchange -> {
            String authorization = exchange.getRequestHeaders().getFirst("Authorization");
            received.set(authorization);
            boolean sections = exchange.getRequestURI().getPath().endsWith("/sections");
            String content = authorization == null ? "null" : "\"Authorized private lesson\"";
            String body = sections
                ? """
                  {"success":true,"data":[{"id":9,"courseId":42,"title":"Section","orderIndex":0,"lessons":[
                  {"id":812,"sectionId":9,"title":"Private lesson","lessonType":"TEXT","content":%s,"orderIndex":0,"preview":false}]}]}
                  """.formatted(content)
                : "{\"success\":true,\"data\":{\"id\":42,\"title\":\"Course\",\"status\":\"PUBLISHED\",\"price\":0}}";
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (var output = exchange.getResponseBody()) {
                output.write(bytes);
            }
        });
        server.start();
        try {
            var client = new CourseCatalogClient("http://127.0.0.1:" + server.getAddress().getPort());
            var request = new MockHttpServletRequest();
            request.addHeader("Authorization", "Bearer caller-one");
            RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
            // A header alone is insufficient; Learning must have authenticated this caller.
            SecurityContextHolder.clearContext();
            assertThat(client.getCurriculum(42L).sections().get(0).lessons().get(0).content()).isNull();
            assertThat(received.get()).isNull();

            SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("1", null, List.of())
            );
            assertThat(client.getCurriculum(42L).sections().get(0).lessons().get(0).content())
                .isEqualTo("Authorized private lesson");
            assertThat(received.get()).isEqualTo("Bearer caller-one");

            var otherRequest = new MockHttpServletRequest();
            otherRequest.addHeader("Authorization", "Bearer caller-two");
            RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(otherRequest));
            SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("2", null, List.of())
            );
            client.getCurriculum(42L);
            assertThat(received.get()).isEqualTo("Bearer caller-two");

            RequestContextHolder.resetRequestAttributes();
            SecurityContextHolder.clearContext();
            assertThat(client.getCurriculum(42L).sections().get(0).lessons().get(0).content()).isNull();
            assertThat(received.get()).isNull();
        } finally {
            RequestContextHolder.resetRequestAttributes();
            SecurityContextHolder.clearContext();
            server.stop(0);
        }
    }

    @Test
    void onlyPublishedFreeCoursesAllowDirectEnrollment() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/v1/courses/", exchange -> {
            long id = Long.parseLong(exchange.getRequestURI().getPath().replace("/api/v1/courses/", ""));
            String status = id == 3 ? "DRAFT" : "PUBLISHED";
            String price = id == 2 ? "100000" : id == 4 ? "null" : "0";
            String body =
                "{\"success\":true,\"data\":{\"id\":" +
                id +
                ",\"price\":" +
                price +
                ",\"status\":\"" +
                status +
                "\"}}";
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (var stream = exchange.getResponseBody()) {
                stream.write(bytes);
            }
        });
        server.start();
        try {
            CourseCatalogClient client = new CourseCatalogClient(
                "http://127.0.0.1:" + server.getAddress().getPort()
            );
            assertThatCode(() -> client.requireFreeCourse(1L)).doesNotThrowAnyException();
            for (long id : new long[] { 2, 3, 4 }) {
                assertThatThrownBy(() -> client.requireFreeCourse(id))
                    .isInstanceOf(AppException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.FORBIDDEN);
            }
        } finally {
            server.stop(0);
        }
    }

    @Test
    void validatesCourseThroughCourseServiceAndRejectsMissingOrUnavailableCourses() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/v1/courses/", exchange -> {
            String id = exchange.getRequestURI().getPath().replace("/api/v1/courses/", "");
            int status = switch (id) {
                case "42", "43" -> 200;
                case "401" -> 401;
                case "403" -> 403;
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
                .extracting("errorCode")
                .isEqualTo(ErrorCode.SERVICE_UNAVAILABLE);
            assertThatThrownBy(() -> client.requireExistingCourse(404L))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.NOT_FOUND);
            assertThatThrownBy(() -> client.requireExistingCourse(500L))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.SERVICE_UNAVAILABLE);
            assertThatThrownBy(() -> client.requireExistingCourse(401L))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UNAUTHORIZED);
            assertThatThrownBy(() -> client.requireExistingCourse(403L))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
        } finally {
            server.stop(0);
        }
    }
}
