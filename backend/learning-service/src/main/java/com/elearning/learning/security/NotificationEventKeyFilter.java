package com.elearning.learning.security;

import com.elearning.learning.common.exception.ErrorCode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class NotificationEventKeyFilter extends OncePerRequestFilter {

    private final byte[] key;
    private final SecurityErrorHandler errors;

    public NotificationEventKeyFilter(String key, SecurityErrorHandler errors) {
        this.key = key.isBlank() ? new byte[0] : key.getBytes(StandardCharsets.UTF_8);
        this.errors = errors;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request, HttpServletResponse response, FilterChain chain
    ) throws ServletException, IOException {
        if (key.length == 0) {
            errors.write(request, response, ErrorCode.SERVICE_UNAVAILABLE);
            return;
        }
        String supplied = request.getHeader("X-Notification-Key");
        if (supplied == null || !MessageDigest.isEqual(key, supplied.getBytes(StandardCharsets.UTF_8))) {
            errors.write(request, response, ErrorCode.UNAUTHORIZED);
            return;
        }
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(
            "notification-publisher", null, List.of(new SimpleGrantedAuthority("NOTIFICATION_PUBLISH"))
        ));
        SecurityContextHolder.setContext(context);
        chain.doFilter(request, response);
    }
}
