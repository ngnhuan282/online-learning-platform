package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning/admin")
public class AdminOverviewController {

    private final JdbcTemplate jdbc;

    public AdminOverviewController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/overview")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('LEARNING_REPORT_VIEW')")
    public ApiResponse<?> overview() {
        long enrolled = jdbc.queryForObject(
            "SELECT COUNT(*) FROM enrollments WHERE status <> 'CANCELLED'",
            Long.class
        );
        long completed = jdbc.queryForObject(
            "SELECT COUNT(*) FROM enrollments WHERE status = 'COMPLETED'",
            Long.class
        );
        return ApiResponse.success(
            Map.of(
                "enrollments",
                enrolled,
                "completed",
                completed,
                "completionRate",
                enrolled == 0 ? 0.0 : (completed * 100.0) / enrolled
            )
        );
    }
}
