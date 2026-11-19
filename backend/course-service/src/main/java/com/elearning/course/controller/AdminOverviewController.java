package com.elearning.course.controller;

import com.elearning.course.common.response.ApiResponse;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/courses")
public class AdminOverviewController {

    private final JdbcTemplate jdbc;

    public AdminOverviewController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/overview")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_VIEW')")
    public ApiResponse<?> overview() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", count("SELECT COUNT(*) FROM courses"));
        result.put("published", count("SELECT COUNT(*) FROM courses WHERE status = 'PUBLISHED'"));
        result.put("draft", count("SELECT COUNT(*) FROM courses WHERE status = 'DRAFT'"));
        result.put("archived", count("SELECT COUNT(*) FROM courses WHERE status = 'ARCHIVED'"));
        result.put("freeCourses", count("SELECT COUNT(*) FROM courses WHERE price = 0"));
        result.put("paidCourses", count("SELECT COUNT(*) FROM courses WHERE price > 0"));
        result.put("totalLessons", count("SELECT COUNT(*) FROM lessons"));
        result.put("totalReviews", count("SELECT COUNT(*) FROM reviews WHERE is_hidden = FALSE"));
        result.put(
            "avgRating",
            round2(decimal("SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE is_hidden = FALSE"))
        );
        result.put(
            "categories",
            jdbc.queryForList(
                "SELECT c.name, COUNT(co.id) AS count FROM categories c LEFT JOIN courses co ON co.category_id = c.id GROUP BY c.id, c.name ORDER BY count DESC, c.name"
            )
        );
        result.put(
            "levels",
            jdbc.queryForList(
                "SELECT level, COUNT(*) AS count FROM courses GROUP BY level ORDER BY count DESC, level"
            )
        );
        result.put(
            "recent",
            jdbc.queryForList(
                "SELECT id, title, status, price FROM courses ORDER BY created_at DESC, id DESC LIMIT 3"
            )
        );
        result.put(
            "courses",
            jdbc.queryForList(
                """
                SELECT co.id,
                       co.title,
                       co.status,
                       co.level,
                       co.price,
                       co.avg_rating AS avgRating,
                       co.review_count AS reviewCount,
                       c.name AS categoryName,
                       (SELECT COUNT(*) FROM lessons l JOIN sections s ON s.id = l.section_id WHERE s.course_id = co.id) AS lessonCount
                FROM courses co
                LEFT JOIN categories c ON c.id = co.category_id
                ORDER BY co.created_at DESC, co.id DESC
                """
            )
        );
        return ApiResponse.success(result);
    }

    private long count(String sql) {
        Long value = jdbc.queryForObject(sql, Long.class);
        return value == null ? 0L : value;
    }

    private double decimal(String sql) {
        Double value = jdbc.queryForObject(sql, Double.class);
        return value == null ? 0.0 : value;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
