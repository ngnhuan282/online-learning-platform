package com.elearning.auth.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class RefreshTokenCookie {

    public static final String NAME = "refresh_token";
    private final boolean secure;
    private final long expirationSeconds;

    public static String read(HttpServletRequest request) {
        if (request.getCookies() != null) for (var cookie : request.getCookies()) {
            if (NAME.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }

    @Autowired
    public RefreshTokenCookie(@Value("${security.refresh.cookie-secure:false}") boolean secure,
        @Value("${security.refresh.expiration-seconds:604800}") long expirationSeconds) {
        this.secure = secure;
        this.expirationSeconds = expirationSeconds;
    }

    public RefreshTokenCookie(boolean secure) {
        this(secure, 604800);
    }

    public String issue(String rawToken) {
        return cookie(rawToken).build().toString();
    }

    public String issue(String rawToken, boolean persistent) {
        return persistent ? cookie(rawToken).maxAge(expirationSeconds).build().toString() : issue(rawToken);
    }

    public String clear() {
        return cookie("").maxAge(0).build().toString();
    }

    private ResponseCookie.ResponseCookieBuilder cookie(String value) {
        return ResponseCookie.from(NAME, value)
            .httpOnly(true)
            .secure(secure)
            .sameSite("Lax")
            .path("/api/v1/auth");
    }
}
