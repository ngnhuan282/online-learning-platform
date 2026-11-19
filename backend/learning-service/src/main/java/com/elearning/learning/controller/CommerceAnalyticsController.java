package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.CommerceAnalytics.*;
import com.elearning.learning.security.LearningAdminAccess;
import com.elearning.learning.service.CommerceAnalyticsService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning/admin/analytics")
public class CommerceAnalyticsController {

    private final CommerceAnalyticsService analytics;
    private final LearningAdminAccess access;

    public CommerceAnalyticsController(CommerceAnalyticsService analytics, LearningAdminAccess access) {
        this.analytics = analytics;
        this.access = access;
    }

    @GetMapping("/pro")
    @PreAuthorize("@learningAdmin.allowed(authentication, 'PRO_MEMBER_VIEW')")
    public ApiResponse<Report<ProPeriod, ProSnapshot, ProDetails>> pro(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        Authentication authentication
    ) {
        return ApiResponse.success(analytics.pro(from, to, access.allowed(authentication, "PRO_CODE_VIEW")));
    }

    @GetMapping("/gems")
    @PreAuthorize("@learningAdmin.allowed(authentication, 'ENGAGEMENT_VIEW')")
    public ApiResponse<Report<GemPeriod, GemSnapshot, List<Adjustment>>> gems(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ApiResponse.success(analytics.gems(from, to));
    }

    @GetMapping("/shop")
    @PreAuthorize("@learningAdmin.allowed(authentication, 'SHOP_VIEW')")
    public ApiResponse<Report<ShopPeriod, ShopSnapshot, List<Item>>> shop(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ApiResponse.success(analytics.shop(from, to));
    }
}
