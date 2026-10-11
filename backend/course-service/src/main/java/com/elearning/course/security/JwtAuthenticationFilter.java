package com.elearning.course.security;

import com.elearning.course.common.exception.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
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
                var authorities = new java.util.ArrayList<SimpleGrantedAuthority>();
                tokens
                    .roles(claims)
                    .forEach(role -> authorities.add(new SimpleGrantedAuthority("ROLE_" + role)));
                tokens
                    .permissions(claims)
                    .forEach(permission -> authorities.add(new SimpleGrantedAuthority(permission)));
                var authentication = new UsernamePasswordAuthenticationToken(
                    claims.getSubject(),
                    null,
                    authorities
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
