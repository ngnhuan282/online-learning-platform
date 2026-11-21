package com.elearning.learning;

import static org.assertj.core.api.Assertions.*;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.dto.DictationModels.*;
import com.elearning.learning.service.*;
import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.validation.Validator;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.datasource.url=jdbc:h2:mem:dictation;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "security.jwt.secret=dictation-test-secret-with-more-than-thirty-two-bytes",
        "logging.level.root=WARN",
        "dictation.storage-dir=./target/dictation-test-uploads",
    }
)
@ActiveProfiles("test")
class DictationIntegrationTests {

    private static final int TEMPLATE_FIRST_SENTENCE_ROW = 8;

    private static final String SECRET = "dictation-test-secret-with-more-than-thirty-two-bytes";
    private static final String USER = "/api/v1/learning/dictation";
    private static final String ADMIN = "/api/v1/learning/admin/dictation";
    private static String sampleId;
    private static String sampleAudioKey;

    @Autowired
    DictationService service;

    @Autowired
    DictationGrader grader;

    @Autowired
    DictationWorkbookService workbooks;

    @Autowired
    DictationWorkbookSync workbookSync;

    @Autowired
    Validator validator;

    @Autowired
    DictationAudioService audio;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JsonMapper json;

    @Autowired
    org.springframework.transaction.PlatformTransactionManager transactions;

    @LocalServerPort
    int port;

    final HttpClient http = HttpClient.newHttpClient();

    @BeforeAll
    static void publishAudioFixture(@Autowired DictationService service, @Autowired DictationAudioService audio) {
        sampleAudioKey = audio.upload(new MockMultipartFile("file", "practice.mp3", "audio/mpeg", silentMp3())).key();
        var sentences = new ArrayList<Sentence>();
        for (int index = 0; index < 13; index++) {
            sentences.add(new Sentence("Practice sentence " + (index + 1) + ".", index * 2.0, (index + 1) * 2.0));
        }
        sampleId = service.saveAndPublish(
            null,
            new SaveRequest(new Definition("Picnic practice fixture", "", "Test 1", "B1", sampleAudioKey, sentences), 0)
        ).id();
    }

    @AfterAll
    static void deleteAudioFixture() throws Exception {
        if (sampleAudioKey != null) {
            Files.deleteIfExists(Path.of("./target/dictation-test-uploads").resolve(sampleAudioKey));
        }
    }

    @Test
    void catalog_whenLearnerHasNoEnrollment_shouldReturnLegacyAudioExercise() {
        // Arrange
        // Act
        var catalog = service.catalog(5001, "picnic", "B1", "Test 1", 0, 12, false);
        assertThat(catalog.total()).isGreaterThanOrEqualTo(1);
        var item = catalog
            .items()
            .stream()
            .filter(value -> value.id().equals(sampleId))
            .findFirst()
            .orElseThrow();
        // Assert
        assertThat(item.sentenceCount()).isEqualTo(13);
        assertThat(item.duration()).isBetween(31.0, 32.0);
        assertThat(item.topic()).isEqualTo("Test 1");
        assertThat(service.adminDetail(sampleId).definition().topic()).isEqualTo("Test 1");
        assertThat(
            service.catalog(5001, "nothing-matches-this-query", "", "", 0, 12, false).items()
        ).isEmpty();
        assertThat(service.catalog(5001, "picnic", "C2", "", 0, 12, false).items()).isEmpty();
    }

    @Test
    void catalog_whenGuest_shouldReturnOnlyPublishedExercisesWithoutAttempts() throws Exception {
        // Arrange
        start(5110L, sampleId);
        create("Picnic practice draft", List.of(new Sentence("Draft sentence.", 0.0, 2.0)));
        var archived = service.saveAndPublish(
            null,
            new SaveRequest(
                new Definition(
                    "Picnic practice archived",
                    "",
                    "Test 1",
                    "B1",
                    sampleAudioKey,
                    List.of(new Sentence("Archived sentence.", 0.0, 2.0))
                ),
                0
            )
        );
        service.visibility(archived.id(), true);

        // Act
        var catalog = request(null, false, "GET", USER + "?keyword=picnic&status=NOT_STARTED", null);
        var groups = request(null, false, "GET", USER + "/topic-groups?keyword=picnic", null);
        var started = request(null, false, "GET", USER + "?keyword=picnic&status=IN_PROGRESS", null);
        var createAttempt = request(null, false, "POST", USER + "/exercises/" + sampleId + "/attempts", "{}");

        // Assert
        assertThat(catalog.statusCode()).isEqualTo(200);
        var items = json.readTree(catalog.body()).path("data").path("items");
        assertThat(items).hasSize(1);
        assertThat(items.get(0).path("id").asText()).isEqualTo(sampleId);
        assertThat(items.get(0).hasNonNull("attemptId")).isFalse();

        assertThat(groups.statusCode()).isEqualTo(200);
        var grouped = json.readTree(groups.body()).path("data").path("groups");
        assertThat(grouped).hasSize(1);
        assertThat(grouped.get(0).path("items").get(0).path("id").asText()).isEqualTo(sampleId);

        assertThat(started.statusCode()).isEqualTo(200);
        assertThat(json.readTree(started.body()).path("data").path("items")).isEmpty();
        assertThat(createAttempt.statusCode()).isEqualTo(401);
    }

    @Test
    void topicGroups_whenExerciseHasLatestAttempt_shouldPreviewPublishedExercisesAndFilterByProgress() throws Exception {
        // Arrange
        long learner = 5091;
        String keyword = "TestGroupingFixture";
        var sentences = List.of(new Sentence("Hello there.", 0.0, 3.0));
        var ids = new ArrayList<String>();
        for (int index = 0; index < 7; index++) {
            String topic = index < 6 ? (index % 2 == 0 ? "  test  02  " : "Test 2") : "Travel & Food";
            var definition = new Definition(
                keyword + " " + index, "", topic, "B1", sampleAudioKey, sentences
            );
            var lesson = service.saveAndPublish(null, new SaveRequest(definition, 0));
            ids.add(lesson.id());
        }
        service.visibility(ids.get(5), true);
        // Act
        var groups = service.topicGroups(learner, keyword, "B1", "", "").groups();
        assertThat(groups).extracting(TopicGroup::topic).containsExactly("Test 2", "Travel & Food");
        assertThat(groups.getFirst().total()).isEqualTo(5);
        assertThat(groups.getFirst().items()).hasSize(4).allMatch(item -> item.topic().equals("Test 2"));
        assertThat(groups.getLast().items()).extracting(Item::id).containsExactly(ids.getLast());

        var response = request(learner, false, "GET", USER + "/topic-groups?keyword=" + keyword, null);
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(json.readTree(response.body()).path("data").path("groups").size()).isEqualTo(2);
        response = request(learner, false, "GET", USER + "?keyword=" + keyword + "&topic=TEST%202&page=1&size=4", null);
        assertThat(response.statusCode()).isEqualTo(200);
        var page = json.readTree(response.body()).path("data");
        assertThat(page.path("items").size()).isEqualTo(1);
        assertThat(page.path("total").asLong()).isEqualTo(5);

        var attempt = start(learner, ids.getFirst());
        assertThat(service.catalog(learner, keyword, "", "Test 2", 0, 12, false, "IN_PROGRESS").items())
            .extracting(Item::attemptId)
            .containsExactly(attempt.id());
        service.progress(learner, attempt.id(), new AnswerRequest(0, "Hello there"));
        service.finish(learner, attempt.id());
        assertThat(service.topicGroups(learner, keyword, "", "", "COMPLETED").groups().getFirst().total())
            .isEqualTo(1);
        assertThat(service.catalog(learner + 1, keyword, "", "Test 2", 0, 12, false, "NOT_STARTED").total())
            .isEqualTo(5);
        var restarted = service.start(learner, ids.getFirst(), new StartRequest(UUID.randomUUID().toString(), true));
        assertThat(service.topicGroups(learner, keyword, "", "", "COMPLETED").groups()).isEmpty();
        assertThat(service.catalog(learner, keyword, "", "Test 2", 0, 12, false, "IN_PROGRESS").items())
            .extracting(Item::attemptId)
            .containsExactly(restarted.id());

        var old = service.adminDetail(ids.getFirst());
        var reclassified = new Definition(
            old.definition().title(), "", "travel & food", "B1", old.definition().audioKey(), sentences
        );
        var draft = service.save(old.id(), new SaveRequest(reclassified, old.version()));
        assertThat(service.catalog(learner, keyword, "", "Travel & Food", 0, 12, false).total()).isEqualTo(1);
        service.publish(draft.id(), draft.version());
        // Assert
        assertThat(service.catalog(learner, keyword, "", "Travel & Food", 0, 12, false).items())
            .extracting(Item::id)
            .containsExactlyInAnyOrder(old.id(), ids.getLast());
        assertThat(service.topicGroups(learner, keyword, "", "", "").groups().getLast().total())
            .isEqualTo(2);
    }

    @Test
    void topicGroups_whenPublishedYouTubeVideosShareCaseInsensitiveTopic_shouldUsePublishedThumbnail() throws Exception {
        // Arrange
        long learner = 5096;
        String keyword = "YoutubeCoverFixture";
        String id = "_R7nrvhNmrI";
        String shortId = "7lCDEYXw3mM";
        var sentences = List.of(new Sentence("Hello there.", 7.0, 10.0));
        var first = service.saveAndPublish(
            null,
            new SaveRequest(
                new Definition(
                    keyword + " one", "", "Daily English Conversation", "A1", null, sentences,
                    new Video("https://www.youtube.com/watch?t=7&v=%5F" + id.substring(1), 91.9)
                ),
                0
            )
        );
        var second = service.saveAndPublish(
            null,
            new SaveRequest(
                new Definition(
                    keyword + " two", "", "daily english Conversation", "B1", null, sentences,
                    new Video("https://youtu.be/" + shortId + "?si=share", 75.0)
                ),
                0
            )
        );
        // Act
        var groups = service.topicGroups(learner, keyword, "", "", "").groups();
        assertThat(groups).hasSize(1);
        assertThat(groups.getFirst().total()).isEqualTo(2);
        assertThat(groups.getFirst().items()).extracting(Item::thumbnailUrl).containsExactlyInAnyOrder(
            "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg",
            "https://i.ytimg.com/vi/" + shortId + "/mqdefault.jpg"
        );
        assertThat(second.definition().topic()).isEqualTo("daily english Conversation");
        service.visibility(first.id(), true);
        assertThat(service.topicGroups(learner, keyword, "", "", "").groups().getFirst().items())
            .extracting(Item::id)
            .containsExactly(second.id());
        service.visibility(first.id(), false);
        var response = request(
            learner, false, "GET", USER + "?keyword=" + keyword + "&topic=DAILY%20ENGLISH%20CONVERSATION", null
        );
        assertThat(response.statusCode()).isEqualTo(200);
        var catalog = json.readTree(response.body()).path("data");
        // Assert
        assertThat(catalog.path("total").asLong()).isEqualTo(2);
        assertThat(catalog.path("items").get(0).path("thumbnailUrl").asText())
            .startsWith("https://i.ytimg.com/vi/");
    }

    @Test
    void start_whenExerciseUsesCloudVideo_shouldReturnRevisionDurationAndTranscript() throws Exception {
        // Arrange
        var video = new Video("https://media.example.test/videos/sample.mp4", 34.8);
        var sentences = List.of(new Sentence("Sounds good.", 30.0, 35.0));
        var definition = new Definition("Cloud video", "", "Conversation", "A1", null, sentences, video);
        var lesson = service.saveAndPublish(null, new SaveRequest(definition, 0));
        // Act
        assertThat(lesson.audio()).isNull();
        assertThat(lesson.definition().video()).isEqualTo(video);
        assertThat(lesson.definition().sentences().getFirst().end()).isEqualTo(34.8);
        var item = service.catalog(5093, "Cloud video", "", "Conversation", 0, 12, false).items().getFirst();
        assertThat(item.video()).isTrue();
        assertThat(item.thumbnailUrl()).isNull();
        assertThat(item.duration()).isEqualTo(34.8);
        var attempt = start(5093, lesson.id());
        assertThat(attempt.video()).isEqualTo(video);
        assertThat(attempt.duration()).isEqualTo(34.8);
        assertThat(attempt.sentences().getFirst().end()).isEqualTo(34.8);
        assertThat(request(5093L, false, "GET", USER + "/attempts/" + attempt.id() + "/audio", null).statusCode())
            .isEqualTo(404);
        service.visibility(lesson.id(), true);
        assertThat(service.history(5093, "", "", "", "", 0, 20).items().getFirst().video()).isNull();

        var unfinished = new Definition(
            "Unverified video", "", "Conversation", "A1", null, sentences, new Video(video.url(), null)
        );
        var draft = service.save(null, new SaveRequest(unfinished, 0));
        assertThatThrownBy(() -> service.publish(draft.id(), draft.version()))
            .hasMessage("Chờ tải thời lượng video trước khi xuất bản.");
        var invalid = new Definition(
            "Insecure video", "", "Conversation", "A1", null, sentences, new Video("http://example.test/video.mp4", 40.0)
        );
        // Assert
        assertThatThrownBy(() -> service.save(null, new SaveRequest(invalid, 0)))
            .hasMessage("Vui lòng nhập URL HTTPS trực tiếp của video.");
    }

    @Test
    void catalog_whenLevelGroupIsSelected_shouldFilterPreviewAndPaginatedResults() throws Exception {
        // Arrange
        String keyword = "LevelGroupFixture";
        var sentences = List.of(new Sentence("Hello there.", 0.0, 3.0));
        // Act
        for (String level : List.of("A1", "A2", "B1", "C2")) {
            var definition = new Definition(
                keyword + " " + level, "", "Test 4", level, sampleAudioKey, sentences
            );
            service.saveAndPublish(null, new SaveRequest(definition, 0));
        }

        long learner = 5092;
        var beginner = request(learner, false, "GET", USER + "/topic-groups?keyword=" + keyword + "&level=BEGINNER", null);
        assertThat(beginner.statusCode()).isEqualTo(200);
        var group = json.readTree(beginner.body()).path("data").path("groups").get(0);
        assertThat(group.path("topic").asText()).isEqualTo("Test 4");
        assertThat(group.path("total").asLong()).isEqualTo(2);
        assertThat(group.path("items")).extracting(item -> item.path("level").asText())
            .containsExactlyInAnyOrder("A1", "A2");

        var first = service.catalog(learner, keyword, "ADVANCED", "Test 4", 0, 1, false, "NOT_STARTED");
        var second = service.catalog(learner, keyword, "ADVANCED", "Test 4", 1, 1, false, "NOT_STARTED");
        // Assert
        assertThat(first.total()).isEqualTo(2);
        assertThat(second.total()).isEqualTo(2);
        assertThat(List.of(first.items().getFirst().level(), second.items().getFirst().level()))
            .containsExactlyInAnyOrder("B1", "C2");
    }

    @Test
    void catalog_whenAdminFiltersByStatus_shouldReturnMatchingRowsAndTotals() throws Exception {
        // Arrange
        var sentences = List.of(new Sentence("Hello there.", 0.0, 3.0));
        var draft = create("StatusFilter draft", sentences);
        var visible = create("StatusFilter visible", sentences);
        var another = create("StatusFilter another", sentences);
        var hidden = create("StatusFilter hidden", sentences);
        for (var lesson : List.of(visible, another, hidden)) service.publish(lesson.id(), lesson.version());
        service.visibility(hidden.id(), true);
        service.save(visible.id(), new SaveRequest(visible.definition(), visible.version()));

        // Act
        var first = service.catalog(null, "StatusFilter", "B1", "Workplace", 0, 1, true, "PUBLISHED");
        var second = service.catalog(null, "StatusFilter", "B1", "Workplace", 1, 1, true, "PUBLISHED");
        var drafts = service.catalog(null, "StatusFilter", "", "", 0, 12, true, "DRAFT");
        var archived = service.catalog(null, "StatusFilter", "", "", 0, 12, true, "ARCHIVED");
        var unfiltered = service.catalog(0, "StatusFilter", "", "", 0, 12, true);
        var response = request(5090L, true, "GET", ADMIN + "?keyword=StatusFilter&status=ARCHIVED", null);
        var invalidStatus = request(5090L, true, "GET", ADMIN + "?status=unknown", null);

        // Assert
        assertThat(first.total()).isEqualTo(2);
        assertThat(second.total()).isEqualTo(2);
        assertThat(first.items())
            .hasSize(1)
            .allMatch(item -> item.status().equals("PUBLISHED"));
        assertThat(second.items())
            .hasSize(1)
            .noneMatch(item -> item.id().equals(first.items().getFirst().id()));
        assertThat(drafts.items()).extracting(Item::id).containsExactly(draft.id());
        assertThat(archived.items()).extracting(Item::id).containsExactly(hidden.id());
        assertThat(unfiltered.total()).isEqualTo(4);
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(json.readTree(response.body()).path("data").path("total").asLong()).isEqualTo(1);
        assertThat(invalidStatus.statusCode()).isEqualTo(400);
    }

    @Test
    void grade_whenAnswerContainsMissingExtraOrPunctuatedWords_shouldAlignAndNormalizeWithoutGuessing() {
        // Arrange
        // Act
        assertThat(grader.grade("There's a video.", "THERE’S   A VIDEO!").accuracy()).isEqualTo(100);
        var missing = grader.grade("we really enjoyed the company picnic", "we enjoyed the company picnic");
        assertThat(missing.correct()).isEqualTo(5);
        assertThat(
            missing
                .words()
                .stream()
                .filter(word -> word.type().equals("missing"))
        ).hasSize(1);
        var extra = grader.grade("we enjoyed it", "we really enjoyed it");
        // Assert
        assertThat(extra.extra()).isEqualTo(1);
        assertThat(extra.accuracy()).isLessThan(100);
        assertThat(grader.grade("I'll", "I will").accuracy()).isLessThan(100);
    }

    @Test
    void attempt_whenCallerIsAnotherUserOrTranscriptIsUnanswered_shouldProtectPrivateAttemptAndAnswers() throws Exception {
        // Arrange
        var attempt = start(5002, sampleId);
        // Act
        assertThat(attempt.responses()).allSatisfy(response -> {
            assertThat(response.answer()).isNull();
            assertThat(response.grade()).isNull();
            assertThat(response.completed()).isFalse();
            assertThat(response.feedback()).allMatch(
                word -> word.state().equals("empty") && word.text() == null
            );
        });
        assertThatThrownBy(() -> service.attempt(5003, attempt.id())).isInstanceOf(AppException.class);
        assertThat(
            request(5003L, false, "GET", USER + "/attempts/" + attempt.id(), null).statusCode()
        ).isEqualTo(404);
        assertThat(
            request(5003L, false, "GET", USER + "/attempts/" + attempt.id() + "/audio", null).statusCode()
        ).isEqualTo(404);
        for (String action : List.of("progress", "check", "hint", "reveal", "skip", "finish"))
            assertThat(
                request(
                    5003L,
                    false,
                    action.equals("progress") ? "PUT" : "POST",
                    USER + "/attempts/" + attempt.id() + "/" + action,
                    "{\"index\":0,\"wordIndex\":0,\"text\":\"test\"}"
                ).statusCode()
            ).isEqualTo(404);
        // Assert
        assertThat(service.history(5003, "", "", "", "", 0, 20).items()).isEmpty();
    }

    @Test
    void hint_whenAllWordsAreRevealed_shouldCompleteSentenceWithoutAwardingCredit() {
        // Arrange
        var detail = create("All hints", List.of(new Sentence("We enjoyed it.", 0.0, 3.0)));
        service.publish(detail.id(), detail.version());
        // Act
        String id = start(5030, detail.id()).id();
        service.progress(5030, id, new AnswerRequest(0, "my draft"));
        assertThat(service.hint(5030, id, new HintRequest(0, 0)).completed()).isZero();
        assertThat(service.hint(5030, id, new HintRequest(0, 1)).responses().getFirst().answer()).isNull();
        var complete = service.hint(5030, id, new HintRequest(0, 2));
        // Assert
        assertThat(complete.completed()).isEqualTo(1);
        assertThat(complete.responses().getFirst().revealed()).isTrue();
        assertThat(complete.responses().getFirst().answer()).isEqualTo("We enjoyed it.");
        assertThat(complete.responses().getFirst().text()).isEqualTo("my draft");
        assertThat(complete.responses().getFirst().firstAccuracy()).isZero();
        assertThat(service.attempt(5030, id).completed()).isEqualTo(1);
        assertThat(service.hint(5030, id, new HintRequest(0, 2)).responses().getFirst().hints()).hasSize(3);
        assertThat(complete.responses().getFirst().completed()).isTrue();
        assertThatThrownBy(() -> service.check(5030, id, new AnswerRequest(0, "We enjoyed it"))).isInstanceOf(
            AppException.class
        );
        assertThat(service.progress(5030, id, new AnswerRequest(0, "my draft")).accuracy()).isZero();
        assertThat(service.finish(5030, id).completedAt()).isNotNull();
    }

    @Test
    void progress_whenLegacyResponsesWereFullyHinted_shouldPreserveCompletionAndPreviouslyEarnedCredit() {
        // Arrange
        var detail = create("Legacy all hints", List.of(new Sentence("We enjoyed it.", 0.0, 3.0)));
        service.publish(detail.id(), detail.version());
        // Act
        String id = start(5031, detail.id()).id();
        service.hint(5031, id, new HintRequest(0, 0));
        service.hint(5031, id, new HintRequest(0, 1));
        service.hint(5031, id, new HintRequest(0, 2));
        jdbc.update("UPDATE dictation_responses SET revealed=FALSE, first_grade=NULL WHERE attempt_id=?", id);
        assertThat(service.attempt(5031, id).completed()).isEqualTo(1);
        assertThat(service.attempt(5031, id).responses().getFirst().revealed()).isTrue();
        assertThat(service.finish(5031, id).accuracy()).isZero();

        String graded = start(5032, detail.id()).id();
        double first = service
            .check(5032, graded, new AnswerRequest(0, "We it"))
            .responses()
            .getFirst()
            .firstAccuracy();
        for (int word = 0; word < 3; word++) service.hint(5032, graded, new HintRequest(0, word));
        // Assert
        assertThat(service.attempt(5032, graded).responses().getFirst().firstAccuracy()).isEqualTo(first);
    }

    @Test
    void hint_whenLearnerRevealsWord_shouldPersistPrivateHintAndDiscountOnlyUnearnedWords() throws Exception {
        // Arrange
        var detail = create("Word hints", List.of(new Sentence("We really enjoyed it.", 0.0, 3.0)));
        service.publish(detail.id(), detail.version());
        var attempt = start(5020, detail.id());
        // Act
        String id = attempt.id();
        assertThat(attempt.sentences().getFirst().wordLengths()).containsExactly(2, 6, 7, 2);
        assertThatThrownBy(() -> service.hint(5021, id, new HintRequest(0, 1))).isInstanceOf(
            AppException.class
        );
        assertThat(
            request(
                5021L,
                false,
                "POST",
                USER + "/attempts/" + id + "/hint",
                "{\"index\":0,\"wordIndex\":1}"
            ).statusCode()
        ).isEqualTo(404);
        assertThat(
            request(
                5020L,
                false,
                "POST",
                USER + "/attempts/" + id + "/hint",
                "{\"index\":0,\"wordIndex\":-1}"
            ).statusCode()
        ).isEqualTo(400);
        assertThatThrownBy(() -> service.hint(5020, id, new HintRequest(0, 4))).isInstanceOf(
            AppException.class
        );
        var hinted = service.hint(5020, id, new HintRequest(0, 1));
        assertThat(hinted.completed()).isZero();
        assertThat(hinted.responses().getFirst().answer()).isNull();
        assertThat(hinted.responses().getFirst().hints()).containsExactly(new Hint(1, "really"));
        service.hint(5020, id, new HintRequest(0, 1));
        service.progress(5020, id, new AnswerRequest(0, "We really enjoyed it"));
        assertThat(service.attempt(5020, id).responses().getFirst().hints()).hasSize(1);
        assertThat(service.attempt(5020, id).responses().getFirst().completed()).isTrue();
        var checked = service.check(5020, id, new AnswerRequest(0, "We really enjoyed it"));
        assertThat(checked.responses().getFirst().grade().accuracy()).isEqualTo(100);
        assertThat(checked.responses().getFirst().firstAccuracy()).isEqualTo(75);
        service.hint(5020, id, new HintRequest(0, 0));
        service.check(5020, id, new AnswerRequest(0, "We really enjoyed it"));
        // Assert
        assertThat(service.finish(5020, id).accuracy()).isEqualTo(75);
        assertThatThrownBy(() -> service.hint(5020, id, new HintRequest(0, 2))).isInstanceOf(
            AppException.class
        );
    }

    @Test
    void hint_whenAnswerHasWrongMissingOrExtraWords_shouldAvoidDuplicatePenaltiesAndKeepWordIndices() {
        // Arrange
        var missing = grader.grade("we really enjoyed it", "we enjoyed it");
        // Act
        assertThat(grader.withoutHintCredit(missing, List.of(1)).correct()).isEqualTo(3);
        assertThat(grader.withoutHintCredit(missing, List.of(2)).correct()).isEqualTo(2);
        var extra = grader.grade("we enjoyed it", "we really enjoyed it");
        // Assert
        assertThat(grader.withoutHintCredit(extra, List.of(1)).accuracy()).isEqualTo(33.3);
    }

    @Test
    void progress_whenLearnerTypesOutOfOrder_shouldReturnSafeIndexedFeedbackInActualOrder() throws Exception {
        // Arrange
        var detail = create("Live feedback", List.of(new Sentence("We really enjoyed it.", 0.0, 3.0)));
        service.publish(detail.id(), detail.version());
        // Act
        String id = start(5050, detail.id()).id();
        var response = request(
            5050L,
            false,
            "PUT",
            USER + "/attempts/" + id + "/progress",
            "{\"index\":0,\"text\":\"Yesterday we re\"}"
        );
        assertThat(response.statusCode()).isEqualTo(200);
        var data = json.readTree(response.body()).path("data");
        assertThat(data.path("scoringMode").asString()).isEqualTo("LIVE");
        var sentence = data.path("responses").get(0);
        assertThat(sentence.path("completed").asBoolean()).isFalse();
        assertThat(sentence.path("answer").isNull()).isTrue();
        assertThat(new String(response.body(), StandardCharsets.UTF_8)).doesNotContain(
            "really",
            "enjoyed",
            "\"it\""
        );
        var partial = service.attempt(5050, id).responses().getFirst();
        assertThat(partial.feedback()).containsExactly(
            new Feedback(0, "correct", "we"),
            new Feedback(1, "partial", null),
            new Feedback(2, "empty", null),
            new Feedback(3, "empty", null)
        );
        assertThat(
            partial.grade().words().stream().map(Edit::actual).filter(Objects::nonNull).toList()
        ).containsExactly("yesterday", "we", "re");
        assertThat(partial.grade().words())
            .filteredOn(edit -> !edit.type().equals("correct"))
            .allSatisfy(edit -> assertThat(edit.expected()).isNull());

        var wrong = service.progress(5050, id, new AnswerRequest(0, "We wrong"));
        assertThat(wrong.completed()).isZero();
        assertThat(wrong.responses().getFirst().feedback().get(1)).isEqualTo(
            new Feedback(1, "incorrect", null)
        );
        assertThat(wrong.responses().getFirst().answer()).isNull();
        assertThat(
            service
                .history(5050, "", "", "", "IN_PROGRESS", 0, 20)
                .items()
                .getFirst()
                .responses()
                .getFirst()
                .answer()
        ).isNull();
        var blank = service.check(5050, id, new AnswerRequest(0, ""));
        // Assert
        assertThat(blank.completed()).isZero();
        assertThat(blank.accuracy()).isEqualTo(25);
        assertThat(blank.responses().getFirst().feedback()).allMatch(word -> word.state().equals("empty"));
        assertThatThrownBy(() -> service.finish(5050, id)).isInstanceOf(
            com.elearning.learning.common.exception.DictationValidationException.class
        );
    }

    @Test
    void hint_whenWordsWereEarnedBeforeOrAfterHint_shouldPreservePersistentCreditLedger() {
        // Arrange
        var detail = create("Live ledger", List.of(new Sentence("We really enjoyed it.", 0.0, 3.0)));
        service.publish(detail.id(), detail.version());
        // Act
        String id = start(5051, detail.id()).id();
        assertThat(service.progress(5051, id, new AnswerRequest(0, "We really")).accuracy()).isEqualTo(50);
        assertThat(service.hint(5051, id, new HintRequest(0, 1)).accuracy()).isEqualTo(50);
        service.hint(5051, id, new HintRequest(0, 2));
        assertThat(
            service.progress(5051, id, new AnswerRequest(0, "We really enjoyed wrong")).accuracy()
        ).isEqualTo(50);
        assertThat(service.progress(5051, id, new AnswerRequest(0, "")).accuracy()).isEqualTo(50);
        assertThat(service.attempt(5051, id).accuracy()).isEqualTo(50);
        assertThat(
            jdbc.queryForObject(
                "SELECT earned_indices FROM dictation_responses WHERE attempt_id=?",
                String.class,
                id
            )
        ).isEqualTo("[0,1]");
        var done = service.progress(5051, id, new AnswerRequest(0, "We really enjoyed it"));
        // Assert
        assertThat(done.completed()).isEqualTo(1);
        assertThat(done.accuracy()).isEqualTo(75);
        assertThat(done.responses().getFirst().completed()).isTrue();
        assertThat(done.responses().getFirst().answer()).isEqualTo("We really enjoyed it.");
        assertThat(done.responses().getFirst().hints()).containsExactly(
            new Hint(1, "really"),
            new Hint(2, "enjoyed")
        );
        assertThat(service.finish(5051, id).accuracy()).isEqualTo(75);
    }

    @Test
    void progress_whenAnswerHasExtraWords_shouldPreventCompletionAndDoNotBankNewCredit() {
        // Arrange
        var detail = create("Extra words", List.of(new Sentence("We enjoyed it.", 0.0, 3.0)));
        service.publish(detail.id(), detail.version());
        String id = start(5052, detail.id()).id();
        // Act
        var extra = service.progress(5052, id, new AnswerRequest(0, "We really enjoyed it extra"));
        assertThat(extra.completed()).isZero();
        assertThat(extra.responses().getFirst().answer()).isNull();
        assertThat(extra.responses().getFirst().grade().extra()).isEqualTo(2);
        assertThat(extra.responses().getFirst().feedback()).containsExactly(
            new Feedback(0, "correct", "we"),
            new Feedback(1, "correct", "enjoyed"),
            new Feedback(2, "correct", "it")
        );
        assertThat(extra.accuracy()).isZero();
        assertThat(service.progress(5052, id, new AnswerRequest(0, "wrong")).accuracy()).isZero();
        assertThat(service.progress(5052, id, new AnswerRequest(0, "We enjoyed it")).completed()).isEqualTo(
            1
        );
        assertThat(service.finish(5052, id).accuracy()).isEqualTo(100);

        String padded = start(5055, detail.id()).id();
        service.progress(5055, padded, new AnswerRequest(0, "We really enjoyed it extra"));
        assertThat(service.revealOrSkip(5055, padded, 0, true).accuracy()).isZero();
        assertThat(service.finish(5055, padded).accuracy()).isZero();

        String retained = start(5056, detail.id()).id();
        service.progress(5056, retained, new AnswerRequest(0, "We"));
        service.progress(5056, retained, new AnswerRequest(0, "We really enjoyed it extra"));
        // Assert
        assertThat(service.revealOrSkip(5056, retained, 0, true).accuracy()).isEqualTo(33.3);
    }

    @Test
    void finish_whenLearnerUsedRevealSkipOrHints_shouldScorePreviouslyEarnedWordsByWordCount() {
        // Arrange
        var detail = create(
            "Weighted live score",
            List.of(new Sentence("We enjoyed it.", 0.0, 3.0), new Sentence("Thanks.", 3.0, 4.0))
        );
        service.publish(detail.id(), detail.version());
        // Act
        String id = start(5053, detail.id()).id();
        service.progress(5053, id, new AnswerRequest(0, "We wrong"));
        assertThat(service.revealOrSkip(5053, id, 0, true).accuracy()).isEqualTo(25);
        assertThatThrownBy(() ->
            service.progress(5053, id, new AnswerRequest(0, "We enjoyed it"))
        ).isInstanceOf(AppException.class);
        var skipped = service.revealOrSkip(5053, id, 1, false);
        assertThat(skipped.responses().get(1).completed()).isTrue();
        assertThat(skipped.responses().get(1).skipped()).isTrue();
        assertThatThrownBy(() -> service.progress(5053, id, new AnswerRequest(1, "Thanks"))).isInstanceOf(
            AppException.class
        );
        assertThat(service.finish(5053, id).accuracy()).isEqualTo(25);

        String hinted = start(5054, detail.id()).id();
        service.progress(5054, hinted, new AnswerRequest(0, "We wrong"));
        for (int word = 0; word < 3; word++) service.hint(5054, hinted, new HintRequest(0, word));
        var allHints = service.attempt(5054, hinted);
        // Assert
        assertThat(allHints.completed()).isEqualTo(1);
        assertThat(allHints.responses().getFirst().completed()).isTrue();
        assertThat(allHints.responses().getFirst().revealed()).isTrue();
        assertThat(allHints.accuracy()).isEqualTo(25);
        assertThatThrownBy(() ->
            service.progress(5054, hinted, new AnswerRequest(0, "We enjoyed it"))
        ).isInstanceOf(AppException.class);
    }

    @Test
    void progress_whenLearnerRetriesWrongAnswer_shouldAllowFullCreditAndKeepRevealedSentencesLocked() {
        // Arrange
        var detail = create(
            "Scoring",
            List.of(new Sentence("We enjoyed it.", 0.0, 3.0), new Sentence("All right, thanks.", 3.0, 6.0))
        );
        service.publish(detail.id(), detail.version());
        var attempt = start(5004, detail.id());
        // Act
        attempt = service.check(5004, attempt.id(), new AnswerRequest(0, "We it"));
        double first = attempt.responses().getFirst().firstAccuracy();
        assertThat(first).isEqualTo(66.7);
        assertThat(attempt.completed()).isZero();
        assertThat(attempt.responses().getFirst().answer()).isNull();
        attempt = service.check(5004, attempt.id(), new AnswerRequest(0, "We enjoyed it"));
        assertThat(attempt.responses().getFirst().grade().accuracy()).isEqualTo(100);
        assertThat(attempt.responses().getFirst().firstAccuracy()).isEqualTo(100);
        attempt = service.revealOrSkip(5004, attempt.id(), 1, true);
        assertThat(attempt.responses().get(1).firstAccuracy()).isZero();
        assertThat(attempt.responses().get(1).revealed()).isTrue();
        String id = attempt.id();
        assertThatThrownBy(() ->
            service.check(5004, id, new AnswerRequest(1, "All right thanks"))
        ).isInstanceOf(AppException.class);
        var finished = service.finish(5004, attempt.id());
        // Assert
        assertThat(finished.accuracy()).isEqualTo(50);
        assertThat(service.finish(5004, attempt.id()).completedAt()).isEqualTo(finished.completedAt());
        assertThat(service.check(5004, id, new AnswerRequest(0, "We enjoyed it")).accuracy()).isEqualTo(50);
        assertThatThrownBy(() -> service.check(5004, id, new AnswerRequest(0, "changed"))).isInstanceOf(
            AppException.class
        );
        assertThatThrownBy(() -> service.hint(5004, id, new HintRequest(0, 0))).isInstanceOf(
            AppException.class
        );
        assertThatThrownBy(() -> service.revealOrSkip(5004, id, 1, false)).isInstanceOf(AppException.class);
    }

    @Test
    void start_whenConcurrentRequestsResumePractice_shouldReuseAttemptAndSavedSentence() throws Exception {
        // Arrange
        var definition = create("Concurrency", List.of(new Sentence("Hello there.", 0.0, 3.0)));
        service.publish(definition.id(), definition.version());
        String requestId = UUID.randomUUID().toString();
        Set<String> ids = new HashSet<>();
        // Act
        try (var pool = Executors.newFixedThreadPool(4)) {
            var futures = java.util.stream.IntStream.range(0, 8)
                .mapToObj(i ->
                    pool.submit(() ->
                        service.start(5005, definition.id(), new StartRequest(requestId, false))
                    )
                )
                .toList();
            for (var future : futures) ids.add(future.get().id());
        }
        assertThat(ids).hasSize(1);
        String id = ids.iterator().next();
        service.progress(5005, id, new AnswerRequest(0, "unsent draft"));
        // Assert
        assertThat(
            service
                .start(5005, definition.id(), new StartRequest(UUID.randomUUID().toString(), false))
                .responses()
                .getFirst()
                .text()
        ).isEqualTo("unsent draft");
        assertThat(service.attempt(5005, id).completed()).isZero();
        assertThatThrownBy(() -> service.finish(5005, id)).isInstanceOf(
            com.elearning.learning.common.exception.DictationValidationException.class
        );
    }

    @Test
    void start_whenLatestAttemptIsComplete_shouldReopenByDefaultAndPreserveHistoryOnRestart() {
        // Arrange
        var detail = create("Latest run", List.of(new Sentence("Hello there.", 0.0, 3.0)));
        service.publish(detail.id(), detail.version());
        // Act
        String old = start(5060, detail.id()).id();
        service.progress(5060, old, new AnswerRequest(0, "draft"));
        String requestId = UUID.randomUUID().toString();
        String latest = service.start(5060, detail.id(), new StartRequest(requestId, true)).id();
        assertThat(latest).isNotEqualTo(old);
        service.progress(5060, latest, new AnswerRequest(0, "Hello there"));
        assertThat(start(5060, detail.id()).id()).isEqualTo(latest);
        service.finish(5060, latest);
        assertThat(start(5060, detail.id()).id()).isEqualTo(latest);
        assertThat(service.start(5060, detail.id(), new StartRequest(requestId, true)).id()).isEqualTo(
            latest
        );
        assertThat(service.attempt(5060, old).responses().getFirst().text()).isEqualTo("draft");
        var restarted = service.start(
            5060,
            detail.id(),
            new StartRequest(UUID.randomUUID().toString(), true)
        );
        // Assert
        assertThat(restarted.id()).isNotIn(old, latest);
        assertThat(restarted.scoringMode()).isEqualTo("LIVE");
        assertThat(restarted.accuracy()).isZero();
        assertThat(restarted.completed()).isZero();
        assertThat(restarted.responses().getFirst().text()).isEmpty();
        assertThat(service.history(5060, "", "", "", "IN_PROGRESS", 0, 20).items())
            .extracting(Attempt::id)
            .containsExactly(restarted.id());
        assertThat(service.history(5060, "", "", "", "COMPLETED", 0, 20).total()).isZero();
        assertThat(
            service.catalog(5060, "Latest run", "", "", 0, 12, false).items().getFirst().attemptId()
        ).isEqualTo(restarted.id());
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM dictation_attempts WHERE user_id=?",
                Integer.class,
                5060
            )
        ).isEqualTo(3);
    }

    @Test
    void progress_whenHintAndAnswerAreSubmittedConcurrently_shouldPreserveEarnedCreditAndHints() throws Exception {
        // Arrange
        var detail = create("Concurrent mutations", List.of(new Sentence("We really enjoyed it.", 0.0, 3.0)));
        service.publish(detail.id(), detail.version());
        String id = start(5061, detail.id()).id();
        // Act
        service.progress(5061, id, new AnswerRequest(0, "We"));
        try (var pool = Executors.newFixedThreadPool(3)) {
            var gate = new java.util.concurrent.CountDownLatch(1);
            var progress = pool.submit(() -> {
                gate.await();
                return service.progress(5061, id, new AnswerRequest(0, "We really"));
            });
            var hint1 = pool.submit(() -> {
                gate.await();
                return service.hint(5061, id, new HintRequest(0, 0));
            });
            var hint2 = pool.submit(() -> {
                gate.await();
                return service.hint(5061, id, new HintRequest(0, 2));
            });
            gate.countDown();
            progress.get();
            hint1.get();
            hint2.get();
        }
        var saved = service.attempt(5061, id);
        // Assert
        assertThat(saved.responses().getFirst().hints()).containsExactlyInAnyOrder(
            new Hint(0, "we"),
            new Hint(2, "enjoyed")
        );
        assertThat(saved.responses().getFirst().text()).isEqualTo("We really");
        assertThat(saved.accuracy()).isEqualTo(50);
        assertThat(
            service.progress(5061, id, new AnswerRequest(0, "We really enjoyed it")).accuracy()
        ).isEqualTo(75);
    }

    @Test
    void history_whenContentHasMultipleRevisions_shouldChooseLatestAttemptBeforeFiltering() {
        // Arrange
        var original = create("Stale history title", List.of(new Sentence("Hello there.", 0.0, 3.0)));
        service.publish(original.id(), original.version());
        // Act
        String old = start(5062, original.id()).id();
        service.progress(5062, old, new AnswerRequest(0, "Hello there"));
        service.finish(5062, old);
        start(5063, original.id());
        var edited = service.save(
            original.id(),
            new SaveRequest(
                new Definition(
                    "Current history title",
                    "",
                    "Travel",
                    "A2",
                    sampleAudioKey,
                    List.of(new Sentence("New words.", 0.0, 3.0))
                ),
                original.version()
            )
        );
        service.publish(edited.id(), edited.version());
        var latest = service.start(5062, original.id(), new StartRequest(UUID.randomUUID().toString(), true));
        assertThat(service.history(5062, "Stale", "", "", "", 0, 20).total()).isZero();
        assertThat(service.history(5062, "", "B1", "", "", 0, 20).total()).isZero();
        assertThat(service.history(5062, "", "", "Workplace", "", 0, 20).total()).isZero();
        assertThat(service.history(5062, "", "", "", "COMPLETED", 0, 20).total()).isZero();
        var history = service.history(5062, "Current", "A2", "Travel", "IN_PROGRESS", 0, 1);
        // Assert
        assertThat(history.total()).isEqualTo(1);
        assertThat(history.items()).extracting(Attempt::id).containsExactly(latest.id());
        assertThat(history.topics()).containsExactly("Travel");
        assertThat(service.history(5063, "", "", "", "", 0, 20).topics()).containsExactly("Workplace");
        assertThat(service.attempt(5062, old).title()).isEqualTo("Stale history title");
    }

    @Test
    void start_whenClockIsFixedOrMovesBackwards_shouldKeepRestartAsLatestAttempt() {
        // Arrange
        var detail = create("Fixed clock", List.of(new Sentence("Hello there.", 0.0, 3.0)));
        service.publish(detail.id(), detail.version());
        Instant instant = Instant.parse("2026-01-01T00:00:00.000000499Z");
        var fixed = new DictationService(
            jdbc,
            json,
            grader,
            audio,
            java.time.Clock.fixed(instant, java.time.ZoneOffset.UTC)
        );
        var tx = new org.springframework.transaction.support.TransactionTemplate(transactions);
        // Act
        var first = tx.execute(status ->
            fixed.start(5064, detail.id(), new StartRequest(UUID.randomUUID().toString(), true))
        );
        var second = tx.execute(status ->
            fixed.start(5064, detail.id(), new StartRequest(UUID.randomUUID().toString(), true))
        );
        var backwards = new DictationService(
            jdbc,
            json,
            grader,
            audio,
            java.time.Clock.fixed(instant.minusSeconds(10), java.time.ZoneOffset.UTC)
        );
        var third = tx.execute(status ->
            backwards.start(5064, detail.id(), new StartRequest(UUID.randomUUID().toString(), true))
        );
        // Assert
        assertThat(second.startedAt()).isEqualTo(first.startedAt().plusNanos(1000));
        assertThat(third.startedAt()).isEqualTo(second.startedAt().plusNanos(1000));
        assertThat(start(5064, detail.id()).id()).isEqualTo(third.id());
        assertThat(service.history(5064, "", "", "", "", 0, 20).items())
            .extracting(Attempt::id)
            .containsExactly(third.id());
    }

    @Test
    void publish_whenExerciseIsEditedOrArchived_shouldPreserveHistoricalRevision() {
        // Arrange
        var original = create("Original title", List.of(new Sentence("Original words.", 0.0, 3.0)));
        // Act
        service.publish(original.id(), original.version());
        var old = start(5006, original.id());
        var edited = service.save(
            original.id(),
            new SaveRequest(
                new Definition(
                    "New title",
                    "",
                    "Workplace",
                    "B1",
                    sampleAudioKey,
                    List.of(new Sentence("Different words.", 0.0, 3.0))
                ),
                original.version()
            )
        );
        assertThat(
            service.start(5007, original.id(), new StartRequest(UUID.randomUUID().toString(), false)).title()
        ).isEqualTo("Original title");
        service.publish(original.id(), edited.version());
        assertThat(
            service.start(5008, original.id(), new StartRequest(UUID.randomUUID().toString(), false)).title()
        ).isEqualTo("New title");
        assertThat(
            service.check(5006, old.id(), new AnswerRequest(0, "Original words")).accuracy()
        ).isEqualTo(100);
        assertThat(service.attempt(5006, old.id()).version()).isEqualTo(1);
        service.visibility(original.id(), true);
        // Assert
        assertThatThrownBy(() -> start(5009, original.id())).isInstanceOf(AppException.class);
        assertThat(
            service.history(5006, "Original", "B1", "Workplace", "", 0, 20).items().getFirst().title()
        ).isEqualTo("Original title");
        assertThat(service.history(5006, "New title", "", "", "", 0, 20).total()).isZero();
        assertThatThrownBy(() ->
            service.save(original.id(), new SaveRequest(edited.definition(), 1))
        ).isInstanceOf(AppException.class);
    }

    @Test
    void visibility_whenExistingLessonIsArchived_shouldBlockPracticeAndResumeAfterRestore()
        throws Exception {
        // Arrange
        var lesson = create("Archived access", List.of(new Sentence("We enjoyed it.", 0.0, 3.0)));
        service.publish(lesson.id(), lesson.version());
        var active = start(5101, lesson.id());
        var draft = service.progress(5101, active.id(), new AnswerRequest(0, "We"));
        var finished = start(5102, lesson.id());
        service.progress(5102, finished.id(), new AnswerRequest(0, "We enjoyed it"));
        finished = service.finish(5102, finished.id());
        // Act
        service.visibility(lesson.id(), true);

        for (String action : List.of("progress", "check", "hint", "reveal", "skip", "finish")) {
            String body = switch (action) {
                case "progress", "check" -> "{\"index\":0,\"text\":\"We enjoyed it\"}";
                case "hint" -> "{\"index\":0,\"wordIndex\":1}";
                case "finish" -> null;
                default -> "{\"index\":0}";
            };
            var response = request(
                5101L,
                false,
                action.equals("progress") ? "PUT" : "POST",
                USER + "/attempts/" + active.id() + "/" + action,
                body
            );
            assertThat(response.statusCode()).as(action).isEqualTo(409);
            assertThat(json.readTree(response.body()).path("code").asString()).isEqualTo(
                "DICTATION_ARCHIVED"
            );
        }
        for (String suffix : List.of("", "/audio")) {
            assertThat(
                request(5101L, false, "GET", USER + "/attempts/" + active.id() + suffix, null).statusCode()
            ).isEqualTo(409);
        }
        assertThat(
            request(5103L, false, "GET", USER + "/attempts/" + active.id(), null).statusCode()
        ).isEqualTo(404);
        var stored = service.history(5101, "Archived access", "", "", "", 0, 20).items().getFirst();
        assertThat(stored.archived()).isTrue();
        assertThat(stored.responses()).isEqualTo(draft.responses());
        assertThat(stored.completedAt()).isNull();
        var result = service.attempt(5102, finished.id());
        assertThat(result.archived()).isTrue();
        assertThat(result.accuracy()).isEqualTo(finished.accuracy());
        assertThat(result.responses()).isEqualTo(finished.responses());
        assertThat(result.completedAt()).isEqualTo(finished.completedAt());
        assertThat(
            request(5102L, false, "GET", USER + "/attempts/" + finished.id(), null).statusCode()
        ).isEqualTo(200);
        assertThat(service.audioKey(5102, finished.id())).isEqualTo(lesson.definition().audioKey());
        assertThatThrownBy(() ->
            service.start(5102, lesson.id(), new StartRequest(UUID.randomUUID().toString(), true))
        ).isInstanceOf(AppException.class);

        service.visibility(lesson.id(), false);
        assertThat(service.attempt(5101, active.id()).responses()).isEqualTo(draft.responses());
        var resumed = service.progress(5101, active.id(), new AnswerRequest(0, "We enjoyed it"));
        // Assert
        assertThat(resumed.archived()).isFalse();
        assertThat(resumed.completed()).isEqualTo(1);
    }

    @Test
    void progress_whenSentenceIsAlreadyCorrect_shouldLockItAndAllowNavigationAndRetriesElsewhere() throws Exception {
        // Arrange
        var detail = create(
            "Locked answers",
            List.of(new Sentence("We enjoyed it.", 0.0, 3.0), new Sentence("All right, thanks.", 3.0, 6.0))
        );
        service.publish(detail.id(), detail.version());
        // Act
        String id = start(5040, detail.id()).id();
        var wrong = service.check(5040, id, new AnswerRequest(0, "We it"));
        assertThat(wrong.responses().getFirst().revealed()).isFalse();
        service.progress(5040, id, new AnswerRequest(0, "We enjoyed it"));
        var correct = service.check(5040, id, new AnswerRequest(0, "We enjoyed it"));
        assertThat(correct.responses().getFirst().grade().accuracy()).isEqualTo(100);
        double score = correct.responses().getFirst().firstAccuracy();
        for (String action : List.of("progress", "check")) {
            assertThat(
                request(
                    5040L,
                    false,
                    action.equals("progress") ? "PUT" : "POST",
                    USER + "/attempts/" + id + "/" + action,
                    "{\"index\":0,\"text\":\"changed after correct\"}"
                ).statusCode()
            ).isEqualTo(409);
        }
        assertThat(
            service
                .check(5040, id, new AnswerRequest(0, "We enjoyed it"))
                .responses()
                .getFirst()
                .firstAccuracy()
        ).isEqualTo(score);
        assertThat(service.revealOrSkip(5040, id, 0, true).responses().getFirst().revealed()).isFalse();
        assertThat(service.hint(5040, id, new HintRequest(0, 0)).responses().getFirst().hints()).isEmpty();
        service.progress(5040, id, new AnswerRequest(1, "my next draft"));
        // Assert
        assertThat(service.progress(5040, id, new AnswerRequest(0, "We enjoyed it")).currentIndex()).isZero();
        assertThat(service.attempt(5040, id).currentIndex()).isZero();
        assertThat(start(5040, detail.id()).currentIndex()).isZero();
        assertThat(service.attempt(5040, id).responses().getFirst().text()).isEqualTo("We enjoyed it");
        assertThat(service.attempt(5040, id).responses().get(1).text()).isEqualTo("my next draft");
    }

    @Test
    void history_whenOwnerUsesFiltersAndPagination_shouldReturnTotalsForOwnedRevision() throws Exception {
        // Arrange
        var lesson = create("History filter lesson", List.of(new Sentence("Hello there.", 0.0, 3.0)));
        service.publish(lesson.id(), lesson.version());
        String completed = null;
        for (int index = 0; index < 20; index++) {
            String id = service
                .start(5042, lesson.id(), new StartRequest(UUID.randomUUID().toString(), true))
                .id();
            if (index == 0) completed = id;
        }
        service.check(5042, completed, new AnswerRequest(0, "Hello there"));
        service.finish(5042, completed);
        var other = service.save(
            null,
            new SaveRequest(
                new Definition(
                    "Travel lesson",
                    "",
                    "Travel",
                    "A2",
                    sampleAudioKey,
                    List.of(new Sentence("Hello there.", 0.0, 3.0))
                ),
                0
            )
        );
        service.publish(other.id(), other.version());
        start(5042, other.id());
        start(5043, lesson.id());
        // Act
        var firstPage = service.history(5042, "", "", "", "", 0, 20);
        var secondPage = service.history(5042, "", "", "", "", 1, 20);
        assertThat(firstPage.total()).isEqualTo(2);
        assertThat(firstPage.items()).hasSize(2);
        assertThat(secondPage.total()).isEqualTo(2);
        assertThat(secondPage.items()).isEmpty();
        assertThat(secondPage.items()).noneMatch(item ->
            firstPage
                .items()
                .stream()
                .anyMatch(first -> first.id().equals(item.id()))
        );
        var exactPage = service.history(5042, "  HISTORY FILTER  ", "B1", "Workplace", "", 0, 20);
        assertThat(exactPage.total()).isEqualTo(1);
        assertThat(exactPage.size()).isEqualTo(20);
        assertThat(exactPage.items()).hasSize(1);
        assertThat(exactPage.items().getFirst().id()).isNotEqualTo(completed);
        assertThat(service.history(5042, "", "B1", "Workplace", "IN_PROGRESS", 0, 20).total()).isEqualTo(1);
        assertThat(service.history(5042, "", "", "", "COMPLETED", 0, 20).items()).isEmpty();
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM dictation_attempts WHERE user_id=?",
                Integer.class,
                5042
            )
        ).isEqualTo(21);
        var singlePage = service.history(5042, "", "", "", "", 0, 1);
        var nextPage = service.history(5042, "", "", "", "", 1, 1);
        assertThat(singlePage.total()).isEqualTo(2);
        assertThat(nextPage.total()).isEqualTo(2);
        assertThat(singlePage.items()).hasSize(1);
        assertThat(nextPage.items()).hasSize(1);
        assertThat(singlePage.items().getFirst().id()).isNotEqualTo(nextPage.items().getFirst().id());
        assertThat(service.history(5042, "", "A2", "Travel", "", 0, 20).total()).isEqualTo(1);
        assertThat(service.history(5044, "", "", "", "", 0, 20).total()).isZero();
        assertThat(service.history(5044, "", "", "", "", 0, 20).topics()).isEmpty();
        assertThat(firstPage.topics()).containsExactly("Travel", "Workplace");
        var response = request(
            5042L,
            false,
            "GET",
            USER + "/attempts?keyword=History&level=B1&topic=Workplace&status=COMPLETED",
            null
        );
        // Assert
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(json.readTree(response.body()).path("data").path("total").asLong()).isZero();
        assertThat(
            request(5042L, false, "GET", USER + "/attempts?status=INVALID", null).statusCode()
        ).isEqualTo(400);
    }

    @Test
    void publish_whenDraftTimingIsMissingOverlappingOrInvalid_shouldRejectPublication() {
        // Arrange
        // Act
        for (var rows : List.of(
            List.of(new Sentence("No timing.", null, null)),
            List.of(new Sentence("First.", 0.0, 4.0), new Sentence("Second.", 3.0, 5.0))
        )) {
            var detail = create("Invalid timeline", rows);
            assertThatThrownBy(() -> service.publish(detail.id(), detail.version())).isInstanceOf(
                com.elearning.learning.common.exception.DictationValidationException.class
            );
        }
        // Assert
        assertThatThrownBy(() ->
            create("Beyond audio", List.of(new Sentence("Hello.", 999.0, 1000.0)))
        ).isInstanceOf(com.elearning.learning.common.exception.DictationValidationException.class);
    }

    @Test
    void publish_whenEndTimeExceedsDuration_shouldClampToExactAudioEnd() {
        // Arrange
        String key = UUID.randomUUID() + ".mp3";
        jdbc.update(
            "INSERT INTO dictation_audio (audio_key, original_name, duration_seconds) VALUES (?, ?, ?)",
            key,
            "Fractional audio.mp3",
            35.8
        );
        var definition = new Definition(
            "Fractional audio",
            "",
            "Workplace",
            "B1",
            key,
            List.of(new Sentence("The last word.", 32.0, 36.0))
        );
        var request = new SaveRequest(definition, 0);
        var draft = service.save(null, request);
        // Act
        assertThat(draft.definition().sentences().getFirst().end()).isEqualTo(35.8);
        service.publish(draft.id(), draft.version());
        assertThat(start(5095, draft.id()).sentences().getFirst().end()).isEqualTo(35.8);
        var direct = service.saveAndPublish(null, request);
        assertThat(direct.definition().sentences().getFirst().end()).isEqualTo(35.8);
        assertThat(start(5096, direct.id()).sentences().getFirst().end()).isEqualTo(35.8);
        var shorter = service.save(
            null,
            new SaveRequest(
                new Definition(
                    definition.title(),
                    "",
                    definition.topic(),
                    definition.level(),
                    key,
                    List.of(new Sentence("Earlier end.", 32.0, 35.0))
                ),
                0
            )
        );
        // Assert
        assertThat(shorter.definition().sentences().getFirst().end()).isEqualTo(35.0);
        assertThatThrownBy(() ->
            service.saveAndPublish(
                null,
                new SaveRequest(
                    new Definition(
                        definition.title(),
                        "",
                        definition.topic(),
                        definition.level(),
                        key,
                        List.of(new Sentence("Invalid start.", 35.8, 36.0))
                    ),
                    0
                )
            )
        ).isInstanceOf(com.elearning.learning.common.exception.DictationValidationException.class);
    }

    @Test
    void publish_whenDefinitionIsProvided_shouldCreateOrUpdateWithoutSeparateDraft() throws Exception {
        // Arrange
        var definition = new Definition(
            "Direct publication",
            "",
            "Workplace",
            "B1",
            sampleAudioKey,
            List.of(new Sentence("Original words.", 0.0, 3.0))
        );
        var response = request(
            5091L,
            true,
            "POST",
            ADMIN + "/publish",
            json.writeValueAsString(new SaveRequest(definition, 0))
        );
        // Act
        assertThat(response.statusCode()).isEqualTo(201);
        String id = json.readTree(response.body()).path("data").path("id").asString();
        var original = service.adminDetail(id);
        assertThat(original.published()).isTrue();
        assertThat(original.hasDraft()).isFalse();
        assertThat(original.version()).isEqualTo(1);
        var attempt = start(5091, id);

        var updated = new Definition(
            "Direct update",
            "New description",
            "Workplace",
            "B1",
            definition.audioKey(),
            List.of(new Sentence("Updated words.", 0.0, 3.0))
        );
        String payload = json.writeValueAsString(new PublishRequest(original.version(), updated));
        assertThat(
            request(5091L, true, "POST", ADMIN + "/" + id + "/publish", payload).statusCode()
        ).isEqualTo(200);
        var current = service.adminDetail(id);
        // Assert
        assertThat(current.version()).isEqualTo(2);
        assertThat(current.definition()).isEqualTo(updated);
        assertThat(current.hasDraft()).isFalse();
        assertThat(service.attempt(5091, attempt.id()).title()).isEqualTo(definition.title());
        assertThat(start(5092, id).title()).isEqualTo(updated.title());
        assertThat(
            request(5091L, true, "POST", ADMIN + "/" + id + "/publish", payload).statusCode()
        ).isEqualTo(409);
        assertThat(service.adminDetail(id).version()).isEqualTo(2);
        assertThat(
            request(5091L, true, "POST", ADMIN + "/" + id + "/publish", "{\"version\":2}").statusCode()
        ).isEqualTo(200);
        assertThat(
            request(
                5091L,
                false,
                "POST",
                ADMIN + "/publish",
                json.writeValueAsString(new SaveRequest(definition, 0))
            ).statusCode()
        ).isEqualTo(403);
    }

    @Test
    void publish_whenDefinitionIsInvalid_shouldAvoidPartialLessonOrOverwritingPublishedContent() throws Exception {
        // Arrange
        int before = jdbc.queryForObject("SELECT COUNT(*) FROM dictation_exercises", Integer.class);
        var invalid = new Definition(
            "Invalid publication",
            "",
            "Workplace",
            "B1",
            sampleAudioKey,
            List.of(new Sentence("Missing end.", 0.0, null))
        );
        // Act
        assertThat(
            request(
                5093L,
                true,
                "POST",
                ADMIN + "/publish",
                json.writeValueAsString(new SaveRequest(invalid, 0))
            ).statusCode()
        ).isEqualTo(400);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM dictation_exercises", Integer.class)).isEqualTo(
            before
        );
        var draft = create("Preserved publication", List.of(new Sentence("Keep these words.", 0.0, 3.0)));
        var published = service.publish(draft.id(), draft.version());
        // Assert
        assertThat(
            request(
                5093L,
                true,
                "POST",
                ADMIN + "/" + draft.id() + "/publish",
                json.writeValueAsString(new PublishRequest(published.version(), invalid))
            ).statusCode()
        ).isEqualTo(400);
        assertThat(service.adminDetail(draft.id())).isEqualTo(published);
    }

    @Test
    void adminSyncsPublishedWorkbooksAndRestoresThePublishedVersionAfterHide() throws Exception {
        long admin = 5110L;
        var definition = new Definition(
            "Admin synchronized workbook", "", "Daily English Conversation", "A1", null,
            List.of(new Sentence("Original words.", 0.25, 3.75)),
            new Video("https://www.youtube.com/watch?v=_R7nrvhNmrI", 92.5)
        );
        var created = request(admin, true, "POST", ADMIN + "/publish", json.writeValueAsString(new SaveRequest(definition, 0)));
        assertThat(created.statusCode()).isEqualTo(201);
        String id = json.readTree(created.body()).path("data").path("id").asString();
        String path = ADMIN + "/" + id;
        workbookSync.sync();
        String key = jdbc.queryForObject(
            "SELECT object_key FROM dictation_workbook_sources WHERE exercise_id=? AND storage='local'",
            String.class, id
        );
        assertThat(key).startsWith("admin-synchronized-workbook-").endsWith(".xlsx");
        Path stored = Path.of("./target/dictation-test-uploads", "workbooks", key);
        try {
            assertThat(stored).exists();
            assertThat(workbooks.parseLesson(Files.readAllBytes(stored))).isEqualTo(definition);
            var download = request(admin, true, "GET", path + "/workbook", null);
            assertThat(download.statusCode()).isEqualTo(200);
            assertThat(download.body()).isEqualTo(Files.readAllBytes(stored));
            Files.deleteIfExists(stored);
            var fallbackDownload = request(admin, true, "GET", path + "/workbook", null);
            assertThat(fallbackDownload.statusCode()).isEqualTo(200);
            assertThat(workbooks.parseLesson(fallbackDownload.body())).isEqualTo(definition);
            assertThat(request(admin, false, "GET", path + "/workbook", null).statusCode()).isEqualTo(403);

            var updated = new Definition(
                definition.title(), "", definition.topic(), definition.level(), null,
                List.of(new Sentence("Updated words.", 4.25, 8.75)), definition.video()
            );
            assertThat(request(admin, true, "POST", path + "/publish",
                json.writeValueAsString(new PublishRequest(1, updated))).statusCode()).isEqualTo(200);
            workbookSync.sync();
            assertThat(workbooks.parseLesson(Files.readAllBytes(stored))).isEqualTo(updated);
            assertThat(jdbc.queryForObject(
                "SELECT object_key FROM dictation_workbook_sources WHERE exercise_id=? AND storage='local'",
                String.class, id
            )).isEqualTo(key);

            assertThat(request(admin, true, "PUT", path, json.writeValueAsString(new SaveRequest(definition, 2)))
                .statusCode()).isEqualTo(200);
            assertThat(request(admin, true, "PUT", path + "/visibility", "{\"archived\":true}").statusCode()).isEqualTo(200);
            workbookSync.sync();
            assertThat(stored).doesNotExist();
            assertThat(request(admin, true, "GET", path + "/workbook", null).statusCode()).isEqualTo(404);
            assertThat(service.catalog(0, definition.title(), "", "", 0, 12, false).items()).isEmpty();

            assertThat(request(admin, true, "PUT", path + "/visibility", "{\"archived\":false}").statusCode()).isEqualTo(200);
            workbookSync.sync();
            assertThat(workbooks.parseLesson(Files.readAllBytes(stored))).isEqualTo(updated);
            assertThat(service.catalog(0, definition.title(), "", "", 0, 12, false).items()).extracting(Item::id)
                .containsExactly(id);
        } finally {
            Files.deleteIfExists(stored);
        }
    }

    @Test
    void importWorkbook_whenWorkbookHasMetadataOrTranscriptOnly_shouldReturnAvailableFields() throws Exception {
        // Arrange
        byte[] template = workbooks.template();
        var samples = workbooks.parse(xlsx(template));
        // Act
        assertThat(samples.errors()).isEmpty();
        // Assert
        assertThat(samples.sentences()).hasSize(2);
        assertThat(samples.sentences().getFirst().text()).isEqualTo("Thank you for joining us today.");
        assertThat(samples.sentences().get(1).start()).isEqualTo(4.0);
        var lesson = workbooks.parseLesson(template);
        assertThat(lesson.title()).isEqualTo("What day is it today?");
        assertThat(lesson.video().duration()).isEqualTo(92.0);
        assertThat(lesson.sentences()).isEqualTo(samples.sentences());
        try (
            var workbook = new XSSFWorkbook(new ByteArrayInputStream(template));
            var output = new java.io.ByteArrayOutputStream()
        ) {
            assertThat(workbook.getNumberOfSheets()).isEqualTo(1);
            var transcript = workbook.getSheet("Transcript");
            assertThat(transcript.getMergedRegions()).extracting(range -> range.formatAsString())
                .containsExactly("B1:D1", "B2:D2", "B3:D3", "B4:D4", "B5:D5", "B6:D6");
            assertThat(transcript.getDataValidations()).singleElement().satisfies(validation -> {
                assertThat(validation.getRegions().getCellRangeAddresses()[0].formatAsString()).isEqualTo("B4");
                assertThat(validation.getValidationConstraint().getExplicitListValues())
                    .containsExactly("A1", "A2", "B1", "B2", "C1", "C2");
            });
            var duration = transcript.getRow(5);
            assertThat(duration.getCell(0).getStringCellValue()).isEqualTo("Thời gian");
            assertThat(duration.getCell(1).getStringCellValue()).isEqualTo("01:32");
            assertThat(duration.getCell(1).getCellStyle().getDataFormatString()).isEqualTo("@");
            duration.getCell(0).setCellValue("Thời lượng (mm:ss)");
            workbook.write(output);
            assertThat(workbooks.parseLesson(output.toByteArray()).video().duration()).isEqualTo(92.0);
            output.reset();
            assertThat(transcript.getRow(TEMPLATE_FIRST_SENTENCE_ROW - 1).getCell(0).getStringCellValue())
                .isEqualTo("Thứ tự");
            var row = transcript.getRow(TEMPLATE_FIRST_SENTENCE_ROW);
            assertThat(row.getCell(2).getCellStyle().getDataFormatString()).isEqualTo("@");
            transcript.getRow(0).getCell(0).setCellValue("Tên khác cho phần thông tin");
            transcript.getRow(1).getCell(1).setBlank();
            row.getCell(0).setCellValue("1");
            row.getCell(1).setCellValue("Hello there.");
            row.getCell(2).setCellValue("00:02");
            row.getCell(3).setCellValue("00:04");
            transcript.removeRow(transcript.getRow(TEMPLATE_FIRST_SENTENCE_ROW + 1));
            workbook.write(output);
            assertThatThrownBy(() -> workbooks.parseLesson(output.toByteArray()))
                .hasMessageContaining("Chưa điền mục “Tên bài nghe”");
            var imported = workbooks.parse(xlsx(output.toByteArray()));
            assertThat(imported.errors()).isEmpty();
            assertThat(imported.sentences()).hasSize(1);
            assertThat(imported.sentences().getFirst().start()).isEqualTo(2.0);

            var last = transcript.getRow(TEMPLATE_FIRST_SENTENCE_ROW + 199);
            writeWorkbookRow(last, "2", "Thank you.", "00:04", "00:07");
            output.reset();
            workbook.write(output);
            var extended = workbooks.parse(xlsx(output.toByteArray()));
            assertThat(extended.errors()).isEmpty();
            assertThat(extended.sentences()).extracting(Sentence::text).containsExactly("Hello there.", "Thank you.");
        }
    }

    @Test
    void scan_whenYouTubeWorkbookWasAlreadyImported_shouldAvoidRepublishingLesson(@TempDir Path inbox) throws Exception {
        // Arrange
        String title = "What day is it today?";
        String url = "https://www.youtube.com/watch?v=_R7nrvhNmrI";
        byte[] first = lessonWorkbook(title, "https://youtu.be/_R7nrvhNmrI?t=7", "1:32");
        Path transferring = Files.write(inbox.resolve("conversation.xlsx.part"), first);
        Files.write(inbox.resolve("~$conversation.xlsx"), first);
        Files.createDirectory(inbox.resolve("clips.xlsx"));
        var importer = workbookImporter(inbox);
        // Act
        importer.scan();
        assertThat(service.catalog(5098, title, "", "", 0, 12, false).items()).isEmpty();

        Files.move(transferring, inbox.resolve("conversation.XLSX"));
        importer.scan();
        var catalog = service.catalog(5098, title, "A1", "daily english conversation", 0, 12, false);
        assertThat(catalog.items()).hasSize(1);
        String id = catalog.items().getFirst().id();
        var lesson = service.adminDetail(id);
        assertThat(lesson.published()).isTrue();
        assertThat(lesson.definition().video()).isEqualTo(new Video(url, 92.0));
        assertThat(lesson.definition().sentences()).hasSize(2);
        assertThat(request(5098L, false, "GET", USER + "?keyword=What%20day%20is%20it%20today%3F", null).statusCode())
            .isEqualTo(200);
        importer.scan();

        try (
            var oldTemplate = new XSSFWorkbook();
            var output = new ByteArrayOutputStream()
        ) {
            var metadata = oldTemplate.createSheet("Bài nghe");
            writeWorkbookRow(
                metadata.createRow(0), "Tên bài nghe", "Chủ đề", "Trình độ", "Link YouTube", "Thời lượng (giây)", "Mô tả"
            );
            writeWorkbookRow(metadata.createRow(1), title, "Daily English Conversation", "A1", url, "92.0", "Mô tả cũ");
            var transcript = oldTemplate.createSheet("Transcript");
            writeWorkbookRow(transcript.createRow(0), "Thứ tự", "Transcript", "Bắt đầu", "Kết thúc");
            writeWorkbookRow(transcript.createRow(1), "1", "Thank you for joining us today.", "00:00", "00:04");
            writeWorkbookRow(transcript.createRow(2), "2", "We will begin in a moment.", "00:04", "00:08");
            oldTemplate.write(output);
            assertThat(workbooks.parse(xlsx(output.toByteArray())).sentences()).hasSize(2);
            Files.write(inbox.resolve("renamed.xlsx"), output.toByteArray());
        }
        service.visibility(id, true);
        workbookImporter(inbox).scan();
        // Assert
        assertThat(service.catalog(5098, title, "", "", 0, 12, false).items()).isEmpty();
        assertThat(service.catalog(0, title, "", "", 0, 12, true).items()).extracting(Item::id).containsExactly(id);
        assertThat(service.adminDetail(id).archived()).isTrue();
    }

    @Test
    void scan_whenWorkbookIsCorrectedAfterFailure_shouldRetryImportAndPublish(@TempDir Path inbox) throws Exception {
        // Arrange
        String keyword = "VPS workbook validation";
        String url = "https://www.youtube.com/watch?v=_R7nrvhNmrI";
        Files.write(inbox.resolve("bad-link.xlsx"), lessonWorkbook(keyword + " bad link", "https://example.org/a", "92"));
        Files.write(inbox.resolve("bad-number.xlsx"), lessonWorkbook(keyword + " bad number", url, "12 seconds"));
        Files.write(inbox.resolve("bad-clock.xlsx"), lessonWorkbook(keyword + " bad clock", url, "1:60"));
        Files.write(inbox.resolve("bad-duration.xlsx"), lessonWorkbook(keyword + " bad duration", url, "0"));
        Files.write(inbox.resolve("bad-timing.xlsx"), lessonWorkbook(keyword + " bad timing", url, "3"));
        Files.write(inbox.resolve("blank-title.xlsx"), lessonWorkbook("", url, "92"));
        // Act
        byte[] missingTopic = lessonWorkbook(keyword + " missing topic", "", "B1", url, "92");
        Files.write(inbox.resolve("missing-topic.xlsx"), missingTopic);
        assertThatThrownBy(() -> workbooks.parseLesson(missingTopic)).hasMessageContaining("Chưa điền mục “Chủ đề”");
        byte[] invalidLevel = lessonWorkbook(keyword + " bad level", "Daily English Conversation", "B3", url, "92");
        Files.write(inbox.resolve("bad-level.xlsx"), invalidLevel);
        assertThatThrownBy(() -> workbooks.parseLesson(invalidLevel)).hasMessageContaining("Trình độ phải là");
        var manualImport = workbooks.parse(xlsx(invalidLevel));
        assertThat(manualImport.errors()).isEmpty();
        assertThat(manualImport.sentences()).hasSize(2);
        Files.write(inbox.resolve("large.xlsx"), new byte[5 * 1024 * 1024 + 1]);
        Files.write(inbox.resolve("empty.xlsx"), new byte[0]);
        Files.writeString(inbox.resolve("partially-copied.xlsx"), "unfinished");
        Files.write(inbox.resolve("valid.xlsx"), lessonWorkbook(keyword + " valid", url, "92,0"));
        var importer = workbookImporter(inbox);
        importer.scan();
        assertThat(service.catalog(5099, keyword, "", "", 0, 12, true).items())
            .extracting(Item::title).containsExactly(keyword + " valid");

        Files.write(inbox.resolve("partially-copied.xlsx"), lessonWorkbook(keyword + " corrected", url, "92"));
        importer.scan();
        // Assert
        assertThat(service.catalog(5099, keyword, "", "", 0, 12, false).items())
            .extracting(Item::title).containsExactlyInAnyOrder(keyword + " valid", keyword + " corrected");
    }

    @Test
    void s3PublishesLaterPagesRetriesFailedDownloadsAndRecognizesVpsImports(@TempDir Path inbox) throws Exception {
        String keyword = "S3 workbook import";
        String url = "https://www.youtube.com/watch?v=_R7nrvhNmrI";
        byte[] duplicate = lessonWorkbook(keyword + " from VPS", url, "01:32");
        byte[] cloudOnly = lessonWorkbook(keyword + " from cloud", url, "01:32");
        Files.write(inbox.resolve("vps.xlsx"), duplicate);
        var importer = workbookImporter(inbox);
        importer.scan();

        String duplicateKey = "documents/transcripts/vps-copy.xlsx";
        String cloudKey = "documents/transcripts/daily/cloud.XLSX";
        String invalidKey = "documents/transcripts/invalid.xlsx";
        String firstPage = """
            <ListBucketResult>
              <IsTruncated>true</IsTruncated>
              <NextContinuationToken>page-two</NextContinuationToken>
              %s
            </ListBucketResult>
            """.formatted(
                s3WorkbookObject(duplicateKey, duplicate.length)
                    + s3WorkbookObject("documents/transcripts/~$editing.xlsx", duplicate.length)
                    + s3WorkbookObject("documents/transcripts/big.xlsx", 6 * 1024 * 1024)
                    + s3WorkbookObject("documents/transcripts/_admin/workbook.xlsx", duplicate.length)
            );
        String secondPage = """
            <ListBucketResult>
              <IsTruncated>false</IsTruncated>
              %s
            </ListBucketResult>
            """.formatted(s3WorkbookObject(cloudKey, cloudOnly.length) + s3WorkbookObject(invalidKey, 1));
        var listings = new CopyOnWriteArrayList<String>();
        var downloads = new ConcurrentHashMap<String, Integer>();
        var s3Server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        s3Server.createContext("/dictation-test", exchange -> {
            try (exchange) {
                String query = exchange.getRequestURI().getQuery();
                if (query != null && query.contains("list-type=2")) {
                    listings.add(query);
                    exchange.getResponseHeaders().set("Content-Type", "application/xml");
                    String page = query.contains("continuation-token=page-two") ? secondPage : firstPage;
                    byte[] body = page.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, body.length);
                    exchange.getResponseBody().write(body);
                    return;
                }

                String key = exchange.getRequestURI().getPath().substring("/dictation-test/".length());
                int requests = downloads.merge(key, 1, Integer::sum);
                if (!"\"workbook\"".equals(exchange.getRequestHeaders().getFirst("If-Match"))) {
                    exchange.sendResponseHeaders(412, -1);
                    return;
                }
                if (key.equals(cloudKey) && requests == 1) {
                    exchange.sendResponseHeaders(403, -1);
                    return;
                }
                byte[] body = switch (key) {
                    case String name when name.equals(duplicateKey) -> duplicate;
                    case String name when name.equals(cloudKey) -> cloudOnly;
                    default -> new byte[] {0};
                };
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            }
        });
        s3Server.start();
        try (S3Client s3 = S3Client.builder()
            .region(Region.US_EAST_1)
            .endpointOverride(URI.create("http://127.0.0.1:" + s3Server.getAddress().getPort()))
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
            .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("test-key", "test-secret")))
            .build()) {
            var reader = new DictationS3WorkbookImporter(importer, s3, "dictation-test", "documents/transcripts");
            reader.scan();
            assertThat(service.catalog(5099, keyword, "", "", 0, 12, false).items())
                .extracting(Item::title).containsExactly(keyword + " from VPS");

            reader.scan();
            reader.scan();

            assertThat(listings).hasSize(6).allSatisfy(query -> assertThat(query).contains("prefix=documents/transcripts/"));
            assertThat(downloads).containsExactlyInAnyOrderEntriesOf(Map.of(duplicateKey, 1, cloudKey, 2, invalidKey, 1));
            assertThat(service.catalog(5099, keyword, "A1", "Daily English Conversation", 0, 12, false).items())
                .extracting(Item::title).containsExactlyInAnyOrder(keyword + " from VPS", keyword + " from cloud");
        } finally {
            s3Server.stop(0);
        }
    }

    private static String s3WorkbookObject(String key, int bytes) {
        return s3WorkbookObject(key, bytes, "\"workbook\"");
    }

    private static String s3WorkbookObject(String key, int bytes, String eTag) {
        return """
            <Contents>
              <Key>%s</Key><Size>%d</Size><ETag>%s</ETag>
              <LastModified>2025-01-01T00:00:00Z</LastModified>
            </Contents>
            """.formatted(key, bytes, eTag);
    }

    @Test
    void s3SyncsAdminEditsAndCloudEditsThroughOneWorkbookPerLesson(@TempDir Path local) throws Exception {
        String keyword = "S3 single file sync";
        String url = "https://www.youtube.com/watch?v=_R7nrvhNmrI";
        String importedKey = "documents/transcripts/s3-single-file-lesson.xlsx";
        var bucket = new ConcurrentHashMap<String, byte[]>();
        var etags = new ConcurrentHashMap<String, String>();
        var seq = new java.util.concurrent.atomic.AtomicInteger(1);
        bucket.put(importedKey, lessonWorkbook(keyword + " initial", "US UK songs", "B1", url, "01:32"));
        etags.put(importedKey, "\"etag-" + seq.getAndIncrement() + "\"");

        var s3Server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        s3Server.createContext("/dictation-sync", exchange -> {
            try (exchange) {
                String query = exchange.getRequestURI().getQuery();
                if (query != null && query.contains("list-type=2")) {
                    String contents = bucket.entrySet().stream()
                        .sorted(Map.Entry.comparingByKey())
                        .map(e -> s3WorkbookObject(e.getKey(), e.getValue().length, etags.get(e.getKey())))
                        .collect(java.util.stream.Collectors.joining());
                    String xml = "<ListBucketResult><IsTruncated>false</IsTruncated>" + contents + "</ListBucketResult>";
                    byte[] body = xml.getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "application/xml");
                    exchange.sendResponseHeaders(200, body.length);
                    exchange.getResponseBody().write(body);
                    return;
                }
                String key = exchange.getRequestURI().getPath().substring("/dictation-sync/".length());
                switch (exchange.getRequestMethod()) {
                    case "PUT" -> {
                        bucket.put(key, exchange.getRequestBody().readAllBytes());
                        etags.put(key, "\"etag-" + seq.getAndIncrement() + "\"");
                        exchange.sendResponseHeaders(200, -1);
                    }
                    case "GET" -> {
                        byte[] body = bucket.get(key);
                        if (body == null) {
                            exchange.sendResponseHeaders(404, -1);
                            return;
                        }
                        exchange.getResponseHeaders().set("ETag", etags.get(key));
                        exchange.sendResponseHeaders(200, body.length);
                        exchange.getResponseBody().write(body);
                    }
                    case "DELETE" -> {
                        bucket.remove(key);
                        etags.remove(key);
                        exchange.sendResponseHeaders(204, -1);
                    }
                    default -> exchange.sendResponseHeaders(405, -1);
                }
            }
        });
        s3Server.start();
        try (S3Client s3 = S3Client.builder()
            .region(Region.US_EAST_1)
            .endpointOverride(URI.create("http://127.0.0.1:" + s3Server.getAddress().getPort()))
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).chunkedEncodingEnabled(false).build())
            .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("test-key", "test-secret")))
            .build()) {
            var provider = new org.springframework.beans.factory.support.StaticListableBeanFactory(Map.of("s3", s3))
                .getBeanProvider(S3Client.class);
            var s3Storage = new DictationWorkbookStorage(
                provider, "s3", local.toString(), "dictation-sync", "documents/transcripts/"
            );
            var s3Sync = new DictationWorkbookSync(jdbc, transactions, json, workbooks, s3Storage);
            var s3Admin = new DictationAdminPublication(service, s3Sync);
            var importer = new DictationWorkbookImporter(
                workbooks, service, validator, jdbc, json, transactions, ""
            );
            var reader = new DictationS3WorkbookImporter(importer, s3, "dictation-sync", "documents/transcripts/");

            // 1. Cloud file is imported and visible to learners and admin.
            reader.scan();
            var catalog = service.catalog(5120, keyword, "", "", 0, 12, false);
            assertThat(catalog.items()).hasSize(1);
            String importedId = catalog.items().getFirst().id();
            var attempt = start(5120, importedId);

            // 2. Admin edits and publishes -> overwrites the SAME S3 key (no _admin/ file created).
            var adminEdited = new Definition(
                keyword + " edited in admin", "", "US UK songs", "B2", null,
                List.of(new Sentence("Updated in admin.", 1.0, 5.0)),
                new Video(url, 92.0)
            );
            s3Admin.publish(importedId, new PublishRequest(1, adminEdited));
            assertThat(bucket.keySet()).containsExactly(importedKey);
            assertThat(workbooks.parseLesson(bucket.get(importedKey))).isEqualTo(adminEdited);
            assertThat(workbooks.parseLesson(s3Admin.download(importedId))).isEqualTo(adminEdited);

            // 3. Re-scanning the updated S3 object recognizes the digest and creates no duplicate.
            reader.scan();
            assertThat(service.catalog(0, keyword, "", "", 0, 12, true).items()).hasSize(1);

            // 4. Direct edit to the same S3 file updates the existing lesson and preserves old attempts.
            bucket.put(importedKey, lessonWorkbook(keyword + " edited on S3", "US UK songs", "C1", url, "01:32"));
            etags.put(importedKey, "\"etag-" + seq.getAndIncrement() + "\"");
            reader.scan();
            var afterCloudEdit = service.catalog(5121, keyword, "", "", 0, 12, false).items();
            assertThat(afterCloudEdit).hasSize(1);
            assertThat(afterCloudEdit.getFirst().id()).isEqualTo(importedId);
            assertThat(afterCloudEdit.getFirst().title()).isEqualTo(keyword + " edited on S3");
            assertThat(afterCloudEdit.getFirst().level()).isEqualTo("C1");
            assertThat(service.attempt(5120, attempt.id()).title()).isEqualTo(keyword + " initial");

            // 5. Admin creates a brand-new lesson -> writes one readable key directly in documents/transcripts/.
            var brandNew = new Definition(
                keyword + " brand new", "", "US UK songs", "A2", null,
                List.of(new Sentence("Created in admin.", 0.0, 4.0)),
                new Video(url, 60.0)
            );
            String createdId = s3Admin.publish(null, new PublishRequest(0, brandNew)).id();
            assertThat(bucket.keySet()).hasSize(2).noneMatch(k -> k.contains("_admin/"));
            String createdKey = bucket.keySet().stream().filter(k -> !k.equals(importedKey)).findFirst().orElseThrow();
            assertThat(createdKey).startsWith("documents/transcripts/s3-single-file-sync-brand-new-").endsWith(".xlsx");
            reader.scan();
            assertThat(service.catalog(0, keyword, "", "", 0, 12, true).items()).hasSize(2);

            // 6. Hiding removes the file from S3 and catalog; unhiding restores the exact same S3 key.
            s3Admin.visibility(importedId, true);
            assertThat(bucket).doesNotContainKey(importedKey);
            assertThat(service.catalog(5121, keyword, "", "", 0, 12, false).items())
                .extracting(Item::id).containsExactly(createdId);
            // Editing an archived S3 file updates its revision while keeping it archived until unhidden.
            bucket.put(importedKey, lessonWorkbook(keyword + " edited while hidden", "US UK songs", "C2", url, "01:32"));
            etags.put(importedKey, "\"etag-" + seq.getAndIncrement() + "\"");
            reader.scan();
            assertThat(service.adminDetail(importedId).archived()).isTrue();
            assertThat(service.adminDetail(importedId).definition().title()).isEqualTo(keyword + " edited while hidden");

            s3Admin.visibility(importedId, false);
            assertThat(bucket).containsKey(importedKey);
            assertThat(workbooks.parseLesson(bucket.get(importedKey)).title()).isEqualTo(keyword + " edited while hidden");
            assertThat(service.catalog(5121, keyword, "", "", 0, 12, false).items())
                .extracting(Item::id).containsExactlyInAnyOrder(importedId, createdId);

            // 7. Non-YouTube cloud video syncs via fallback digest and transient S3 failures retry cleanly.
            var mp4 = new Definition(
                keyword + " mp4", "", "US UK songs", "A1", null,
                List.of(new Sentence("Direct video.", 0.0, 3.0)),
                new Video("https://media.example.test/videos/clip.mp4", 40.0)
            );
            String mp4Id = s3Admin.publish(null, new PublishRequest(0, mp4)).id();
            assertThat(s3Admin.download(mp4Id)).isNotEmpty();

            s3Server.stop(0);
            var failedAttempt = new Definition(
                keyword + " retry", "", "US UK songs", "A1", null,
                List.of(new Sentence("Retry sync.", 0.0, 3.0)),
                new Video(url, 40.0)
            );
            String retryId = s3Admin.publish(null, new PublishRequest(0, failedAttempt)).id();
            assertThat(s3Admin.download(retryId)).isNotEmpty();
        } finally {
            s3Server.stop(0);
        }
    }

    @Test
    void inboxRejectsOversizedTitlesHandlesMissingDirsAndPropagatesLocalEdits(@TempDir Path inbox) throws Exception {
        var missingDirImporter = workbookImporter(inbox.resolve("missing-dir"));
        missingDirImporter.scan();

        String longTitle = "A".repeat(181);
        Files.write(inbox.resolve("too-long.xlsx"), lessonWorkbook(longTitle, "https://www.youtube.com/watch?v=_R7nrvhNmrI", "01:32"));
        var importer = new DictationWorkbookImporter(
            workbooks, service, validator, jdbc, json, transactions,
            new org.springframework.beans.factory.support.StaticListableBeanFactory(Map.of("sync", workbookSync))
                .getBeanProvider(DictationWorkbookSync.class),
            inbox.toString()
        );
        importer.scan();
        assertThat(service.catalog(0, longTitle, "", "", 0, 12, true).items()).isEmpty();

        String url = "https://www.youtube.com/watch?v=_R7nrvhNmrI";
        Path localFile = inbox.resolve("local-sync-lesson.xlsx");
        Files.write(localFile, lessonWorkbook("Local sync v1", url, "01:32"));
        importer.scan();
        String id = service.catalog(0, "Local sync v1", "", "", 0, 12, true).items().getFirst().id();
        Files.setLastModifiedTime(localFile, java.nio.file.attribute.FileTime.fromMillis(System.currentTimeMillis() + 5000));
        Files.write(localFile, lessonWorkbook("Local sync v2", url, "01:32"));
        Files.setLastModifiedTime(localFile, java.nio.file.attribute.FileTime.fromMillis(System.currentTimeMillis() + 10000));
        importer.scan();
        assertThat(service.adminDetail(id).definition().title()).isEqualTo("Local sync v2");
    }

    @Test
    void scan_whenInboxScansAreConcurrent_shouldPublishOneLesson(@TempDir Path inbox) throws Exception {
        // Arrange
        String title = "VPS workbook concurrent import";
        Files.write(
            inbox.resolve("conversation.xlsx"),
            lessonWorkbook(title, "https://www.youtube.com/watch?v=_R7nrvhNmrI", "92")
        );
        // Act
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(workbookImporter(inbox)::scan);
            var second = executor.submit(workbookImporter(inbox)::scan);
            first.get();
            second.get();
        }
        var items = service.catalog(0, title, "", "", 0, 12, true).items();
        // Assert
        assertThat(items).hasSize(1);
        assertThat(jdbc.queryForList(
            "SELECT exercise_id FROM dictation_workbook_imports WHERE exercise_id=?", String.class, items.getFirst().id()
        )).containsExactly(items.getFirst().id());
    }

    @Test
    void importWorkbook_whenWorkbookHasFormulasOrUnknownLayout_shouldReportRowErrors() throws Exception {
        // Arrange
        // Act

        try (
            var workbook = new XSSFWorkbook(new ByteArrayInputStream(workbooks.template()));
            var output = new java.io.ByteArrayOutputStream()
        ) {
            var row = workbook.getSheet("Transcript").getRow(TEMPLATE_FIRST_SENTENCE_ROW);
            row.getCell(0).setCellValue("3");
            row.getCell(1).setCellValue("Hello.");
            row.getCell(2).setCellValue("2 seconds");
            workbook.write(output);
            var result = workbooks.parse(xlsx(output.toByteArray()));
            // Assert
            assertThat(result.errors())
                .hasSize(2)
                .allSatisfy(error -> assertThat(error.row()).isEqualTo(TEMPLATE_FIRST_SENTENCE_ROW + 1));
        }
        try (
            var workbook = new XSSFWorkbook(new ByteArrayInputStream(workbooks.template()));
            var output = new java.io.ByteArrayOutputStream()
        ) {
            workbook.getSheet("Transcript").getRow(TEMPLATE_FIRST_SENTENCE_ROW).getCell(1).setCellFormula("1+1");
            workbook.write(output);
            assertThatThrownBy(() -> workbooks.parse(xlsx(output.toByteArray()))).isInstanceOf(
                com.elearning.learning.common.exception.DictationValidationException.class
            );
        }
    }

    @Test
    void history_whenGuest_shouldRequireAuthentication() throws Exception {
        // Arrange
        String path = USER + "/attempts";

        // Act
        var response = request(null, false, "GET", path, null);

        // Assert
        assertThat(response.statusCode()).isEqualTo(401);
    }

    @Test
    void handleRequest_whenDictationRoutesReceiveForbiddenOrInvalidCalls_shouldEnforceRoleAndServeAuthorizedAudio() throws Exception {
        // Arrange
        // Act
        assertThat(request(null, false, "GET", USER, null).statusCode()).isEqualTo(200);
        assertThat(request(null, false, "GET", USER + "/topic-groups", null).statusCode()).isEqualTo(200);
        for (String path : List.of(ADMIN, ADMIN + "/template", ADMIN + "/audio/" + sampleAudioKey))
            assertThat(request(5010L, false, "GET", path, null).statusCode()).isEqualTo(403);
        var template = request(5010L, true, "GET", ADMIN + "/template", null);
        assertThat(template.statusCode()).isEqualTo(200);
        assertThat(template.headers().firstValue("Content-Disposition"))
            .contains("attachment; filename=transcript-template.xlsx");
        assertThat(template.body()).isEqualTo(workbooks.template());
        assertThat(
            request(
                5010L,
                false,
                "POST",
                ADMIN,
                json.writeValueAsString(new SaveRequest(service.adminDetail(sampleId).definition(), 0))
            ).statusCode()
        ).isEqualTo(403);
        var attempt = start(5010, sampleId);
        assertThat(
            request(
                5010L,
                false,
                "POST",
                USER + "/attempts/" + attempt.id() + "/check",
                "{\"index\":999,\"text\":\"x\"}"
            ).statusCode()
        ).isEqualTo(400);
        var bytes = request(5010L, false, "GET", USER + "/attempts/" + attempt.id() + "/audio", null);
        // Assert
        assertThat(bytes.statusCode()).isEqualTo(200);
        assertThat(bytes.body()).isEqualTo(silentMp3());
        assertThat(bytes.headers().firstValue("content-type")).hasValue("audio/mpeg");
    }

    @Test
    void upload_whenMp3IsValidOrInvalid_shouldStoreValidAudioOutsideSourceAndRejectInvalidInput() throws Exception {
        // Arrange
        byte[] bytes = silentMp3();
        // Act
        var uploaded = audio.upload(new MockMultipartFile("file", "picnic.mp3", "audio/mpeg", bytes));
        try {
            assertThat(uploaded.duration()).isBetween(31.0, 32.0);
            assertThat(audio.resource(uploaded.key()).contentLength()).isEqualTo(bytes.length);
        } finally {
            jdbc.update("DELETE FROM dictation_audio WHERE audio_key=?", uploaded.key());
            Files.deleteIfExists(Path.of("./target/dictation-test-uploads").resolve(uploaded.key()));
        }
        // Assert
        assertThatThrownBy(() ->
            audio.upload(
                new MockMultipartFile(
                    "file",
                    "fake.mp3",
                    "audio/mpeg",
                    "not audio".getBytes(StandardCharsets.UTF_8)
                )
            )
        ).isInstanceOf(com.elearning.learning.common.exception.DictationValidationException.class);
    }

    private static byte[] silentMp3() {
        // MPEG-1 Layer III mono frames at 64 kbps and 48 kHz, with silent payloads.
        byte[] frame = new byte[192];
        frame[0] = (byte) 0xff;
        frame[1] = (byte) 0xfb;
        frame[2] = 0x54;
        frame[3] = (byte) 0xc0;
        byte[] audio = new byte[frame.length * 1312];
        for (int offset = 0; offset < audio.length; offset += frame.length) {
            System.arraycopy(frame, 0, audio, offset, frame.length);
        }
        return audio;
    }

    private AdminDetail create(String title, List<Sentence> sentences) {
        return service.save(
            null,
            new SaveRequest(
                new Definition(title, "", "Workplace", "B1", sampleAudioKey, sentences),
                0
            )
        );
    }

    private Attempt start(long user, String exercise) {
        return service.start(user, exercise, new StartRequest(UUID.randomUUID().toString(), false));
    }

    private DictationWorkbookImporter workbookImporter(Path directory) {
        return new DictationWorkbookImporter(workbooks, service, validator, jdbc, json, transactions, directory.toString());
    }

    private byte[] lessonWorkbook(String title, String url, String duration) throws Exception {
        return lessonWorkbook(title, "Daily English Conversation", "a1", url, duration);
    }

    private byte[] lessonWorkbook(String title, String topic, String level, String url, String duration) throws Exception {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(workbooks.template()));
             var output = new ByteArrayOutputStream()) {
            String[] values = { title, topic, level, url, duration };
            var sheet = workbook.getSheet("Transcript");
            for (int field = 0; field < values.length; field++) {
                sheet.getRow(field + 1).getCell(1).setCellValue(values[field]);
            }
            workbook.write(output);
            return output.toByteArray();
        }
    }

    private void writeWorkbookRow(Row row, String... values) {
        for (int index = 0; index < values.length; index++) row.createCell(index).setCellValue(values[index]);
    }

    private MockMultipartFile xlsx(byte[] bytes) {
        return new MockMultipartFile(
            "file",
            "transcript.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            bytes
        );
    }

    private HttpResponse<byte[]> request(Long user, boolean admin, String method, String path, String body)
        throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (user != null) builder.header(
            "Authorization",
            "Bearer " +
                Jwts.builder()
                    .subject(user.toString())
                    .issuer("sgedu")
                    .claim("tokenType", "access")
                    .claim("role", admin ? "ADMIN" : "USER")
                    .claim("roles", List.of(admin ? "ADMIN" : "USER"))
                    .claim("permissions", List.of())
                    .issuedAt(Date.from(Instant.now()))
                    .expiration(Date.from(Instant.now().plusSeconds(600)))
                    .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                    .compact()
        );
        builder.header("Content-Type", "application/json");
        return http.send(
            builder
                .method(
                    method,
                    body == null
                        ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(body)
                )
                .build(),
            HttpResponse.BodyHandlers.ofByteArray()
        );
    }
}
