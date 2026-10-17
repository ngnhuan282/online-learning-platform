package com.elearning.auth.security;

import com.elearning.auth.common.exception.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

// Registered only inside SecurityFilterChain (never as a second servlet filter).
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokens;
    private final SecurityErrorHandler errors;

    public JwtAuthenticationFilter(JwtTokenProvider tokens, SecurityErrorHandler errors) {
        this.tokens = tokens;
        this.errors = errors;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return (
            "POST".equals(request.getMethod()) &&
            Set.of(
                "/api/v1/auth/login",
                "/api/v1/auth/register",
                "/api/v1/auth/refresh",
                "/api/v1/auth/logout",
                "/api/v1/auth/forgot-password",
                "/api/v1/auth/reset-password",
                "/api/v1/auth/google/start",
                "/api/v1/auth/google/exchange"
            ).contains(request.getServletPath())
        );
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (authorization != null) {
            try {
                if (!authorization.regionMatches(true, 0, "Bearer ", 0, 7)) throw new JwtException(
                    "Invalid scheme"
                );
                Claims claims = tokens.validate(authorization.substring(7));
                var authentication = new UsernamePasswordAuthenticationToken(
                    claims.getSubject(),
                    null,
                    tokens
                        .roles(claims)
                        .stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                        .toList()
                );
                var context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(authentication);
                SecurityContextHolder.setContext(context);
            } catch (JwtException | IllegalArgumentException ex) {
                SecurityContextHolder.clearContext();
                errors.write(request, response, ErrorCode.UNAUTHORIZED);
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
