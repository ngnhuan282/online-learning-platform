package com.elearning.auth.controller;

import com.elearning.auth.common.response.ApiResponse;
import com.elearning.auth.dto.ForgotPasswordRequest;
import com.elearning.auth.dto.ResetPasswordRequest;
import com.elearning.auth.security.RefreshTokenCookie;
import com.elearning.auth.service.PasswordResetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication")
public class PasswordResetController {

    public static final String NOTICE =
        "Nếu tài khoản hỗ trợ mật khẩu và có thể khôi phục, bạn sẽ nhận được email hướng dẫn. Vui lòng kiểm tra hộp thư.";
    private final PasswordResetService passwords;
    private final RefreshTokenCookie cookies;

    public PasswordResetController(PasswordResetService passwords, RefreshTokenCookie cookies) {
        this.passwords = passwords;
        this.cookies = cookies;
    }

    @PostMapping("/forgot-password")
    @Operation(
        summary = "Request a password reset",
        description = "Generic response for all eligible/unknown/Google-only accounts. 503 if mail is unconfigured, 429 when throttled. Does not confirm delivery."
    )
    public ApiResponse<Void> forgot(
        @Valid @RequestBody ForgotPasswordRequest body,
        HttpServletResponse response
    ) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        passwords.forgot(body.email());
        return new ApiResponse<>(true, NOTICE, null, Instant.now());
    }

    @PostMapping("/reset-password")
    @Operation(
        summary = "Reset a local password",
        description = "Consumes a valid one-time token and revokes all refresh sessions. No automatic login. Google-only accounts cannot set a password here."
    )
    public ApiResponse<Void> reset(
        @Valid @RequestBody ResetPasswordRequest body,
        HttpServletResponse response
    ) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        passwords.reset(body.token(), body.newPassword());
        response.addHeader(HttpHeaders.SET_COOKIE, cookies.clear());
        return ApiResponse.success(null);
    }
}
