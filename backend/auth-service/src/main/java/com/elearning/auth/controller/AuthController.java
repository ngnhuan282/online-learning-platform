package com.elearning.auth.controller;

import com.elearning.auth.common.response.ApiResponse;
import com.elearning.auth.dto.*;
import com.elearning.auth.security.RefreshTokenCookie;
import com.elearning.auth.service.AuthService;
import com.elearning.auth.service.RefreshTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService auth;
    private final RefreshTokenService refreshTokens;
    private final RefreshTokenCookie cookies;

    public AuthController(AuthService auth, RefreshTokenService refreshTokens, RefreshTokenCookie cookies) {
        this.auth = auth;
        this.refreshTokens = refreshTokens;
        this.cookies = cookies;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.success(auth.register(request));
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(
        @Valid @RequestBody LoginRequest request,
        HttpServletResponse response
    ) {
        var result = auth.login(request);
        response.addHeader(HttpHeaders.SET_COOKIE, cookies.issue(refreshTokens.create(result.user().id())));
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        return ApiResponse.success(result);
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(HttpServletRequest request, HttpServletResponse response) {
        var result = refreshTokens.rotate(refreshCookie(request));
        response.addHeader(HttpHeaders.SET_COOKIE, cookies.issue(result.rawToken()));
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        return ApiResponse.success(result.auth());
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        refreshTokens.revoke(refreshCookie(request));
        response.addHeader(HttpHeaders.SET_COOKIE, cookies.clear());
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        return ApiResponse.success(null);
    }

    private String refreshCookie(HttpServletRequest request) {
        if (request.getCookies() != null) for (var cookie : request.getCookies()) {
            if (RefreshTokenCookie.NAME.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }
}
