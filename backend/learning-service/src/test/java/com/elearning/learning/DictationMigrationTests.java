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
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class DictationMigrationTests {

    private static final String LEGACY_STARTER = "ets-2024-company-picnic";
    private static final String YOUTUBE_STARTER = "what-day-is-it-today";
    private static final String YOUTUBE_TITLE = "What day is it today?";
    private static final String YOUTUBE_URL = "https://www.youtube.com/watch?v=_R7nrvhNmrI";

    @Test
    void v14ToV16ExtendMainWithoutChangingItsHistoryOrExistingSettings() {
        String url = "jdbc:h2:mem:dictation-main-migration-" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1";
        var source = new DriverManagerDataSource(url, "sa", "");
        FluentConfiguration config = Flyway.configure().dataSource(source).placeholders(Map.of(
            "notificationCheckKeyword", "CONSTRAINT", "notificationEventKeyCollation", ""));
        config.target("13").load().migrate();
        var jdbc = new JdbcTemplate(source);
        String mainHistory = "SELECT \"version\",\"script\",\"checksum\" FROM \"flyway_schema_history\" "
            + "WHERE \"version\" IS NOT NULL AND \"installed_rank\"<=13 ORDER BY \"installed_rank\"";
        var before = jdbc.queryForList(mainHistory);
        jdbc.update("UPDATE engagement_settings SET lesson_xp=37 WHERE id=1");

        var migrated = config.target("16").load().migrate();

        assertThat(migrated.migrationsExecuted).isEqualTo(3);
        assertThat(jdbc.queryForList(mainHistory)).isEqualTo(before).hasSize(13);
        assertThat(jdbc.queryForObject("SELECT lesson_xp FROM engagement_settings WHERE id=1", Integer.class))
            .isEqualTo(37);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM toeic_notes", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM dictation_exercises", Integer.class)).isEqualTo(1);
        config.load().validate();
    }

    @Test
    void v16PreservesCompletedLegacyScoresAndMovesUnfinishedChecksToLiveScoring() {
        String url = "jdbc:h2:mem:dictation-migration-" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1";
        var source = new DriverManagerDataSource(url, "sa", "");
        FluentConfiguration config = Flyway.configure().dataSource(source).placeholders(Map.of(
            "notificationCheckKeyword", "CONSTRAINT", "notificationEventKeyCollation", ""));
        config.target("15").load().migrate();
        var jdbc = new JdbcTemplate(source);
        var grader = new DictationGrader();
        var json = JsonMapper.builder().build();
        String exercise = UUID.randomUUID().toString();
        var definition = new Definition("Migrated", "", "Workplace", "B1", "sample",
            List.of(new Sentence("We enjoyed it.", 0.0, 3.0)));
        var timestamp = Timestamp.from(Instant.parse("2026-01-01T00:00:00Z"));
        jdbc.update("INSERT INTO dictation_exercises (id,current_version,published_version,archived,updated_at) VALUES (?,1,1,FALSE,?)",
            exercise, timestamp);
        jdbc.update("INSERT INTO dictation_revisions (exercise_id,version,title,topic,level,duration_seconds,definition) VALUES (?,1,'Migrated','Workplace','B1',3,?)",
            exercise, json.writeValueAsString(definition));
        String legacy = UUID.randomUUID().toString(), live = UUID.randomUUID().toString();
        String first = json.writeValueAsString(grader.grade("We enjoyed it.", "We it"));
        for (String id : List.of(legacy, live)) {
            jdbc.update("INSERT INTO dictation_attempts (id,user_id,exercise_id,version,request_id,started_at,completed_at) VALUES (?,7001,?,1,?,?,?)",
                id, exercise, id, timestamp, id.equals(legacy) ? timestamp : null);
            jdbc.update("INSERT INTO dictation_responses (attempt_id,sentence_index,answer_text,first_grade,latest_grade) VALUES (?,0,?,?,?)",
                id, id.equals(legacy) ? "We enjoyed it" : "We it", first,
                id.equals(legacy) ? json.writeValueAsString(grader.grade("We enjoyed it.", "We enjoyed it")) : first);
        }
        config.target("19").load().migrate();
        var oldDefinition = (ObjectNode) json.valueToTree(definition);
        oldDefinition.put("toeicTest", 8);
        String oldSnapshot = json.writeValueAsString(oldDefinition);
        jdbc.update("UPDATE dictation_revisions SET toeic_test=8, definition=? WHERE exercise_id=?",
            oldSnapshot, exercise);
        assertThat(config.target("20").load().migrate().migrationsExecuted).isEqualTo(1);
        var audio = mock(DictationAudioService.class);
        when(audio.metadata("sample")).thenReturn(new Audio("sample", 3, "sample.mp3"));
        var service = new DictationService(jdbc, json, grader, audio, Clock.systemUTC());
        assertThat(service.adminDetail(exercise).definition().topic()).isEqualTo("Test 8");
        assertThat(service.catalog(7001, "Migrated", "", "Test 8", 0, 12, false).items())
            .extracting(Item::id).containsExactly(exercise);
        assertThat(jdbc.queryForObject("SELECT definition FROM dictation_revisions WHERE exercise_id=?",
            String.class, exercise)).isEqualTo(oldSnapshot);
        var completed = service.attempt(7001, legacy);
        assertThat(completed.scoringMode()).isEqualTo("LEGACY");
        assertThat(completed.accuracy()).isEqualTo(66.7);
        assertThat(completed.completed()).isEqualTo(1);
        assertThat(completed.responses().getFirst().completed()).isTrue();
        assertThat(completed.responses().getFirst().answer()).isEqualTo("We enjoyed it.");
        assertThat(service.finish(7001, legacy).accuracy()).isEqualTo(66.7);
        assertThat(completed.responses().getFirst().grade().accuracy()).isEqualTo(100);
        assertThatThrownBy(() -> service.progress(7001, legacy, new AnswerRequest(0, "changed")))
            .isInstanceOf(com.elearning.learning.common.exception.AppException.class);
        var unfinished = service.attempt(7001, live);
        assertThat(unfinished.scoringMode()).isEqualTo("LIVE");
        assertThat(unfinished.completed()).isZero();
        assertThat(unfinished.responses().getFirst().answer()).isNull();
        assertThat(unfinished.responses().getFirst().grade().words()).filteredOn(edit -> !edit.type().equals("correct"))
            .allSatisfy(edit -> assertThat(edit.expected()).isNull());
        assertThat(unfinished.accuracy()).isEqualTo(66.7);
        var corrected = service.progress(7001, live, new AnswerRequest(0, "We enjoyed it"));
        assertThat(corrected.completed()).isEqualTo(1);
        assertThat(corrected.accuracy()).isEqualTo(100);
        assertThat(corrected.responses().getFirst().firstAccuracy()).isEqualTo(100);
        assertThat(jdbc.queryForObject("SELECT earned_indices FROM dictation_responses WHERE attempt_id=?",
            String.class, live)).isEqualTo("[0,1,2]");
        assertThat(service.attempt(7001, legacy).accuracy()).isEqualTo(66.7);
        assertThat(jdbc.queryForObject("SELECT first_grade FROM dictation_responses WHERE attempt_id=?",
            String.class, legacy)).isEqualTo(first);
    }

    @Test
    void v21PublishesTheYouTubeStarterInANewDatabase() {
        var source = new DriverManagerDataSource(
            "jdbc:h2:mem:dictation-starter-" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", ""
        );
        Flyway.configure().dataSource(source).placeholders(Map.of(
            "notificationCheckKeyword", "CONSTRAINT", "notificationEventKeyCollation", ""
        )).load().migrate();
        var jdbc = new JdbcTemplate(source);
        var audio = mock(DictationAudioService.class);
        var service = new DictationService(
            jdbc, JsonMapper.builder().build(), new DictationGrader(), audio, Clock.systemUTC()
        );

        assertThat(service.catalog(7021, "", "", "", 0, 12, false).items()).singleElement().satisfies(item -> {
            assertThat(item.id()).isEqualTo(YOUTUBE_STARTER);
            assertThat(item.title()).isEqualTo(YOUTUBE_TITLE);
            assertThat(item.topic()).isEqualTo("Daily English Conversation");
            assertThat(item.level()).isEqualTo("A1");
            assertThat(item.sentenceCount()).isEqualTo(7);
            assertThat(item.duration()).isEqualTo(92.0);
            assertThat(item.thumbnailUrl()).isEqualTo("https://i.ytimg.com/vi/_R7nrvhNmrI/mqdefault.jpg");
        });
        var definition = service.adminDetail(YOUTUBE_STARTER).definition();
        assertThat(definition.audioKey()).isNull();
        assertThat(definition.video()).isEqualTo(new Video(YOUTUBE_URL, 92.0));
        assertThat(definition.sentences()).contains(
            new Sentence("It's Wednesday.", 15.0, 18.0),
            new Sentence("Let's play on Friday.", 27.0, 30.0)
        );
        var attempt = service.start(7021, YOUTUBE_STARTER, new StartRequest("youtube-starter-attempt", false));
        assertThat(attempt.video()).isEqualTo(definition.video());
        assertThat(attempt.sentences()).hasSize(7);
        assertThat(attempt.sentences().getLast().end()).isEqualTo(34.0);
        assertThat(jdbc.queryForObject(
            "SELECT archived FROM dictation_exercises WHERE id=?", Boolean.class, LEGACY_STARTER
        )).isTrue();
        verifyNoInteractions(audio);
    }

    @Test
    void v21KeepsAnAlreadyPublishedYouTubeLessonAndTheLegacyAudioProgress() {
        var source = new DriverManagerDataSource(
            "jdbc:h2:mem:dictation-existing-starter-" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", ""
        );
        var config = Flyway.configure().dataSource(source).placeholders(Map.of(
            "notificationCheckKeyword", "CONSTRAINT", "notificationEventKeyCollation", ""
        ));
        config.target("20").load().migrate();
        var jdbc = new JdbcTemplate(source);
        var audio = mock(DictationAudioService.class);
        when(audio.metadata("sample-ets-2024-test-1")).thenReturn(
            new Audio("sample-ets-2024-test-1", 31.479, "Audio 1.mp3")
        );
        var service = new DictationService(
            jdbc, JsonMapper.builder().build(), new DictationGrader(), audio, Clock.systemUTC()
        );
        var imported = new Definition(
            YOUTUBE_TITLE, "Bài của nhóm", "Daily English Conversation", "A2", null,
            List.of(new Sentence("It's Wednesday.", 15.0, 18.0)), new Video(YOUTUBE_URL, 92.0)
        );
        var lesson = service.saveAndPublish(null, new SaveRequest(imported, 0));
        var attempt = service.start(7022, LEGACY_STARTER, new StartRequest("legacy-starter-attempt", false));
        service.progress(7022, attempt.id(), new AnswerRequest(0, "Thank you so much"));

        assertThat(config.target("21").load().migrate().migrationsExecuted).isEqualTo(1);

        assertThat(service.catalog(7022, "", "", "", 0, 12, false).items())
            .extracting(Item::id).containsExactlyInAnyOrder(LEGACY_STARTER, lesson.id());
        assertThat(service.adminDetail(lesson.id()).definition()).isEqualTo(imported);
        assertThat(service.attempt(7022, attempt.id()).responses().getFirst().text()).isEqualTo("Thank you so much");
        config.load().validate();
    }
}
