package com.elearning.course.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class AdminOverviewControllerTests {

    @Test
    @SuppressWarnings("unchecked")
    void overview_whenStoredCoursesHaveDifferentStatusesAndLevels_shouldAggregateCoursesLessonsAndReviews() {
        // Arrange
        var ds = new DriverManagerDataSource(
            "jdbc:h2:mem:course_overview_test;MODE=MySQL;DB_CLOSE_DELAY=-1",
            "sa",
            ""
        );
        var jdbc = new JdbcTemplate(ds);
        jdbc.execute("DROP TABLE IF EXISTS reviews, lessons, sections, courses, categories");
        jdbc.execute(
            "CREATE TABLE categories (id BIGINT PRIMARY KEY, name VARCHAR(100))"
        );
        jdbc.execute(
            "CREATE TABLE courses (id BIGINT PRIMARY KEY, title VARCHAR(200), status VARCHAR(20), level VARCHAR(20), price DECIMAL(12,2), category_id BIGINT, avg_rating DOUBLE, review_count INT, created_at TIMESTAMP)"
        );
        jdbc.execute("CREATE TABLE sections (id BIGINT PRIMARY KEY, course_id BIGINT)");
        jdbc.execute("CREATE TABLE lessons (id BIGINT PRIMARY KEY, section_id BIGINT)");
        jdbc.execute("CREATE TABLE reviews (id BIGINT PRIMARY KEY, course_id BIGINT, rating INT, is_hidden BOOLEAN)");

        jdbc.update("INSERT INTO categories VALUES (1, 'TOEIC'), (2, 'IELTS')");
        jdbc.update(
            "INSERT INTO courses VALUES (1, 'TOEIC 700', 'PUBLISHED', 'INTERMEDIATE', 490000, 1, 4.5, 2, CURRENT_TIMESTAMP)"
        );
        jdbc.update(
            "INSERT INTO courses VALUES (2, 'Free Intro', 'DRAFT', 'BEGINNER', 0, 2, 0, 0, CURRENT_TIMESTAMP)"
        );
        jdbc.update("INSERT INTO sections VALUES (1, 1), (2, 2)");
        jdbc.update("INSERT INTO lessons VALUES (1, 1), (2, 1), (3, 2)");
        jdbc.update("INSERT INTO reviews VALUES (1, 1, 5, FALSE), (2, 1, 4, FALSE), (3, 1, 1, TRUE)");

        var controller = new AdminOverviewController(jdbc);
        // Act
        var data = (Map<String, Object>) controller.overview().data();

        // Assert
        assertThat(data.get("total")).isEqualTo(2L);
        assertThat(data.get("published")).isEqualTo(1L);
        assertThat(data.get("draft")).isEqualTo(1L);
        assertThat(data.get("archived")).isEqualTo(0L);
        assertThat(data.get("freeCourses")).isEqualTo(1L);
        assertThat(data.get("paidCourses")).isEqualTo(1L);
        assertThat(data.get("totalLessons")).isEqualTo(3L);
        assertThat(data.get("totalReviews")).isEqualTo(2L);
        assertThat(data.get("avgRating")).isEqualTo(4.5);
        assertThat((List<?>) data.get("categories")).hasSize(2);
        assertThat((List<?>) data.get("levels")).hasSize(2);
        assertThat((List<?>) data.get("courses")).hasSize(2);
    }
}
