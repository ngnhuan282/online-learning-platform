package com.elearning.learning.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.elearning.learning.service.EngagementService;
import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class AdminOverviewControllerTests {

    @Test
    @SuppressWarnings("unchecked")
    void overview_whenLearningActivityExists_shouldAggregateEnrollmentPracticeAndStreakMetrics() {
        // Arrange
        var ds = new DriverManagerDataSource(
            "jdbc:h2:mem:learning_overview_test;MODE=MySQL;DB_CLOSE_DELAY=-1",
            "sa",
            ""
        );
        var jdbc = new JdbcTemplate(ds);
        jdbc.execute(
            "DROP TABLE IF EXISTS learning_activity_days, learner_profiles, dictation_attempts, toeic_attempts, quiz_attempts, lesson_progress, enrollments"
        );
        jdbc.execute("CREATE TABLE enrollments (id BIGINT PRIMARY KEY, user_id BIGINT, course_id BIGINT, status VARCHAR(32))");
        jdbc.execute("CREATE TABLE lesson_progress (id BIGINT PRIMARY KEY, status VARCHAR(32), time_spent_seconds BIGINT)");
        jdbc.execute("CREATE TABLE quiz_attempts (id BIGINT PRIMARY KEY, status VARCHAR(32), score INT, passed BOOLEAN)");
        jdbc.execute("CREATE TABLE toeic_attempts (id BIGINT PRIMARY KEY, status VARCHAR(32), score INT)");
        jdbc.execute("CREATE TABLE dictation_attempts (id VARCHAR(36) PRIMARY KEY, completed_at TIMESTAMP)");
        jdbc.execute("CREATE TABLE learner_profiles (user_id BIGINT PRIMARY KEY, current_streak INT)");
        jdbc.execute("CREATE TABLE learning_activity_days (user_id BIGINT, activity_date DATE, activity_count INT)");

        jdbc.update("INSERT INTO enrollments VALUES (1, 10, 5, 'COMPLETED'), (2, 11, 5, 'ACTIVE'), (3, 12, 6, 'CANCELLED')");
        jdbc.update("INSERT INTO lesson_progress VALUES (1, 'COMPLETED', 120), (2, 'IN_PROGRESS', 60)");
        jdbc.update("INSERT INTO quiz_attempts VALUES (1, 'GRADED', 90, TRUE), (2, 'GRADED', 50, FALSE)");
        jdbc.update("INSERT INTO toeic_attempts VALUES (1, 'GRADED', 80)");
        jdbc.update("INSERT INTO dictation_attempts VALUES ('d1', CURRENT_TIMESTAMP), ('d2', NULL)");
        jdbc.update("INSERT INTO learner_profiles VALUES (10, 3), (11, 0)");
        jdbc.update(
            "INSERT INTO learning_activity_days VALUES (10, ?, 4)",
            Date.valueOf(LocalDate.now(EngagementService.ZONE))
        );

        var controller = new AdminOverviewController(jdbc);
        // Act
        var data = (Map<String, Object>) controller.overview().data();

        // Assert
        assertThat(data.get("enrollments")).isEqualTo(2L);
        assertThat(data.get("completed")).isEqualTo(1L);
        assertThat(data.get("activeEnrollments")).isEqualTo(1L);
        assertThat(data.get("completionRate")).isEqualTo(50.0);
        assertThat(data.get("lessonsCompleted")).isEqualTo(1L);
        assertThat(data.get("totalStudyMinutes")).isEqualTo(3L);
        assertThat(data.get("quizAttempts")).isEqualTo(2L);
        assertThat(data.get("quizPassed")).isEqualTo(1L);
        assertThat(data.get("quizPassRate")).isEqualTo(50.0);
        assertThat(data.get("avgQuizScore")).isEqualTo(70.0);
        assertThat(data.get("toeicAttempts")).isEqualTo(1L);
        assertThat(data.get("avgToeicScore")).isEqualTo(80.0);
        assertThat(data.get("dictationAttempts")).isEqualTo(1L);
        assertThat(data.get("activeStreaks")).isEqualTo(1L);
        assertThat((List<?>) data.get("dailyActivity")).hasSize(7);
        assertThat((List<?>) data.get("courseProgress")).hasSize(1);
    }
}
