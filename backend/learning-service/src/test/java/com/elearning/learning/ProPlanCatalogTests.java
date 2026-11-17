package com.elearning.learning;

import static org.assertj.core.api.Assertions.*;

import com.elearning.learning.service.ProPlanCatalog;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

class ProPlanCatalogTests {

    @Test
    void customCatalogForwardsCallerAuthorizationAndReadsDurationMetadata() throws Exception {
        var authorization = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/v1/payments/pro/plans", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] body =
                "{\"success\":true,\"message\":\"Success\",\"data\":[{\"code\":\"PRO_CUSTOM_TEST\",\"durationMonths\":3,\"name\":\"Quarterly\",\"price\":120000,\"currency\":\"VND\"}]}".getBytes(
                    StandardCharsets.UTF_8
                );
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(
                "Bearer catalog-test-caller".equals(authorization.get()) ? 200 : 401,
                body.length
            );
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            var request = new MockHttpServletRequest();
            request.addHeader("Authorization", "Bearer catalog-test-caller");
            RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
            var client = new ProPlanCatalog("http://127.0.0.1:" + server.getAddress().getPort());
            assertThat(client.months("PRO_CUSTOM_TEST")).isEqualTo(3);
            assertThat(authorization.get()).isEqualTo("Bearer catalog-test-caller");
            assertThatThrownBy(() -> client.months("PRO_MISSING")).isInstanceOf(
                com.elearning.learning.common.exception.AppException.class
            );
        } finally {
            RequestContextHolder.resetRequestAttributes();
            server.stop(0);
        }
    }
}
