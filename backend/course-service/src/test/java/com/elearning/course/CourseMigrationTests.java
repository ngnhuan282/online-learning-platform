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
    void migrate_whenDatabaseStartsEmpty_shouldCreateSchemaWithoutAutoSeedingAndPreserveRowsOnRerun() {
        // Arrange
        String url = "jdbc:h2:mem:course-upgrade-" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1";

        // Act
        var initial = Flyway.configure().dataSource(url, "sa", "").load().migrate();
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(url, "sa", ""));

        assertThat(initial.migrationsExecuted).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM categories", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM courses", Integer.class)).isZero();

        jdbc.update(
            "INSERT INTO categories (id, name, slug, active, created_at, updated_at) "
                + "VALUES (901001, 'Existing category', 'existing-category', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        );
        jdbc.update(
            "INSERT INTO courses (id, title, slug, category_id, price, status, avg_rating, review_count, created_at, updated_at) "
                + "VALUES (902001, 'Existing paid course', 'existing-paid-course', 901001, 765432, 'PUBLISHED', 4.8, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        );

        var rerun = Flyway.configure().dataSource(url, "sa", "").load().migrate();

        // Assert
        assertThat(rerun.migrationsExecuted).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM courses", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM categories", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT active FROM categories WHERE id = 901001", Boolean.class)).isTrue();
        assertThat(jdbc.queryForObject("SELECT title FROM courses WHERE id = 902001", String.class))
            .isEqualTo("Existing paid course");
        assertThat(jdbc.queryForObject("SELECT price FROM courses WHERE id = 902001", BigDecimal.class))
            .isEqualByComparingTo("765432");
    }
}
