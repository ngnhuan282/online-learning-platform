package com.elearning.learning.security;

import com.elearning.learning.common.exception.ErrorCode;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import jakarta.servlet.DispatcherType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException("Only JWT authentication is supported");
        };
    }

    @Bean
    @Order(2)
    SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        JwtTokenProvider tokens,
        SecurityErrorHandler errors
    ) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .requestCache(cache -> cache.disable())
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .logout(logout -> logout.disable())
            .authorizeHttpRequests(auth ->
                auth
                    .requestMatchers(request -> request.getDispatcherType() == DispatcherType.ASYNC
                        && request.getRequestURI().equals("/api/v1/learning/notifications/stream"))
                    .permitAll()
                    .requestMatchers("/actuator/health", "/actuator/health/**")
                    .permitAll()
                    .requestMatchers("/internal/v1/learning/enrollments")
                    .permitAll()
                    .requestMatchers("/error")
                    .permitAll()
                    .anyRequest()
                    .authenticated()
            )
            .exceptionHandling(ex ->
                ex
                    .authenticationEntryPoint((request, response, error) ->
                        errors.write(request, response, ErrorCode.UNAUTHORIZED)
                    )
                    .accessDeniedHandler((request, response, error) ->
                        errors.write(request, response, ErrorCode.FORBIDDEN)
                    )
            )
            .addFilterBefore(
                new JwtAuthenticationFilter(tokens, errors),
                UsernamePasswordAuthenticationFilter.class
            )
            .build();
    }
}
