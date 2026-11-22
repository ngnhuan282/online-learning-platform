package com.elearning.learning;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.elearning.learning.dto.DictationModels.*;
import com.elearning.learning.service.*;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import tools.jackson.databind.json.JsonMapper;

class DictationMigrationTests {

    @Test
    void migrate_whenDatabaseIsNew_shouldRunSingleConsolidatedMigrationWithEmptyDictationCatalog() {
        // Arrange
        var source = new DriverManagerDataSource(
            "jdbc:h2:mem:dictation-empty-library-" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1",
            "sa",
            ""
        );
        var flyway = Flyway.configure()
            .dataSource(source)
            .placeholders(Map.of("notificationEventKeyCollation", ""))
            .load();
        var jdbc = new JdbcTemplate(source);
        var service = new DictationService(
            jdbc,
            JsonMapper.builder().build(),
            new DictationGrader(),
            mock(DictationAudioService.class),
            Clock.systemUTC()
        );

        // Act
        var result = flyway.migrate();
        flyway.validate();
        var catalog = service.catalog(7021, "", "", "", 0, 12, false);
        var topicGroups = service.topicGroups(7021L, "", "", "", "");
        var exercises = jdbc.queryForList("SELECT id FROM dictation_exercises", String.class);
        var starterAudio = jdbc.queryForList(
            "SELECT audio_key FROM dictation_audio WHERE audio_key=?",
            String.class,
            "sample-ets-2024-test-1"
        );

        // Assert
        assertThat(result.migrationsExecuted).isEqualTo(1);
        assertThat(catalog.items()).isEmpty();
        assertThat(topicGroups.groups()).isEmpty();
        assertThat(exercises).isEmpty();
        assertThat(starterAudio).isEmpty();
        assertThat(jdbc.queryForObject("SELECT lesson_xp FROM engagement_settings WHERE id=1", Integer.class))
            .isEqualTo(20);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_topics", Integer.class)).isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM shop_items", Integer.class)).isEqualTo(9);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM engagement_reward_rules", Integer.class)).isEqualTo(5);
    }

    @Test
    void migrate_whenConsolidatedSchemaIsUsed_shouldSupportLiveAndLegacyScoringAndWorkbookSyncTables() {
        // Arrange
        var source = new DriverManagerDataSource(
            "jdbc:h2:mem:dictation-consolidated-" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1",
            "sa",
            ""
        );
        var flyway = Flyway.configure()
            .dataSource(source)
            .placeholders(Map.of("notificationEventKeyCollation", ""))
            .load();
        flyway.migrate();

        var jdbc = new JdbcTemplate(source);
        var grader = new DictationGrader();
        var json = JsonMapper.builder().build();
        var audio = mock(DictationAudioService.class);
        when(audio.metadata("sample")).thenReturn(new Audio("sample", 3, "sample.mp3"));
        var service = new DictationService(jdbc, json, grader, audio, Clock.systemUTC());

        String exercise = UUID.randomUUID().toString();
        var definition = new Definition(
            "Consolidated Test",
            "",
            "Test 8",
            "B1",
            "sample",
            List.of(new Sentence("We enjoyed it.", 0.0, 3.0))
        );
        var timestamp = Timestamp.from(Instant.parse("2026-01-01T00:00:00Z"));
        jdbc.update(
            "INSERT INTO dictation_exercises (id, current_version, published_version, archived, updated_at) VALUES (?, 1, 1, FALSE, ?)",
            exercise,
            timestamp
        );
        jdbc.update(
            "INSERT INTO dictation_revisions (exercise_id, version, title, topic, level, duration_seconds, toeic_test, definition) "
                + "VALUES (?, 1, 'Consolidated Test', 'Test 8', 'B1', 3, 8, ?)",
            exercise,
            json.writeValueAsString(definition)
        );
        jdbc.update(
            "INSERT INTO dictation_workbook_imports (content_sha256, exercise_id) VALUES (?, ?)",
            "a".repeat(64),
            exercise
        );
        jdbc.update(
            "INSERT INTO dictation_workbook_sync (exercise_id, version, pending) VALUES (?, 1, FALSE)",
            exercise
        );
        jdbc.update(
            "INSERT INTO dictation_workbook_sources (exercise_id, storage, object_key, content_sha256) VALUES (?, 'local', 'test-8.xlsx', ?)",
            exercise,
            "a".repeat(64)
        );

        String legacy = UUID.randomUUID().toString();
        String live = UUID.randomUUID().toString();
        String first = json.writeValueAsString(grader.grade("We enjoyed it.", "We it"));
        jdbc.update(
            "INSERT INTO dictation_attempts (id, user_id, exercise_id, version, scoring_mode, request_id, started_at, completed_at) "
                + "VALUES (?, 7001, ?, 1, 'LEGACY', ?, ?, ?)",
            legacy,
            exercise,
            legacy,
            timestamp,
            timestamp
        );
        jdbc.update(
            "INSERT INTO dictation_responses (attempt_id, sentence_index, answer_text, first_grade, latest_grade) "
                + "VALUES (?, 0, 'We enjoyed it', ?, ?)",
            legacy,
            first,
            json.writeValueAsString(grader.grade("We enjoyed it.", "We enjoyed it"))
        );
        jdbc.update(
            "INSERT INTO dictation_attempts (id, user_id, exercise_id, version, scoring_mode, request_id, started_at, completed_at) "
                + "VALUES (?, 7001, ?, 1, 'LIVE', ?, ?, NULL)",
            live,
            exercise,
            live,
            timestamp
        );
        jdbc.update(
            "INSERT INTO dictation_responses (attempt_id, sentence_index, answer_text, first_grade, latest_grade) "
                + "VALUES (?, 0, 'We it', ?, ?)",
            live,
            first,
            first
        );

        // Act
        var completed = service.attempt(7001, legacy);
        var unfinished = service.attempt(7001, live);
        var corrected = service.progress(7001, live, new AnswerRequest(0, "We enjoyed it"));

        // Assert
        assertThat(service.catalog(7001, "Consolidated", "", "Test 8", 0, 12, false).items())
            .extracting(Item::id)
            .containsExactly(exercise);
        assertThat(completed.scoringMode()).isEqualTo("LEGACY");
        assertThat(completed.accuracy()).isEqualTo(66.7);
        assertThat(completed.completed()).isEqualTo(1);
        assertThat(unfinished.scoringMode()).isEqualTo("LIVE");
        assertThat(unfinished.completed()).isZero();
        assertThat(corrected.completed()).isEqualTo(1);
        assertThat(corrected.accuracy()).isEqualTo(100);
        assertThat(
            jdbc.queryForObject("SELECT earned_indices FROM dictation_responses WHERE attempt_id=?", String.class, live)
        ).isEqualTo("[0,1,2]");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM dictation_workbook_sources", Integer.class)).isEqualTo(1);
    }
}
