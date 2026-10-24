package com.elearning.learning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

import com.elearning.learning.entity.Enrollment;
import com.elearning.learning.repository.EnrollmentRepository;
import com.elearning.learning.service.CourseCatalogClient;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = { "logging.level.root=WARN", "logging.level.org.springframework=WARN" }
)
@ActiveProfiles("test")
class C11QuizIntegrationTests {

    private static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();
    private static final String BASE = "/api/v1/learning";
    private static final String ADMIN = BASE + "/admin/quizzes";
    private static final long COURSE = 71001;
    private static final long LESSON = 7100101;
    private static final AtomicLong USERS = new AtomicLong(System.currentTimeMillis() + 50000);

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
        registry.add("security.jwt.issuer", () -> "sgedu");
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:c11Quiz;MODE=MySQL;DB_CLOSE_DELAY=-1");
        String mysql = System.getenv("LEARNING_FLOW_TEST_MYSQL_URL");
        if (mysql != null && !mysql.isBlank()) {
            registry.add("spring.datasource.url", () -> mysql);
            registry.add("spring.datasource.username", () -> System.getenv("LEARNING_FLOW_TEST_MYSQL_USER"));
            registry.add("spring.datasource.password", () -> System.getenv("LEARNING_FLOW_TEST_MYSQL_PASSWORD"));
            registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
            registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
            registry.add("spring.flyway.placeholders.notificationCheckKeyword", () -> "CHECK");
            registry.add("spring.flyway.placeholders.notificationEventKeyCollation",
                () -> "CHARACTER SET utf8mb4 COLLATE utf8mb4_bin");
        }
    }

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper mapper;

    @Autowired
    EnrollmentRepository enrollments;

    @Autowired
    JdbcTemplate jdbc;

    @MockitoBean
    CourseCatalogClient courses;

    private final HttpClient client = HttpClient.newHttpClient();

    @BeforeEach
    void curriculum() {
        when(courses.getCurriculum(COURSE)).thenReturn(new CourseCatalogClient.Curriculum(
            COURSE, "C11 course", List.of(new CourseCatalogClient.SectionReference(
                710010L, COURSE, "Section", 0, List.of(new CourseCatalogClient.LessonReference(
                    LESSON, 710010L, "Lesson", "TEXT", "Content", null, null, 0, false
                ))
            ))
        ));
    }

    private String token(long user, String role) {
        return Jwts.builder().subject(Long.toString(user)).issuer("sgedu")
            .claim("role", role).claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(1)))
            .expiration(Date.from(Instant.now().plusSeconds(120)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();
    }

    private HttpResponse<String> send(String method, String path, long user, String role, String body)
        throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
            .timeout(Duration.ofSeconds(15)).header("Authorization", "Bearer " + token(user, role));
        if (body != null) request.header("Content-Type", "application/json");
        request.method(method, body == null
            ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> learner(String method, String path, long user, String body) throws Exception {
        return send(method, BASE + path, user, "USER", body);
    }

    private JsonNode data(HttpResponse<String> response, int expectedStatus) throws Exception {
        assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(expectedStatus);
        return mapper.readTree(response.body()).get("data");
    }

    private long enrolledUser() {
        long user = USERS.incrementAndGet();
        Enrollment enrollment = new Enrollment();
        enrollment.setUserId(user);
        enrollment.setCourseId(COURSE);
        enrollments.saveAndFlush(enrollment);
        return user;
    }

    private String definition(String title, Long lessonId, Integer timeLimit) {
        return """
            {"courseId":%d,"lessonId":%s,"title":"%s","passingScore":67,"timeLimitMinutes":%s,
             "questions":[
              {"questionText":"Single","questionType":"SINGLE_CHOICE","points":1,
               "options":[{"optionText":"Correct","correct":true},{"optionText":"Wrong","correct":false}]},
              {"questionText":"Multiple","questionType":"MULTIPLE_CHOICE","points":3,
               "options":[{"optionText":"First","correct":true},{"optionText":"Second","correct":true},
                          {"optionText":"Wrong","correct":false}]},
              {"questionText":"Last","questionType":"SINGLE_CHOICE","points":2,
               "options":[{"optionText":"Correct","correct":true},{"optionText":"Wrong","correct":false}]}]}
            """.formatted(COURSE, lessonId, title, timeLimit);
    }

    private JsonNode create(String definition) throws Exception {
        return data(send("POST", ADMIN, 1, "ADMIN", definition), 201);
    }

    private JsonNode publishedQuiz(Integer timeLimit) throws Exception {
        var quiz = create(definition("C11 weighted quiz", null, timeLimit));
        return data(send("PATCH", ADMIN + "/" + quiz.get("id").asLong() + "/publish", 1, "ADMIN", null), 200);
    }

    private long start(long user, long quiz) throws Exception {
        return data(learner("POST", "/quizzes/" + quiz + "/attempts", user, null), 200)
            .get("attemptId").asLong();
    }

    private Map<String, Object> answer(JsonNode quiz, int question, Integer... options) {
        var item = quiz.get("questions").get(question);
        return Map.of("questionId", item.get("id").asLong(), "optionIds",
            List.of(options).stream().map(index -> item.get("options").get(index).get("id").asLong()).toList());
    }

    private String answers(List<Map<String, Object>> selections) {
        return mapper.writeValueAsString(Map.of("answers", selections));
    }

    private String completeAnswers(JsonNode quiz) {
        return answers(List.of(answer(quiz, 0, 0), answer(quiz, 1, 0, 1), answer(quiz, 2, 0)));
    }

    private long count(String table, long user) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE user_id = ?", Long.class, user);
    }

    @Test
    void weightedScoringRequiresTheExactChoiceSetAndPersistsEachAttempt() throws Exception {
        long user = enrolledUser();
        var quiz = publishedQuiz(null);
        long quizId = quiz.get("id").asLong();
        record Scenario(List<Map<String, Object>> answers, int score, boolean passed) {}
        var scenarios = List.of(
            new Scenario(List.of(answer(quiz, 0, 0), answer(quiz, 1, 0, 1), answer(quiz, 2, 0)), 100, true),
            new Scenario(List.of(answer(quiz, 0, 0)), 17, false),
            new Scenario(List.of(answer(quiz, 1, 0, 1)), 50, false),
            new Scenario(List.of(answer(quiz, 0, 0), answer(quiz, 1, 0, 1)), 67, true),
            new Scenario(List.of(answer(quiz, 0, 0), answer(quiz, 1, 0)), 17, false),
            new Scenario(List.of(answer(quiz, 0, 0), answer(quiz, 1, 0, 1, 2)), 17, false),
            new Scenario(List.of(answer(quiz, 0, 1), answer(quiz, 1), answer(quiz, 2, 1)), 0, false),
            new Scenario(List.of(), 0, false)
        );
        long previous = 0;
        for (var scenario : scenarios) {
            long attempt = start(user, quizId);
            assertThat(attempt).isNotEqualTo(previous);
            var result = data(learner("POST", "/quizzes/attempts/" + attempt + "/submit", user,
                answers(scenario.answers())), 200);
            assertThat(result.get("score").asInt()).isEqualTo(scenario.score());
            assertThat(result.get("passed").asBoolean()).isEqualTo(scenario.passed());
            assertThat(result.get("status").asString()).isEqualTo("GRADED");
            var review = data(learner("GET", "/quizzes/attempts/" + attempt + "/review", user, null), 200);
            int awarded = 0;
            for (var question : review.get("questions")) awarded += question.get("pointsAwarded").asInt();
            assertThat((int) Math.round(awarded * 100.0 / 6)).isEqualTo(scenario.score());
            previous = attempt;
        }
        assertThat(count("quiz_attempts", user)).isEqualTo(scenarios.size());
        assertThat(count("notifications", user)).isEqualTo(scenarios.size());
        assertThat(data(learner("GET", "/quizzes/" + quizId + "/result", user, null), 200)
            .get("attemptId").asLong()).isEqualTo(previous);
    }

    @Test
    void forgedIdsDuplicatesAndOtherOwnersCannotChangeAnAttempt() throws Exception {
        long user = enrolledUser();
        long other = enrolledUser();
        var quiz = publishedQuiz(null);
        var foreign = publishedQuiz(null);
        long quizId = quiz.get("id").asLong();
        long attempt = start(user, quizId);
        String path = "/quizzes/attempts/" + attempt;
        assertThat(learner("POST", path + "/submit", other, completeAnswers(quiz)).statusCode()).isEqualTo(404);
        assertThat(learner("GET", path + "/review", other, null).statusCode()).isEqualTo(404);
        assertThat(learner("GET", "/quizzes/" + quizId, USERS.incrementAndGet(), null).statusCode()).isEqualTo(403);
        assertThat(learner("GET", path + "/review", user, null).statusCode()).isEqualTo(409);
        var publicQuiz = data(learner("GET", "/quizzes/" + quizId, user, null), 200);
        assertThat(publicQuiz.toString()).doesNotContain("\"correct\"");
        var invalidAnswers = List.of(
            answers(List.of(answer(foreign, 0, 0))),
            answers(List.of(Map.of("questionId", quiz.get("questions").get(0).get("id").asLong(),
                "optionIds", List.of(foreign.get("questions").get(0).get("options").get(0).get("id").asLong())))),
            answers(List.of(answer(quiz, 0, 0), answer(quiz, 0, 0))),
            answers(List.of(answer(quiz, 1, 0, 0))),
            answers(List.of(answer(quiz, 0, 0, 1))),
            "{\"answers\":[null]}",
            "{\"answers\":[{\"questionId\":null,\"optionIds\":[]}]}",
            "{\"answers\":[{\"questionId\":1,\"optionIds\":[null]}]}"
        );
        for (var body : invalidAnswers) {
            assertThat(learner("POST", path + "/submit", user, body).statusCode()).isEqualTo(400);
        }
        assertThat(count("notifications", user)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM quiz_answers WHERE attempt_id = ?", Long.class,
            attempt)).isZero();
        data(learner("POST", path + "/submit", user, completeAnswers(quiz)), 200);
        assertThat(learner("GET", path + "/review", other, null).statusCode()).isEqualTo(404);
    }

    @Test
    void concurrentStartReusesOneAttemptAndConcurrentSubmitGradesExactlyOnce() throws Exception {
        long user = enrolledUser();
        var quiz = publishedQuiz(null);
        long quizId = quiz.get("id").asLong();
        try (var executor = Executors.newFixedThreadPool(4)) {
            CountDownLatch begin = new CountDownLatch(1);
            var starts = java.util.stream.IntStream.range(0, 4).mapToObj(index -> executor.submit(() -> {
                begin.await();
                return start(user, quizId);
            })).toList();
            begin.countDown();
            long attempt = starts.get(0).get(15, TimeUnit.SECONDS);
            for (var result : starts) assertThat(result.get(15, TimeUnit.SECONDS)).isEqualTo(attempt);
            assertThat(count("quiz_attempts", user)).isEqualTo(1);
            CountDownLatch submit = new CountDownLatch(1);
            var submits = java.util.stream.IntStream.range(0, 4).mapToObj(index -> executor.submit(() -> {
                submit.await();
                return learner("POST", "/quizzes/attempts/" + attempt + "/submit", user,
                    completeAnswers(quiz)).statusCode();
            })).toList();
            submit.countDown();
            var statuses = new java.util.ArrayList<Integer>();
            for (var result : submits) statuses.add(result.get(15, TimeUnit.SECONDS));
            assertThat(statuses).containsExactlyInAnyOrder(200, 409, 409, 409);
            assertThat(count("notifications", user)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM quiz_answers WHERE attempt_id = ?",
                Long.class, attempt)).isEqualTo(4);
            assertThat(data(learner("GET", "/quizzes/attempts/" + attempt + "/review", user, null), 200)
                .get("score").asInt()).isEqualTo(100);
        }
    }

    @Test
    void serverDeadlineRejectsLateSubmissionAndRetryStartsAFreshAttempt() throws Exception {
        long user = enrolledUser();
        var quiz = publishedQuiz(1);
        long quizId = quiz.get("id").asLong();
        long attempt = start(user, quizId);
        assertThat(start(user, quizId)).isEqualTo(attempt);
        jdbc.update("UPDATE quiz_attempts SET started_at = ? WHERE id = ?",
            java.sql.Timestamp.from(Instant.now().minusSeconds(120)), attempt);
        assertThat(learner("POST", "/quizzes/attempts/" + attempt + "/submit", user,
            completeAnswers(quiz)).statusCode()).isEqualTo(409);
        assertThat(count("notifications", user)).isZero();
        long retry = start(user, quizId);
        assertThat(retry).isNotEqualTo(attempt);
        assertThat(start(user, quizId)).isEqualTo(retry);
        data(learner("POST", "/quizzes/attempts/" + retry + "/submit", user, completeAnswers(quiz)), 200);
        assertThat(count("notifications", user)).isEqualTo(1);
        assertThat(data(learner("GET", "/quizzes/" + quizId + "/result", user, null), 200)
            .get("attemptId").asLong()).isEqualTo(retry);
    }

    @Test
    void adminValidatesLessonMembershipAndFreezesPublishedDefinitions() throws Exception {
        String body = definition("Lesson quiz", LESSON, null);
        assertThat(send("POST", ADMIN, 1, "USER", body).statusCode()).isEqualTo(403);
        assertThat(send("POST", ADMIN, 1, "ADMIN", definition("Wrong lesson", LESSON + 1, null))
            .statusCode()).isEqualTo(404);
        var quiz = create(body);
        long id = quiz.get("id").asLong();
        assertThat(send("PUT", ADMIN + "/" + id, 1, "ADMIN", definition("Wrong update", LESSON + 1, null))
            .statusCode()).isEqualTo(404);
        assertThat(data(send("GET", ADMIN + "/" + id, 1, "ADMIN", null), 200)
            .get("title").asString()).isEqualTo("Lesson quiz");
        data(send("PUT", ADMIN + "/" + id, 1, "ADMIN", definition("Updated", LESSON, null)), 200);
        data(send("PATCH", ADMIN + "/" + id + "/publish", 1, "ADMIN", null), 200);
        assertThat(send("PUT", ADMIN + "/" + id, 1, "ADMIN", body).statusCode()).isEqualTo(409);
        assertThat(send("DELETE", ADMIN + "/" + id, 1, "ADMIN", null).statusCode()).isEqualTo(409);
        var draft = create(body);
        long draftId = draft.get("id").asLong();
        data(send("DELETE", ADMIN + "/" + draftId, 1, "ADMIN", null), 200);
        assertThat(send("GET", ADMIN + "/" + draftId, 1, "ADMIN", null).statusCode()).isEqualTo(404);
    }

    @Test
    void publishRejectsLegacyDefinitionsThatCannotBeScored() throws Exception {
        var quiz = create(definition("Legacy draft", null, null));
        long id = quiz.get("id").asLong();
        jdbc.update("UPDATE quiz_options SET correct = false WHERE question_id = ?",
            quiz.get("questions").get(0).get("id").asLong());
        assertThat(send("PATCH", ADMIN + "/" + id + "/publish", 1, "ADMIN", null).statusCode()).isEqualTo(409);
        assertThat(data(send("GET", ADMIN + "/" + id, 1, "ADMIN", null), 200)
            .get("published").asBoolean()).isFalse();
    }

    @Test
    void publishWaitsForAnInFlightDraftUpdateAndPublishesItsFinalDefinition() throws Exception {
        var quiz = create(definition("Before update", null, null));
        long id = quiz.get("id").asLong();
        CountDownLatch updating = new CountDownLatch(1);
        CountDownLatch finishUpdate = new CountDownLatch(1);
        CountDownLatch publishing = new CountDownLatch(1);
        AtomicInteger validations = new AtomicInteger();
        doAnswer(invocation -> {
            if (validations.incrementAndGet() == 1) {
                updating.countDown();
                assertThat(finishUpdate.await(10, TimeUnit.SECONDS)).isTrue();
            } else {
                publishing.countDown();
            }
            return null;
        }).when(courses).requireExistingCourse(COURSE);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var update = executor.submit(() -> send("PUT", ADMIN + "/" + id, 1, "ADMIN",
                definition("Final definition", null, null)));
            assertThat(updating.await(10, TimeUnit.SECONDS)).isTrue();
            var publish = executor.submit(() -> send("PATCH", ADMIN + "/" + id + "/publish", 1, "ADMIN", null));
            try {
                assertThat(publishing.await(300, TimeUnit.MILLISECONDS)).isFalse();
            } finally {
                finishUpdate.countDown();
            }
            data(update.get(15, TimeUnit.SECONDS), 200);
            data(publish.get(15, TimeUnit.SECONDS), 200);
        } finally {
            finishUpdate.countDown();
        }
        var published = data(send("GET", ADMIN + "/" + id, 1, "ADMIN", null), 200);
        assertThat(published.get("published").asBoolean()).isTrue();
        assertThat(published.get("title").asString()).isEqualTo("Final definition");
    }
}
