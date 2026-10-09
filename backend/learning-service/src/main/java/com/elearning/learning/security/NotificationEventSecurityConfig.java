package com.elearning.learning.security;

import com.elearning.learning.common.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class NotificationEventSecurityConfig {

    @Bean
    @Order(1)
    SecurityFilterChain notificationEventsChain(
        HttpSecurity http, SecurityErrorHandler errors,
        @Value("${notifications.events.api-key:}") String key
    ) throws Exception {
        return http.securityMatcher("/internal/v1/notifications/**")
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .requestCache(cache -> cache.disable())
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .logout(logout -> logout.disable())
            .authorizeHttpRequests(auth -> auth.anyRequest().hasAuthority("NOTIFICATION_PUBLISH"))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, error) ->
                    errors.write(request, response, ErrorCode.UNAUTHORIZED))
                .accessDeniedHandler((request, response, error) ->
                    errors.write(request, response, ErrorCode.FORBIDDEN)))
            .addFilterBefore(new NotificationEventKeyFilter(key, errors), UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
