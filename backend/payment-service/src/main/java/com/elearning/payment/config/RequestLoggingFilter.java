package com.elearning.payment.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws ServletException, IOException {
        String supplied = request.getHeader("X-Request-ID");
        String requestId =
            supplied != null && supplied.matches("[a-zA-Z0-9-]{1,64}")
                ? supplied
                : UUID.randomUUID().toString();
        long start = System.nanoTime();
        response.setHeader("X-Request-ID", requestId);
        try (var ignored = MDC.putCloseable("requestId", requestId)) {
            chain.doFilter(request, response);
        } finally {
            // Never log bodies, query strings, credentials or identifying path values.
            log.debug(
                "requestId={} method={} status={} durationMs={}",
                requestId,
                request.getMethod(),
                response.getStatus(),
                (System.nanoTime() - start) / 1_000_000
            );
        }
    }
}
