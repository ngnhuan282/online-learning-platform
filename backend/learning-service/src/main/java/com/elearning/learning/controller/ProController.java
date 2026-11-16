package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.ProModels.*;
import com.elearning.learning.security.InternalServiceAuthenticator;
import com.elearning.learning.service.ProActivationAttempts;
import com.elearning.learning.service.ProMembershipService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
public class ProController {

    private final ProMembershipService memberships;
    private final ProActivationAttempts attempts;
    private final InternalServiceAuthenticator authenticator;

    public ProController(
        ProMembershipService memberships,
        ProActivationAttempts attempts,
        InternalServiceAuthenticator authenticator
    ) {
        this.memberships = memberships;
        this.attempts = attempts;
        this.authenticator = authenticator;
    }

    @GetMapping("/api/v1/learning/pro/me")
    public ApiResponse<Membership> membership(Principal principal) {
        return ApiResponse.success(memberships.membership(Long.parseLong(principal.getName())));
    }

    @PostMapping("/api/v1/learning/pro/redeem")
    public ApiResponse<Membership> redeem(Principal principal, @Valid @RequestBody RedeemRequest request) {
        long userId = Long.parseLong(principal.getName());
        attempts.consume(userId);
        return ApiResponse.success(memberships.redeem(userId, request.code()));
    }

    @GetMapping("/api/v1/learning/admin/pro/codes")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<CodeInfo>> codes() {
        return ApiResponse.success(memberships.codes());
    }

    @PostMapping("/api/v1/learning/admin/pro/codes")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<IssuedCode> issue(Principal principal, @Valid @RequestBody CreateCodeRequest request) {
        return ApiResponse.success(memberships.createCode(Long.parseLong(principal.getName()), request));
    }

    @DeleteMapping("/api/v1/learning/admin/pro/codes/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<CodeInfo> revokeCode(@PathVariable long id) {
        return ApiResponse.success(memberships.revokeCode(id));
    }

    @PostMapping("/internal/v1/learning/pro/grants")
    public ApiResponse<Membership> grant(
        @RequestHeader(name = "X-Internal-Service-Token", required = false) String token,
        @Valid @RequestBody GrantRequest request
    ) {
        authenticator.requireValid(token);
        return ApiResponse.success(memberships.grant(request));
    }

    @PostMapping("/internal/v1/learning/pro/revocations")
    public ApiResponse<Membership> revoke(
        @RequestHeader(name = "X-Internal-Service-Token", required = false) String token,
        @Valid @RequestBody RevokeRequest request
    ) {
        authenticator.requireValid(token);
        return ApiResponse.success(memberships.revoke(request));
    }
}
