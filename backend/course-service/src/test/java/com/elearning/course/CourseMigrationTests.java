package com.elearning.course;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class CourseMigrationTests {

    @Test
    void upgradingExistingCourseDataPastV6NeverReseedsOrDeletesIt() {
        String url = "jdbc:h2:mem:course-upgrade-" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("6").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(url, "sa", ""));
        jdbc.update("INSERT INTO categories (id, name, slug, created_at, updated_at) VALUES (901001, 'Existing category', 'existing-category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
        jdbc.update("INSERT INTO courses (id, title, slug, category_id, price, status, created_at, updated_at) VALUES (902001, 'Existing paid course', 'existing-paid-course', 901001, 765432, 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");

        Flyway.configure().dataSource(url, "sa", "").load().migrate();

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM courses", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM categories", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT title FROM courses WHERE id = 902001", String.class))
            .isEqualTo("Existing paid course");
        assertThat(jdbc.queryForObject("SELECT price FROM courses WHERE id = 902001", BigDecimal.class))
            .isEqualByComparingTo("765432");
    }
}
