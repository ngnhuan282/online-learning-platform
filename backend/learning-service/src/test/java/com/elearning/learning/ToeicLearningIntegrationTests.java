package com.elearning.learning;

import static org.assertj.core.api.Assertions.assertThat;

import com.elearning.learning.dto.ToeicModels.Definition;
import com.elearning.learning.service.ToeicService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "toeic.seed.enabled=false",
        "logging.level.root=WARN",
        "logging.level.org.springframework=WARN",
    }
)
@ActiveProfiles("test")
class ToeicLearningIntegrationTests {

    private static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();
    private static final String BASE = "/api/v1/learning/toeic";
    private static final String ADMIN = "/api/v1/learning/admin/toeic/exams";
    private static final AtomicLong USERS = new AtomicLong(920000);

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
        registry.add("security.jwt.issuer", () -> "sgedu");
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:toeicLearning;MODE=MySQL;DB_CLOSE_DELAY=-1");
        String mysql = System.getenv("LEARNING_FLOW_TEST_MYSQL_URL");
        if (mysql != null && !mysql.isBlank()) {
            registry.add("spring.datasource.url", () -> mysql);
            registry.add("spring.datasource.username", () -> System.getenv("LEARNING_FLOW_TEST_MYSQL_USER"));
            registry.add("spring.datasource.password", () ->
                System.getenv("LEARNING_FLOW_TEST_MYSQL_PASSWORD")
            );
            registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
            registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
            registry.add("spring.flyway.placeholders.notificationCheckKeyword", () -> "CHECK");
            registry.add(
                "spring.flyway.placeholders.notificationEventKeyCollation",
                () -> "CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"
            );
        }
    }

    @TestConfiguration
    static class TimeConfig {

        @Bean
        @Primary
        MutableClock toeicTestClock() {
            return new MutableClock();
        }
    }

    static final class MutableClock extends Clock {

        private final AtomicReference<Instant> now = new AtomicReference<>(Instant.now());

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now.get();
        }

        void set(Instant value) {
            now.set(value);
        }
    }

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper mapper;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    MutableClock clock;

    @Autowired
    ToeicService toeic;

    private final HttpClient client = HttpClient.newHttpClient();

    @BeforeEach
    void resetClock() {
        clock.set(Instant.now());
    }

    private String token(long user, String role) {
        return Jwts.builder()
            .subject(Long.toString(user))
            .issuer("sgedu")
            .claim("role", role)
            .claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(1)))
            .expiration(Date.from(Instant.now().plusSeconds(300)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();
    }

    private HttpResponse<String> send(String method, String path, Long user, String role, Object body)
        throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).timeout(
            Duration.ofSeconds(20)
        );
        if (user != null) request.header("Authorization", "Bearer " + token(user, role));
        if (body != null) request.header("Content-Type", "application/json");
        request.method(
            method,
            body == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(
                      body instanceof String text ? text : mapper.writeValueAsString(body)
                  )
        );
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> learner(String method, String suffix, long user, Object body)
        throws Exception {
        return send(method, BASE + suffix, user, "USER", body);
    }

    private JsonNode data(HttpResponse<String> response, int status) throws Exception {
        assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(status);
        return mapper.readTree(response.body()).get("data");
    }

    private Map<String, Object> definition(boolean published) {
        String suffix = UUID.randomUUID().toString();
        return Map.of(
            "slug",
            "toeic-test-" + suffix,
            "title",
            "Reading " + suffix,
            "description",
            "Native reading",
            "durationMinutes",
            1,
            "sourceLabel",
            "Controlled test content",
            "published",
            published,
            "lessons",
            List.of(
                Map.of(
                    "id",
                    "part-5",
                    "title",
                    "Word forms",
                    "content",
                    "Read the sentence and identify the required word form."
                )
            ),
            "questions",
            List.of(
                question("q101", 101, 5, "A"),
                question("q131", 131, 6, "B"),
                question("q147", 147, 7, "C")
            )
        );
    }

    private Map<String, Object> question(String id, int number, int part, String correct) {
        return Map.of(
            "id",
            id,
            "number",
            number,
            "part",
            part,
            "prompt",
            "Choose the correct word.",
            "passage",
            "A short passage for this controlled integration test.",
            "options",
            List.of(
                Map.of("id", "A", "text", "first"),
                Map.of("id", "B", "text", "second"),
                Map.of("id", "C", "text", "third"),
                Map.of("id", "D", "text", "fourth")
            ),
            "correctOptionId",
            correct,
            "explanation",
            "The grammatical context determines this answer."
        );
    }

    private JsonNode create(boolean published) throws Exception {
        return data(send("POST", ADMIN, 1L, "ADMIN", definition(published)), 201);
    }

    @Test
    void catalogIsPublicWhileLearningAndAdministrationRequireTheCorrectIdentity() throws Exception {
        JsonNode exam = create(true);
        long id = exam.get("id").asLong();
        JsonNode catalog = data(send("GET", BASE + "/exams", null, null, null), 200);
        assertThat(catalog.toString()).contains(exam.get("title").asText());
        assertThat(catalog.toString()).doesNotContain("correctOptionId", "explanation");
        assertThat(send("GET", BASE + "/exams/" + id, null, null, null).statusCode()).isEqualTo(401);
        assertThat(send("GET", ADMIN, 22L, "USER", null).statusCode()).isEqualTo(403);
        assertThat(send("POST", ADMIN, 22L, "USER", definition(false)).statusCode()).isEqualTo(403);
        JsonNode detail = data(learner("GET", "/exams/" + id, 22, null), 200);
        assertThat(detail.get("lessons").size()).isEqualTo(1);
        assertThat(detail.get("questions").size()).isEqualTo(3);
        for (JsonNode question : detail.get("questions")) {
            assertThat(question.has("correctOptionId")).isFalse();
            assertThat(question.has("explanation")).isFalse();
        }
        assertThat(learner("GET", "/exams/" + id + "/progress", 22, null).statusCode()).isEqualTo(200);
    }

    @Test
    void seededListeningPlaysEveryPartAndRevealsTranscriptWhenPermitted() throws Exception {
        long user = USERS.incrementAndGet();
        try (var input = new ClassPathResource("toeic/ets2024-listening.json").getInputStream()) {
            List<Definition> definitions = mapper.readValue(input, new TypeReference<List<Definition>>() {});
            assertThat(definitions).hasSize(9);
            for (Definition definition : definitions) toeic.seed(definition);
        }
        JsonNode catalogs = data(send("GET", BASE + "/exams", null, null, null), 200);
        List<JsonNode> listening = StreamSupport.stream(catalogs.spliterator(), false)
            .filter(item -> "LISTENING".equals(item.path("section").asText()))
            .filter(item -> item.path("slug").asText().startsWith("ets-2024-test-"))
            .toList();
        assertThat(listening).hasSize(9);
        JsonNode test = listening.getFirst();
        assertThat(test.path("questionCount").asInt()).isEqualTo(100);
        String exam = "/exams/" + test.path("id").asLong();
        JsonNode detail = data(learner("GET", exam, user, null), 200);
        assertThat(detail.path("questions").get(0).path("imageUrl").asText()).endsWith("question-001.webp");
        assertThat(detail.toString()).doesNotContain("\"transcript\"", "\"correctOptionId\"");
        int[] expectedCounts = { 6, 25, 39, 30 };
        for (int part = 1; part <= 4; part++) {
            JsonNode practice = data(
                learner("POST", exam + "/attempts", user, Map.of("mode", "PRACTICE", "part", part)),
                200
            );
            assertThat(practice.path("totalQuestions").asInt()).isEqualTo(expectedCounts[part - 1]);
            JsonNode first = practice.path("questions").get(0);
            assertThat(first.path("options").size()).isEqualTo(part == 2 ? 3 : 4);
            assertThat(first.path("correctOptionId").asText()).isNotBlank();
            assertThat(first.path("listening").path("transcript").asText()).isNotBlank();
            if (part >= 3) {
                assertThat(first.path("listening")).isEqualTo(
                    practice.path("questions").get(2).path("listening")
                );
                assertThat(first.path("listening")).isNotEqualTo(
                    practice.path("questions").get(3).path("listening")
                );
            }
        }
        JsonNode attempt = data(learner("POST", exam + "/attempts", user, Map.of("mode", "EXAM")), 200);
        String path = "/attempts/" + attempt.path("id").asLong();
        assertThat(attempt.path("durationMinutes").asInt()).isEqualTo(45);
        assertThat(attempt.path("totalQuestions").asInt()).isEqualTo(100);
        assertThat(attempt.path("questions").get(0).path("listening").path("audioUrl").asText()).endsWith(
            ".mp3"
        );
        assertThat(attempt.toString()).doesNotContain("\"transcript\"", "\"correctOptionId\"");
        assertThat(learner("GET", path, user + 1000, null).statusCode()).isEqualTo(404);
        assertThat(
            learner("PUT", path + "/answers", user, Map.of("answers", Map.of("q7", "D"))).statusCode()
        ).isEqualTo(400);
        var answers = Map.of("answers", Map.of("q1", "A", "q7", "B"));
        JsonNode saved = data(learner("PUT", path + "/answers", user, answers), 200);
        assertThat(saved.path("answers").path("q7").asText()).isEqualTo("B");
        assertThat(saved.toString()).doesNotContain("\"transcript\"", "\"correctOptionId\"");
        JsonNode graded = data(learner("POST", path + "/submit", user, answers), 200);
        assertThat(graded.path("correctCount").asInt()).isEqualTo(2);
        assertThat(graded.path("questions").get(0).path("correctOptionId").asText()).isEqualTo("A");
        assertThat(
            graded.path("questions").get(0).path("listening").path("transcript").asText()
        ).isNotBlank();
    }

    @Test
    void listeningDraftRequiresMediaAndMatchingGroupTranscriptToPublish() throws Exception {
        var draft = new LinkedHashMap<>(definition(false));
        var first = new LinkedHashMap<>(question("q32", 32, 3, "A"));
        var second = new LinkedHashMap<>(question("q33", 33, 3, "A"));
        draft.put("lessons", List.of());
        draft.put("questions", List.of(first, second));
        JsonNode created = data(send("POST", ADMIN, 1L, "ADMIN", draft), 201);
        String path = ADMIN + "/" + created.path("id").asLong();
        assertThat(
            send("PATCH", path + "/publish", 1L, "ADMIN", Map.of("published", true)).statusCode()
        ).isEqualTo(400);
        String clip = "/toeic-assets/test/audio-032-034.mp3";
        draft.put("version", created.path("version").asLong());
        first.put("listening", Map.of("audioUrl", clip, "transcript", "First transcript"));
        second.put("listening", Map.of("audioUrl", clip, "transcript", "Different transcript"));
        JsonNode updated = data(send("PUT", path, 1L, "ADMIN", draft), 200);
        assertThat(
            send("PATCH", path + "/publish", 1L, "ADMIN", Map.of("published", true)).statusCode()
        ).isEqualTo(400);
        draft.put("version", updated.path("version").asLong());
        second.put("listening", first.get("listening"));
        data(send("PUT", path, 1L, "ADMIN", draft), 200);
        JsonNode published = data(
            send("PATCH", path + "/publish", 1L, "ADMIN", Map.of("published", true)),
            200
        );
        assertThat(published.path("published").asBoolean()).isTrue();
    }

    @Test
    void lessonsAndAutosavedPracticeResumeAndGradeIdempotentlyWithPrivateHistory() throws Exception {
        long user = USERS.incrementAndGet();
        long examId = create(true).get("id").asLong();
        String completion = "/exams/" + examId + "/lessons/part-5/complete";
        JsonNode first = data(learner("PUT", completion, user, null), 200);
        JsonNode second = data(learner("PUT", completion, user, null), 200);
        assertThat(first.get("completedLessonIds").toString()).isEqualTo("[\"part-5\"]");
        assertThat(second.get("completedLessonIds")).isEqualTo(first.get("completedLessonIds"));
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM toeic_lesson_progress WHERE user_id = ? AND exam_id = ?",
                Integer.class,
                user,
                examId
            )
        ).isEqualTo(1);
        JsonNode start = data(
            learner("POST", "/exams/" + examId + "/attempts", user, Map.of("mode", "PRACTICE")),
            200
        );
        long attemptId = start.get("id").asLong();
        assertThat(start.get("totalQuestions").asInt()).isEqualTo(3);
        assertThat(start.get("part").isNull()).isTrue();
        assertThat(start.get("deadlineAt").isNull()).isTrue();
        JsonNode resumed = data(
            learner("POST", "/exams/" + examId + "/attempts", user, Map.of("mode", "PRACTICE")),
            200
        );
        assertThat(resumed.get("id").asLong()).isEqualTo(attemptId);
        Map<String, Object> answers = Map.of("answers", Map.of("q101", "A", "q131", "B", "q147", "A"));
        JsonNode saved = data(learner("PUT", "/attempts/" + attemptId + "/answers", user, answers), 200);
        assertThat(saved.get("answers").get("q101").asText()).isEqualTo("A");
        assertThat(saved.get("questions").get(0).get("correctOptionId").asText()).isEqualTo("A");
        assertThat(saved.get("questions").get(0).get("explanation").asText()).isNotBlank();
        JsonNode timedPractice = data(
            learner(
                "POST",
                "/exams/" + examId + "/attempts",
                user,
                Map.of("mode", "PRACTICE", "part", 5, "durationMinutes", 15)
            ),
            200
        );
        long timedPracticeId = timedPractice.get("id").asLong();
        assertThat(timedPractice.get("durationMinutes").asInt()).isEqualTo(15);
        assertThat(timedPractice.get("deadlineAt").isNull()).isFalse();
        JsonNode loaded = data(learner("GET", "/attempts/" + attemptId, user, null), 200);
        assertThat(loaded.get("answers")).isEqualTo(saved.get("answers"));
        assertThat(learner("GET", "/attempts/" + attemptId, user + 1000, null).statusCode()).isEqualTo(404);
        assertThat(
            learner("POST", "/attempts/" + attemptId + "/submit", user + 1000, answers).statusCode()
        ).isEqualTo(404);
        JsonNode graded = data(learner("POST", "/attempts/" + attemptId + "/submit", user, answers), 200);
        assertThat(graded.get("status").asText()).isEqualTo("GRADED");
        assertThat(graded.get("score").asInt()).isEqualTo(67);
        assertThat(graded.get("correctCount").asInt()).isEqualTo(2);
        assertThat(graded.get("questions").get(0).get("correctOptionId").asText()).isEqualTo("A");
        assertThat(graded.get("questions").get(0).get("explanation").asText()).isNotBlank();
        JsonNode retried = data(
            learner(
                "POST",
                "/attempts/" + attemptId + "/submit",
                user,
                Map.of("answers", Map.of("q101", "D"))
            ),
            200
        );
        assertThat(retried.get("answers")).isEqualTo(graded.get("answers"));
        assertThat(retried.get("submittedAt")).isEqualTo(graded.get("submittedAt"));
        assertThat(retried.get("score")).isEqualTo(graded.get("score"));
        JsonNode progress = data(learner("GET", "/exams/" + examId + "/progress", user, null), 200);
        List<JsonNode> history = StreamSupport.stream(progress.get("attempts").spliterator(), false).toList();
        assertThat(history).hasSize(2);
        assertThat(history)
            .filteredOn(item -> item.get("id").asLong() == attemptId)
            .singleElement()
            .satisfies(item -> {
                assertThat(item.get("status").asText()).isEqualTo("GRADED");
                assertThat(item.get("score").asInt()).isEqualTo(67);
            });
        assertThat(history)
            .filteredOn(item -> item.get("id").asLong() == timedPracticeId)
            .singleElement()
            .satisfies(item -> {
                assertThat(item.get("status").asText()).isEqualTo("IN_PROGRESS");
                assertThat(item.get("score").isNull()).isTrue();
            });
        assertThat(progress.get("activeAttemptId").asLong()).isEqualTo(timedPracticeId);
    }

    @Test
    void draftPublishEditDeletePreserveSnapshotsAndRejectStaleEdits() throws Exception {
        long user = USERS.incrementAndGet();
        JsonNode created = create(false);
        long examId = created.get("id").asLong();
        assertThat(learner("GET", "/exams/" + examId, user, null).statusCode()).isEqualTo(404);
        JsonNode published = data(
            send("PATCH", ADMIN + "/" + examId + "/publish", 1L, "ADMIN", Map.of("published", true)),
            200
        );
        JsonNode attempt = data(
            learner("POST", "/exams/" + examId + "/attempts", user, Map.of("mode", "PRACTICE", "part", 5)),
            200
        );
        long attemptId = attempt.get("id").asLong();
        assertThat(attempt.get("totalQuestions").asInt()).isEqualTo(1);
        assertThat(attempt.get("part").asInt()).isEqualTo(5);
        JsonNode practiceProgress = data(learner("GET", "/exams/" + examId + "/progress", user, null), 200);
        assertThat(practiceProgress.get("attempts").get(0).get("part").asInt()).isEqualTo(5);
        data(learner("PUT", "/exams/" + examId + "/lessons/part-5/complete", user, null), 200);
        Map<String, Object> edited = mapper.convertValue(
            published,
            new tools.jackson.core.type.TypeReference<Map<String, Object>>() {}
        );
        edited.put("title", "Updated title");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> questions = (List<Map<String, Object>>) edited.get("questions");
        questions.getFirst().put("correctOptionId", "D");
        JsonNode updated = data(send("PUT", ADMIN + "/" + examId, 1L, "ADMIN", edited), 200);
        assertThat(updated.get("title").asText()).isEqualTo("Updated title");
        assertThat(send("PUT", ADMIN + "/" + examId, 1L, "ADMIN", edited).statusCode()).isEqualTo(409);
        JsonNode resetProgress = data(learner("GET", "/exams/" + examId + "/progress", user, null), 200);
        assertThat(resetProgress.get("completedLessonIds").isEmpty()).isTrue();
        JsonNode result = data(
            learner(
                "POST",
                "/attempts/" + attemptId + "/submit",
                user,
                Map.of("answers", Map.of("q101", "A"))
            ),
            200
        );
        assertThat(result.get("title")).isEqualTo(attempt.get("title"));
        assertThat(result.get("part").asInt()).isEqualTo(5);
        assertThat(result.get("score").asInt()).isEqualTo(100);
        assertThat(send("DELETE", ADMIN + "/" + examId, 1L, "ADMIN", null).statusCode()).isEqualTo(204);
        assertThat(learner("GET", "/exams/" + examId, user, null).statusCode()).isEqualTo(404);
        assertThat(
            learner("POST", "/exams/" + examId + "/attempts", user, Map.of("mode", "EXAM")).statusCode()
        ).isEqualTo(404);
        assertThat(
            data(learner("GET", "/attempts/" + attemptId, user, null), 200)
                .get("score")
                .asInt()
        ).isEqualTo(100);
    }

    @Test
    void deadlineGradesOnlyPreviouslySavedAnswersAndNeverAcceptsLateChanges() throws Exception {
        long user = USERS.incrementAndGet();
        long examId = create(true).get("id").asLong();
        JsonNode exam = data(
            learner("POST", "/exams/" + examId + "/attempts", user, Map.of("mode", "EXAM")),
            200
        );
        assertThat(exam.get("questions").get(0).has("correctOptionId")).isFalse();
        assertThat(exam.get("questions").get(0).has("explanation")).isFalse();
        long id = exam.get("id").asLong();
        data(
            learner("PUT", "/attempts/" + id + "/answers", user, Map.of("answers", Map.of("q101", "A"))),
            200
        );
        clock.set(Instant.parse(exam.get("deadlineAt").asText()).plusSeconds(1));
        JsonNode late = data(
            learner(
                "POST",
                "/attempts/" + id + "/submit",
                user,
                Map.of("answers", Map.of("q101", "A", "q131", "B", "q147", "C"))
            ),
            200
        );
        assertThat(late.get("correctCount").asInt()).isEqualTo(1);
        assertThat(late.get("score").asInt()).isEqualTo(33);
        assertThat(late.get("answers").size()).isEqualTo(1);
        assertThat(late.get("submittedAt")).isEqualTo(exam.get("deadlineAt"));
        JsonNode another = data(
            learner("POST", "/exams/" + examId + "/attempts", user, Map.of("mode", "EXAM")),
            200
        );
        clock.set(Instant.parse(another.get("deadlineAt").asText()));
        assertThat(
            data(learner("GET", "/attempts/" + another.get("id").asLong(), user, null), 200)
                .get("status")
                .asText()
        ).isEqualTo("GRADED");
    }

    @Test
    void invalidAnswersPartsAndDefinitionsAreRejectedWithoutMutatingSavedAnswers() throws Exception {
        long user = USERS.incrementAndGet();
        long examId = create(true).get("id").asLong();
        assertThat(
            learner(
                "POST",
                "/exams/" + examId + "/attempts",
                user,
                Map.of("mode", "EXAM", "part", 5)
            ).statusCode()
        ).isEqualTo(400);
        assertThat(
            learner(
                "POST",
                "/exams/" + examId + "/attempts",
                user,
                Map.of("mode", "EXAM", "durationMinutes", 30)
            ).statusCode()
        ).isEqualTo(400);
        assertThat(
            learner(
                "POST",
                "/exams/" + examId + "/attempts",
                user,
                Map.of("mode", "PRACTICE", "durationMinutes", 0)
            ).statusCode()
        ).isEqualTo(400);
        Map<String, Object> lessonless = new java.util.HashMap<>(definition(true));
        lessonless.put("lessons", List.of());
        assertThat(send("POST", ADMIN, 1L, "ADMIN", lessonless).statusCode()).isEqualTo(201);
        assertThat(
            learner(
                "POST",
                "/exams/" + examId + "/attempts",
                user,
                Map.of("mode", "PRACTICE", "part", 4)
            ).statusCode()
        ).isEqualTo(400);
        JsonNode attempt = data(
            learner("POST", "/exams/" + examId + "/attempts", user, Map.of("mode", "PRACTICE")),
            200
        );
        long id = attempt.get("id").asLong();
        for (Map<String, String> wrong : List.of(Map.of("other", "A"), Map.of("q101", "Z"))) {
            assertThat(
                learner("PUT", "/attempts/" + id + "/answers", user, Map.of("answers", wrong)).statusCode()
            ).isEqualTo(400);
        }
        assertThat(
            data(learner("GET", "/attempts/" + id, user, null), 200)
                .get("answers")
                .isEmpty()
        ).isTrue();
        Map<String, Object> badDefinition = new java.util.HashMap<>(definition(true));
        badDefinition.put("questions", List.of(question("q101", 101, 5, "Z")));
        assertThat(send("POST", ADMIN, 1L, "ADMIN", badDefinition).statusCode()).isEqualTo(400);
        badDefinition.put("questions", List.of(question("q101", 101, 5, "A"), question("q101", 102, 5, "A")));
        assertThat(send("POST", ADMIN, 1L, "ADMIN", badDefinition).statusCode()).isEqualTo(400);
        Map<String, Object> draft = new java.util.HashMap<>(definition(false));
        draft.put("questions", List.of());
        long draftId = data(send("POST", ADMIN, 1L, "ADMIN", draft), 201)
            .get("id")
            .asLong();
        assertThat(
            send(
                "PATCH",
                ADMIN + "/" + draftId + "/publish",
                1L,
                "ADMIN",
                Map.of("published", true)
            ).statusCode()
        ).isEqualTo(400);
    }

    @Test
    void concurrentStartAndSubmitProduceOneActiveAttemptAndOneStableResult() throws Exception {
        long user = USERS.incrementAndGet();
        long examId = create(true).get("id").asLong();
        try (var executor = Executors.newFixedThreadPool(2)) {
            var ready = new CountDownLatch(1);
            var first = executor.submit(() -> {
                ready.await();
                return data(
                    learner("POST", "/exams/" + examId + "/attempts", user, Map.of("mode", "PRACTICE")),
                    200
                );
            });
            var second = executor.submit(() -> {
                ready.await();
                return data(
                    learner("POST", "/exams/" + examId + "/attempts", user, Map.of("mode", "PRACTICE")),
                    200
                );
            });
            ready.countDown();
            long id = first.get(20, TimeUnit.SECONDS).get("id").asLong();
            assertThat(second.get(20, TimeUnit.SECONDS).get("id").asLong()).isEqualTo(id);
            assertThat(
                jdbc.queryForObject(
                    "SELECT COUNT(*) FROM toeic_attempts WHERE user_id = ? AND exam_id = ?",
                    Integer.class,
                    user,
                    examId
                )
            ).isEqualTo(1);
            var submitFirst = executor.submit(() ->
                data(
                    learner(
                        "POST",
                        "/attempts/" + id + "/submit",
                        user,
                        Map.of("answers", Map.of("q101", "A"))
                    ),
                    200
                )
            );
            var submitSecond = executor.submit(() ->
                data(
                    learner(
                        "POST",
                        "/attempts/" + id + "/submit",
                        user,
                        Map.of("answers", Map.of("q101", "A"))
                    ),
                    200
                )
            );
            assertThat(submitFirst.get(20, TimeUnit.SECONDS).get("submittedAt")).isEqualTo(
                submitSecond.get(20, TimeUnit.SECONDS).get("submittedAt")
            );
        }
    }

    @Test
    void seedIsIdempotentAndDoesNotOverwriteAnEditedOrArchivedExam() throws Exception {
        Definition definition = mapper.convertValue(definition(true), Definition.class);
        toeic.seed(definition);
        toeic.seed(definition);
        long id = jdbc.queryForObject(
            "SELECT id FROM toeic_exams WHERE slug = ?",
            Long.class,
            definition.slug()
        );
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM toeic_exams WHERE slug = ?",
                Integer.class,
                definition.slug()
            )
        ).isEqualTo(1);
        toeic.delete(id);
        toeic.seed(definition);
        assertThat(
            jdbc.queryForObject("SELECT deleted FROM toeic_exams WHERE id = ?", Boolean.class, id)
        ).isTrue();
    }

    @Test
    void dictionaryIsPublicAndToeicNotesEnforceFreeHundredNoteLimitUntilProIsActive() throws Exception {
        JsonNode lookup = data(send("GET", BASE + "/dictionary?term=appointments", null, null, null), 200);
        assertThat(lookup.get("found").asBoolean()).isTrue();
        assertThat(lookup.get("headword").asText()).isEqualTo("appointment");

        long user = USERS.incrementAndGet();
        long examId = create(true).get("id").asLong();
        for (int i = 1; i <= 100; i++) {
            data(
                learner(
                    "POST",
                    "/notes",
                    user,
                    Map.of(
                        "examId",
                        examId,
                        "questionNumber",
                        101,
                        "part",
                        5,
                        "selectedText",
                        "term-" + i,
                        "noteContent",
                        "meaning " + i,
                        "color",
                        "yellow"
                    )
                ),
                201
            );
        }
        HttpResponse<String> blocked = learner(
            "POST",
            "/notes",
            user,
            Map.of("examId", examId, "selectedText", "term-101", "noteContent", "overflow")
        );
        assertThat(blocked.statusCode()).isEqualTo(409);
        assertThat(blocked.body()).contains("NOTE_LIMIT_REACHED");

        JsonNode listed = data(learner("GET", "/notes", user, null), 200);
        assertThat(listed.get("count").asInt()).isEqualTo(100);
        assertThat(listed.get("limit").asInt()).isEqualTo(100);
        long firstId = listed.get("items").get(0).get("id").asLong();

        JsonNode updated = data(
            learner(
                "PUT",
                "/notes/" + firstId,
                user,
                Map.of("noteContent", "updated meaning", "color", "blue")
            ),
            200
        );
        assertThat(updated.get("note").get("noteContent").asText()).isEqualTo("updated meaning");
        assertThat(updated.get("note").get("color").asText()).isEqualTo("blue");

        JsonNode afterDelete = data(learner("DELETE", "/notes/" + firstId, user, null), 200);
        assertThat(afterDelete.get("count").asInt()).isEqualTo(99);
    }
}
