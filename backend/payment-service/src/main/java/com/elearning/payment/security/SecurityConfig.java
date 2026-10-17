package com.elearning.payment.security;

import com.elearning.payment.common.exception.ErrorCode;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.client.RestTemplate;

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
    RestTemplate restTemplate() {
        return new RestTemplate();
    }

    @Bean
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
                    .requestMatchers("/actuator/health", "/actuator/health/**")
                    .permitAll()
                    .requestMatchers(
                        HttpMethod.GET,
                        "/api/v1/payments/vnpay/return",
                        "/api/v1/payments/vnpay/ipn"
                    )
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
