package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.service.EngagementService;
import java.sql.Date;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning/admin")
public class AdminOverviewController {

    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("dd/MM");

    private final JdbcTemplate jdbc;

    public AdminOverviewController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/overview")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('LEARNING_REPORT_VIEW')")
    public ApiResponse<?> overview() {
        long enrolled = count("SELECT COUNT(*) FROM enrollments WHERE status <> 'CANCELLED'");
        long completed = count("SELECT COUNT(*) FROM enrollments WHERE status = 'COMPLETED'");
        long activeEnrollments = count("SELECT COUNT(*) FROM enrollments WHERE status = 'ACTIVE'");
        long lessonsCompleted = count("SELECT COUNT(*) FROM lesson_progress WHERE status = 'COMPLETED'");
        long studySeconds = count("SELECT COALESCE(SUM(time_spent_seconds), 0) FROM lesson_progress");
        long quizAttempts = count("SELECT COUNT(*) FROM quiz_attempts WHERE status = 'GRADED'");
        long quizPassed = count("SELECT COUNT(*) FROM quiz_attempts WHERE status = 'GRADED' AND passed = TRUE");
        double avgQuizScore = decimal("SELECT COALESCE(AVG(score), 0) FROM quiz_attempts WHERE status = 'GRADED' AND score IS NOT NULL");
        long toeicAttempts = count("SELECT COUNT(*) FROM toeic_attempts WHERE status = 'GRADED'");
        double avgToeicScore = decimal("SELECT COALESCE(AVG(score), 0) FROM toeic_attempts WHERE status = 'GRADED' AND score IS NOT NULL");
        long dictationAttempts = count("SELECT COUNT(*) FROM dictation_attempts WHERE completed_at IS NOT NULL");
        long activeStreaks = count("SELECT COUNT(*) FROM learner_profiles WHERE current_streak > 0");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("enrollments", enrolled);
        result.put("completed", completed);
        result.put("activeEnrollments", activeEnrollments);
        result.put("completionRate", enrolled == 0 ? 0.0 : round1((completed * 100.0) / enrolled));
        result.put("lessonsCompleted", lessonsCompleted);
        result.put("totalStudyMinutes", Math.round(studySeconds / 60.0));
        result.put("quizAttempts", quizAttempts);
        result.put("quizPassed", quizPassed);
        result.put("quizPassRate", quizAttempts == 0 ? 0.0 : round1((quizPassed * 100.0) / quizAttempts));
        result.put("avgQuizScore", round1(avgQuizScore));
        result.put("toeicAttempts", toeicAttempts);
        result.put("avgToeicScore", round1(avgToeicScore));
        result.put("dictationAttempts", dictationAttempts);
        result.put("activeStreaks", activeStreaks);
        result.put("dailyActivity", dailyActivity());
        result.put("courseProgress", courseProgress());
        return ApiResponse.success(result);
    }

    private List<Map<String, Object>> dailyActivity() {
        LocalDate today = LocalDate.now(EngagementService.ZONE);
        LocalDate start = today.minusDays(6);
        List<Map<String, Object>> rows = jdbc.queryForList(
            """
            SELECT activity_date AS activity_day,
                   COUNT(DISTINCT user_id) AS learners,
                   COALESCE(SUM(activity_count), 0) AS activities
            FROM learning_activity_days
            WHERE activity_date >= ? AND activity_date <= ?
            GROUP BY activity_date
            """,
            Date.valueOf(start),
            Date.valueOf(today)
        );
        Map<LocalDate, Map<String, Object>> byDate = new HashMap<>();
        for (Map<String, Object> row : rows) {
            Object dayObj = row.get("activity_day");
            LocalDate day = dayObj instanceof Date sqlDate
                ? sqlDate.toLocalDate()
                : LocalDate.parse(String.valueOf(dayObj).substring(0, 10));
            byDate.put(day, row);
        }
        List<Map<String, Object>> series = new ArrayList<>(7);
        for (int i = 0; i < 7; i++) {
            LocalDate day = start.plusDays(i);
            Map<String, Object> row = byDate.get(day);
            long learners = row == null ? 0L : ((Number) row.get("learners")).longValue();
            long activities = row == null ? 0L : ((Number) row.get("activities")).longValue();
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("date", day.toString());
            point.put("label", DAY_LABEL.format(day));
            point.put("learners", learners);
            point.put("activities", activities);
            series.add(point);
        }
        return series;
    }

    private List<Map<String, Object>> courseProgress() {
        return jdbc.queryForList(
            """
            SELECT course_id AS courseId,
                   COUNT(*) AS enrollments,
                   SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
                   SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active
            FROM enrollments
            WHERE status <> 'CANCELLED'
            GROUP BY course_id
            ORDER BY enrollments DESC, course_id ASC
            LIMIT 50
            """
        );
    }

    private long count(String sql) {
        Long value = jdbc.queryForObject(sql, Long.class);
        return value == null ? 0L : value;
    }

    private double decimal(String sql) {
        Double value = jdbc.queryForObject(sql, Double.class);
        return value == null ? 0.0 : value;
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
