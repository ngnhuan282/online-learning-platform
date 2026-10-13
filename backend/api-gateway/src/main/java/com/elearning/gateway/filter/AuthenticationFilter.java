package com.elearning.gateway.filter;

import com.elearning.gateway.security.JwtTokenProvider;
import io.jsonwebtoken.JwtException;
import java.util.Set;
import org.springframework.core.Ordered;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

@Component
public class AuthenticationFilter implements WebFilter, Ordered {

    private final JwtTokenProvider tokens;

    public AuthenticationFilter(JwtTokenProvider tokens) {
        this.tokens = tokens;
    }

    @Override
    public int getOrder() {
        return -100;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        HttpMethod method = exchange.getRequest().getMethod();
        String authorization = exchange.getRequest().getHeaders().getFirst("Authorization");
        boolean publicAuth =
            method == HttpMethod.POST &&
            Set.of(
                "/api/v1/auth/login",
                "/api/v1/auth/register",
                "/api/v1/auth/refresh",
                "/api/v1/auth/logout"
            ).contains(path);
        boolean publicRequest =
            method == HttpMethod.OPTIONS ||
            path.equals("/actuator/health") ||
            path.startsWith("/actuator/health/") ||
            path.equals("/v3/api-docs") ||
            path.startsWith("/v3/api-docs/") ||
            path.equals("/swagger-ui.html") ||
            path.startsWith("/swagger-ui/") ||
            publicAuth ||
            (method == HttpMethod.GET &&
                (path.equals("/api/v1/courses") ||
                    path.matches("/api/v1/courses/[^/]+") ||
                    path.matches("/api/v1/courses/[^/]+/sections") ||
                    path.matches("/api/v1/courses/[^/]+/reviews") ||
                    path.equals("/api/v1/categories") ||
                    path.matches("/api/v1/categories/[^/]+") ||
                    path.matches("/api/v1/lessons/[^/]+/resources") ||
                    path.matches("/api/v1/media/download/.+")));
        if (authorization != null && !publicAuth) {
            try {
                if (!authorization.regionMatches(true, 0, "Bearer ", 0, 7)) throw new JwtException(
                    "Invalid scheme"
                );
                tokens.validate(authorization.substring(7));
            } catch (JwtException | IllegalArgumentException ex) {
                return Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED));
            }
        } else if (!publicRequest) {
            return Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        }
        // Services validate the forwarded JWT, never caller-supplied identity headers.
        var request = exchange
            .getRequest()
            .mutate()
            .headers(headers -> {
                headers.remove("X-User-Id");
                headers.remove("X-User-Role");
                headers.remove("X-User-Roles");
                headers.remove("X-Internal-Service-Token");
            })
            .build();
        return chain.filter(exchange.mutate().request(request).build());
    }
}
