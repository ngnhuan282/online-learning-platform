package com.elearning.gateway;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;

import com.elearning.gateway.filter.AuthenticationFilter;
import com.elearning.gateway.security.JwtTokenProvider;
import java.net.InetSocketAddress;
import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

class AuthenticationFilterTests {

    @Test
    void filter_whenForwardedAddressIsUnresolvedNumericIp_shouldSetVerifiedPaymentIpAndStripForgedHeaders() {
        // Arrange
        var filter = new AuthenticationFilter(mock(JwtTokenProvider.class));
        var exchange = MockServerWebExchange.from(
            MockServerHttpRequest.get("/api/v1/courses")
                .remoteAddress(InetSocketAddress.createUnresolved("203.0.113.7", 12345))
                .header("X-Payment-Client-IP", "forged")
                .header("X-User-Id", "999")
                .build()
        );
        // Act
        filter
            .filter(exchange, forwarded -> {
                // Assert
                assertThat(forwarded.getRequest().getHeaders().getFirst("X-Payment-Client-IP")).isEqualTo(
                    "203.0.113.7"
                );
                assertThat(forwarded.getRequest().getHeaders().getFirst("X-User-Id")).isNull();
                return Mono.empty();
            })
            .block();
    }

    @Test
    void filter_whenForwardedAddressIsUnresolvedHostname_shouldOmitPaymentClientIp() {
        // Arrange
        var filter = new AuthenticationFilter(mock(JwtTokenProvider.class));
        var exchange = MockServerWebExchange.from(
            MockServerHttpRequest.get("/api/v1/courses")
                .remoteAddress(InetSocketAddress.createUnresolved("untrusted.test", 12345))
                .header("X-Payment-Client-IP", "forged")
                .build()
        );
        // Act
        filter
            .filter(exchange, forwarded -> {
                // Assert
                assertThat(forwarded.getRequest().getHeaders().getFirst("X-Payment-Client-IP")).isNull();
                return Mono.empty();
            })
            .block();
    }
}
