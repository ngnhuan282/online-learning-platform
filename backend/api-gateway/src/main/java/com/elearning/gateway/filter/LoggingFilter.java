package com.elearning.gateway.filter;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

@Component
public class LoggingFilter implements WebFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(LoggingFilter.class);

    @Override
    public int getOrder() {
        return -400;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String requestId = UUID.randomUUID().toString();
        long start = System.nanoTime();
        exchange.getResponse().getHeaders().set("X-Request-ID", requestId);
        exchange.getResponse().beforeCommit(() -> {
            // Never log tokens, bodies, query strings or identifying path values.
            log.info(
                "requestId={} method={} status={} durationMs={}",
                requestId,
                exchange.getRequest().getMethod(),
                exchange.getResponse().getStatusCode(),
                (System.nanoTime() - start) / 1_000_000
            );
            return Mono.empty();
        });
        var request = exchange
            .getRequest()
            .mutate()
            .headers(headers -> headers.set("X-Request-ID", requestId))
            .build();
        return chain.filter(exchange.mutate().request(request).build());
    }
}
