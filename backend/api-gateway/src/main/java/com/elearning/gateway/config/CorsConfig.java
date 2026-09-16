package com.elearning.gateway.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.DefaultCorsProcessor;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import org.springframework.web.server.ResponseStatusException;

@Configuration
public class CorsConfig {

    @Bean
    CorsWebFilter corsWebFilter(@Value("${app.cors.allowed-origins}") String origins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(
            Arrays.stream(origins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList()
        );
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Request-ID"));
        config.setExposedHeaders(List.of("X-Request-ID"));
        config.setAllowCredentials(true);
        config.validateAllowCredentials();
        config.setMaxAge(3600L);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new OrderedCorsWebFilter(source);
    }

    // Run before authentication so auth errors also have CORS headers.
    static class OrderedCorsWebFilter extends CorsWebFilter implements Ordered {

        OrderedCorsWebFilter(UrlBasedCorsConfigurationSource source) {
            super(
                source,
                new DefaultCorsProcessor() {
                    @Override
                    protected void rejectRequest(ServerHttpResponse response) {
                        // Let the Gateway handler format rejected preflights as API errors too.
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN);
                    }
                }
            );
        }

        @Override
        public int getOrder() {
            return -300;
        }
    }
}
