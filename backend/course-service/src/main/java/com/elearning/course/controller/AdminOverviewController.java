package com.elearning.course.controller;

import com.elearning.course.common.response.ApiResponse;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/courses")
public class AdminOverviewController {
    private final JdbcTemplate jdbc;
    public AdminOverviewController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/overview")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_VIEW')")
    public ApiResponse<?> overview() {
        return ApiResponse.success(Map.of(
            "total", jdbc.queryForObject("SELECT COUNT(*) FROM courses", Long.class),
            "published", jdbc.queryForObject("SELECT COUNT(*) FROM courses WHERE status = 'PUBLISHED'", Long.class),
            "categories", jdbc.queryForList("SELECT c.name, COUNT(co.id) AS count FROM categories c LEFT JOIN courses co ON co.category_id = c.id GROUP BY c.id, c.name ORDER BY count DESC, c.name"),
            "recent", jdbc.queryForList("SELECT id, title, status, price FROM courses ORDER BY created_at DESC, id DESC LIMIT 3")
        ));
    }
}
