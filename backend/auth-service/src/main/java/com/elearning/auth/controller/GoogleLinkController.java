package com.elearning.auth.controller;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.common.exception.ErrorCode;
import com.elearning.auth.common.response.ApiResponse;
import com.elearning.auth.security.GoogleLoginProperties;
import com.elearning.auth.security.GoogleOAuth2Config;
import com.elearning.auth.security.RefreshTokenCookie;
import com.elearning.auth.service.GoogleLinkService;
import com.elearning.auth.validation.Utf8Size;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth/google/link")
public class GoogleLinkController {

    private final GoogleLinkService links;
    private final GoogleLoginProperties properties;

    public GoogleLinkController(GoogleLinkService links, GoogleLoginProperties properties) {
        this.links = links;
        this.properties = properties;
    }

    @PostMapping("/start")
    public ApiResponse<Map<String, String>> start(
        Authentication principal,
        @Valid @RequestBody StartRequest body,
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        response.setHeader("Cache-Control", "no-store");
        requireEnabled();
        String intent = links.start(
            userId(principal),
            RefreshTokenCookie.read(request),
            body.currentPassword(),
            body.challenge()
        );
        GoogleOAuth2Config.prepareLink(request, intent, body.challenge());
        return ApiResponse.success(
            Map.of("authorizationPath", GoogleLoginProperties.AUTHORIZE + "?challenge=" + body.challenge())
        );
    }

    @PostMapping("/complete")
    public ApiResponse<GoogleLinkService.Completion> complete(
        Authentication principal,
        @Valid @RequestBody GoogleLoginController.ExchangeRequest body,
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        response.setHeader("Cache-Control", "no-store");
        requireEnabled();
        return ApiResponse.success(
            links.complete(userId(principal), RefreshTokenCookie.read(request), body.code(), body.verifier())
        );
    }

    private void requireEnabled() {
        if (!properties.enabled()) throw new AppException(ErrorCode.GOOGLE_LOGIN_UNAVAILABLE);
    }

    private Long userId(Authentication principal) {
        try {
            return Long.parseLong(principal.getName());
        } catch (NumberFormatException error) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
    }

    public record StartRequest(
        @NotBlank @Size(max = 72) @Utf8Size(max = 72) String currentPassword,
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{43}") String challenge
    ) {
        @Override
        public String toString() {
            return "GoogleLinkStart[redacted]";
        }
    }
}
