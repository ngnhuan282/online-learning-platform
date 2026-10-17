package com.elearning.auth.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class RefreshTokenCookie {

    public static final String NAME = "refresh_token";
    private final boolean secure;

    public static String read(HttpServletRequest request) {
        if (request.getCookies() != null) for (var cookie : request.getCookies()) {
            if (NAME.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }

    public RefreshTokenCookie(@Value("${security.refresh.cookie-secure:false}") boolean secure) {
        this.secure = secure;
    }

    public String issue(String rawToken) {
        return cookie(rawToken).build().toString();
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
