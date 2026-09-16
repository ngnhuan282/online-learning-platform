package com.elearning.gateway;

import static org.assertj.core.api.Assertions.*;

import com.elearning.gateway.exception.GatewayExceptionHandler;
import java.net.ConnectException;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import tools.jackson.databind.json.JsonMapper;

class GatewayExceptionHandlerTests {

    @Test
    void normalizesConnectionTimeoutAndUnexpectedFailures() {
        var mapper = JsonMapper.builder().build();
        var handler = new GatewayExceptionHandler(mapper);
        Throwable[] errors = {
            new ConnectException("private-host"),
            new TimeoutException("internal timeout"),
            new IllegalStateException("internal failure"),
        };
        int[] statuses = { 503, 504, 500 };
        String[] codes = { "SERVICE_UNAVAILABLE", "GATEWAY_TIMEOUT", "GATEWAY_ERROR" };
        for (int i = 0; i < errors.length; i++) {
            var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/courses?secret=hidden")
            );
            handler.handle(exchange, errors[i]).block();
            assertThat(exchange.getResponse().getStatusCode().value()).isEqualTo(statuses[i]);
            String body = exchange.getResponse().getBodyAsString().block();
            assertThat(body).doesNotContain("hidden", "private-host", "internal", "trace");
            var json = mapper.readTree(body);
            assertThat(json.get("code").asString()).isEqualTo(codes[i]);
            assertThat(json.get("path").asString()).isEqualTo("/api/v1/courses");
            assertThat(json.get("errors").isNull()).isTrue();
        }
    }
}
