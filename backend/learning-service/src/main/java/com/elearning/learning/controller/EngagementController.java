package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.EngagementModels.*;
import com.elearning.learning.service.CurrentProfileClient;
import com.elearning.learning.service.EngagementService;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning/engagement")
public class EngagementController {

    private final EngagementService engagement;
    private final CurrentProfileClient profiles;

    public EngagementController(EngagementService engagement, CurrentProfileClient profiles) {
        this.engagement = engagement;
        this.profiles = profiles;
    }

    @GetMapping("/me")
    public ApiResponse<Summary> me(
            Principal principal,
            @RequestHeader(value = "Authorization", required = false) String token) {
        long userId = Long.parseLong(principal.getName());
        engagement.syncProfile(userId, profiles.current(token));
        return ApiResponse.success(engagement.summary(userId));
    }

    @PostMapping("/rewards/{code}/claim")
    public ApiResponse<Summary> claim(Principal principal, @PathVariable String code) {
        return ApiResponse.success(engagement.claim(Long.parseLong(principal.getName()), code));
    }

    @GetMapping("/leaderboard")
    public ApiResponse<Leaderboard> leaderboard(
            Principal principal,
            @RequestParam(defaultValue = "month") String period,
            @RequestParam(required = false) String month,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long userId = principal == null ? null : Long.parseLong(principal.getName());
        return ApiResponse.success(engagement.leaderboard(userId, period, month, page, size));
    }

    @PostMapping("/frame")
    public ApiResponse<Summary> frame(
            Principal principal,
            @jakarta.validation.Valid @RequestBody FrameRequest request) {
        return ApiResponse.success(
                engagement.equipFrame(Long.parseLong(principal.getName()), request.code()));
    }
}
