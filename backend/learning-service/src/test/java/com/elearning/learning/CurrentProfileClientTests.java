package com.elearning.learning;

import static org.assertj.core.api.Assertions.assertThat;

import com.elearning.learning.service.CurrentProfileClient;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class CurrentProfileClientTests {
    @Test
    void current_whenAuthIsUnavailable_shouldReturnNoProfileAndPreserveCallerIdentity() throws Exception {
        // Arrange
        var body = new AtomicReference<>("{\"success\":true,\"data\":{\"id\":7,\"fullName\":\"Learner Seven\"}}");
        var received = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/v1/users/me", exchange -> {
            try (exchange) {
                received.set(exchange.getRequestHeaders().getFirst("Authorization"));
                var bytes = body.get().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, bytes.length);
                exchange.getResponseBody().write(bytes);
            }
        });
        server.start();

        try {
            var client = new CurrentProfileClient("http://127.0.0.1:" + server.getAddress().getPort());
            // Act
            assertThat(client.current(null)).isNull();
            // Assert
            assertThat(received.get()).isNull();
            assertThat(client.current("Bearer caller")).isEqualTo(new CurrentProfileClient.Profile(7L, "Learner Seven"));
            assertThat(received.get()).isEqualTo("Bearer caller");
            for (String invalid : new String[]{"", "{\"success\":false}", "not JSON"}) {
                body.set(invalid);
                assertThat(client.current("Bearer caller")).isNull();
            }
        } finally {
            server.stop(0);
        }
    }
}
