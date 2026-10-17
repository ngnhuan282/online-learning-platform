package com.elearning.auth.controller;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.common.exception.ErrorCode;
import com.elearning.auth.common.response.ApiResponse;
import com.elearning.auth.dto.AuthResponse;
import com.elearning.auth.security.GoogleLoginProperties;
import com.elearning.auth.security.RefreshTokenCookie;
import com.elearning.auth.service.GoogleLoginCodeService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import com.elearning.auth.security.GoogleOAuth2Config;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth/google")
public class GoogleLoginController {

    private final GoogleLoginProperties properties;
    private final GoogleLoginCodeService codes;
    private final RefreshTokenCookie cookies;

    public GoogleLoginController(
        GoogleLoginProperties properties,
        GoogleLoginCodeService codes,
        RefreshTokenCookie cookies
    ) {
        this.properties = properties;
        this.codes = codes;
        this.cookies = cookies;
    }

    @PostMapping("/start")
    public ApiResponse<Map<String, String>> start(
        @Valid @RequestBody StartRequest request,
        HttpServletResponse response,
        HttpServletRequest servletRequest
    ) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        if (!properties.enabled()) throw new AppException(ErrorCode.GOOGLE_LOGIN_UNAVAILABLE);
        GoogleOAuth2Config.resetOAuthSession(servletRequest);
        return ApiResponse.success(
            Map.of("authorizationPath", GoogleLoginProperties.AUTHORIZE + "?challenge=" + request.challenge())
        );
    }

    @PostMapping("/exchange")
    public ApiResponse<AuthResponse> exchange(
        @Valid @RequestBody ExchangeRequest request,
        HttpServletResponse response
    ) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        if (!properties.enabled()) throw new AppException(ErrorCode.GOOGLE_LOGIN_UNAVAILABLE);
        var result = codes.exchange(request.code(), request.verifier());
        response.addHeader(HttpHeaders.SET_COOKIE, cookies.issue(result.rawToken()));
        return ApiResponse.success(result.auth());
    }

    public record StartRequest(@NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{43}") String challenge) {}

    public record ExchangeRequest(
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{43}") String code,
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{43}") String verifier
    ) {
        @Override
        public String toString() {
            return "ExchangeRequest[redacted]";
        }
    }
}
