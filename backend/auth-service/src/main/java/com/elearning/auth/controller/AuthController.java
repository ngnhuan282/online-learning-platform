package com.elearning.auth.controller;

import com.elearning.auth.common.response.ApiResponse;
import com.elearning.auth.dto.*;
import com.elearning.auth.security.RefreshTokenCookie;
import com.elearning.auth.service.AuthService;
import com.elearning.auth.service.RefreshTokenService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "Access JWT and HttpOnly refresh cookie lifecycle")
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
    @Operation(summary = "Register a learner", description = "Creates an ACTIVE user with the default USER role. Duplicate email returns 409.")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.success(auth.register(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Log in", description = "Returns an access token and sets the HttpOnly refresh cookie. Invalid credentials return 401; locked or disabled accounts return 403.")
    public ApiResponse<AuthResponse> login(
        @Valid @RequestBody LoginRequest request,
        HttpServletResponse response
    ) {
        var result = auth.login(request);
        response.addHeader(HttpHeaders.SET_COOKIE, cookies.issue(refreshTokens.create(result.user().id(), request.rememberMe()), request.rememberMe()));
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        return ApiResponse.success(result);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate refresh token", description = "Requires the refresh_token HttpOnly cookie, rotates it and returns a new access token. Missing, invalid, expired or revoked cookies return 401.")
    public ApiResponse<AuthResponse> refresh(HttpServletRequest request, HttpServletResponse response) {
        var result = refreshTokens.rotate(refreshCookie(request));
        response.addHeader(HttpHeaders.SET_COOKIE, cookies.issue(result.rawToken(), result.persistent()));
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        return ApiResponse.success(result.auth());
    }

    @PostMapping("/logout")
    @Operation(summary = "Log out", description = "Revokes the current refresh cookie and clears it. Access JWTs expire independently.")
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
