package com.elearning.learning;

import static org.assertj.core.api.Assertions.*;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.common.response.PageResponse;
import com.elearning.learning.repository.EnrollmentRepository;
import com.elearning.learning.security.JwtTokenProvider;
import static org.mockito.Mockito.when;

import com.elearning.learning.service.CourseCatalogClient;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import static org.mockito.Mockito.doThrow;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(LearningServiceApplicationTests.Probes.class)
class LearningServiceApplicationTests {

    static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();
    static final String BASE = "/api/v1/_foundation-test";
    static final String INTERNAL_TOKEN = "test-internal-service-token-1234567890";

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
    }

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper mapper;

    @Autowired
    JwtTokenProvider tokens;

    @Autowired
    EnrollmentRepository enrollments;

    @MockitoBean
    CourseCatalogClient courseCatalog;

    @BeforeEach
    void curriculumForExistingProgressFixture() {
        when(courseCatalog.getCurriculum(888L)).thenReturn(
            new CourseCatalogClient.Curriculum(
                888L,
                "Progress fixture",
                List.of(
                    new CourseCatalogClient.SectionReference(
                        88L,
                        888L,
                        "Section",
                        0,
                        List.of(
                            new CourseCatalogClient.LessonReference(
                                10001L,
                                88L,
                                "Lesson",
                                "TEXT",
                                "Content",
                                null,
                                null,
                                0,
                                false
                            )
                        )
                    )
                )
            )
        );
    }

    final HttpClient client = HttpClient.newHttpClient();

    String token(String role, long seconds) {
        return Jwts.builder()
            .subject("test-user")
            .issuer("sgedu")
            .claim("role", role)
            .claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(120)))
            .expiration(Date.from(Instant.now().plusSeconds(seconds)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();
    }

    HttpResponse<String> request(String path, String token, String body) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (body != null) builder
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body));
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    HttpResponse<String> internalEnrollment(String internalToken, String body) throws Exception {
        var builder = HttpRequest
            .newBuilder(URI.create("http://localhost:" + port + "/internal/v1/learning/enrollments"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body));
        if (internalToken != null) {
            builder.header("X-Internal-Service-Token", internalToken);
        }
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    String tokenFor(String role, Long userId) {
        return Jwts.builder()
            .subject(userId.toString())
            .issuer("sgedu")
            .claim("role", role)
            .claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(1)))
            .expiration(Date.from(Instant.now().plusSeconds(120)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();
    }

    HttpResponse<String> send(String method, String path, String access, String body) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (access != null) builder.header("Authorization", "Bearer " + access);
        if (body != null) builder.header("Content-Type", "application/json");
        builder.method(method, body == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(body));
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    HttpResponse<String> patch(String path, String token) throws Exception {
        var builder = HttpRequest
            .newBuilder(URI.create("http://localhost:" + port + path))
            .method("PATCH", HttpRequest.BodyPublishers.noBody());
        if (token != null) builder.header("Authorization", "Bearer " + token);
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    void error(HttpResponse<String> response, int status, String code, String path) throws Exception {
        assertThat(response.statusCode()).isEqualTo(status);
        JsonNode json = mapper.readTree(response.body());
        assertThat(json.get("success").asBoolean()).isFalse();
        assertThat(json.get("code").asString()).isEqualTo(code);
        assertThat(json.get("path").asString()).isEqualTo(path);
        assertThat(json.has("errors")).isTrue();
        assertThat(json.has("timestamp")).isTrue();
        assertThat(json.has("trace")).isFalse();
        assertThat(response.body()).doesNotContain("sensitive-test-detail");
    }

    @Test
    void granularReportPermissionIsRequiredAndSignedClaimsAreValidated() throws Exception {
        String path = "/api/v1/learning/admin/overview";
        assertThat(request(path, token("USER", 60), null).statusCode()).isEqualTo(403);
        for (Object claim : List.of(
            List.of("LEARNING_REPORT_VIEW"),
            List.of("USER_VIEW"),
            "LEARNING_REPORT_VIEW"
        )) {
            String access = Jwts.builder()
                .subject("123")
                .issuer("sgedu")
                .claim("role", "USER")
                .claim("permissions", claim)
                .claim("tokenType", "access")
                .issuedAt(Date.from(Instant.now().minusSeconds(1)))
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();
            var result = request(path, access, null);
            if (claim.equals(List.of("LEARNING_REPORT_VIEW"))) {
                assertThat(result.statusCode()).withFailMessage(result.body()).isEqualTo(200);
                assertThat(
                    mapper.readTree(result.body()).get("data").get("completionRate").isNumber()
                ).isTrue();
            } else assertThat(result.statusCode()).isEqualTo(claim instanceof String ? 401 : 403);
        }
    }

    @Test
    void startsIndependentlyAndExposesHealth() throws Exception {
        assertThat(request("/actuator/health", null, null).statusCode()).isEqualTo(200);
    }

    @Test
    void authenticatesWithoutTrustingIdentityHeaders() throws Exception {
        error(request(BASE, null, null), 401, "UNAUTHORIZED", BASE);
        error(request(BASE, "malformed", null), 401, "UNAUTHORIZED", BASE);
        error(request(BASE, token("USER", -60), null), 401, "UNAUTHORIZED", BASE);
        error(request(BASE, token("OTHER", 60), null), 401, "UNAUTHORIZED", BASE);
        error(request(BASE, token(null, 60), null), 401, "UNAUTHORIZED", BASE);
        var success = request(BASE, token("USER", 60), null);
        assertThat(success.statusCode()).isEqualTo(200);
        JsonNode json = mapper.readTree(success.body());
        assertThat(json.get("success").asBoolean()).isTrue();
        assertThat(json.get("message").asString()).isEqualTo("Success");
        assertThat(json.get("data").get("ready").asBoolean()).isTrue();
        assertThat(json.has("timestamp")).isTrue();
    }

    @Test
    void enforcesAdminAuthority() throws Exception {
        error(request(BASE + "/admin", token("USER", 60), null), 403, "FORBIDDEN", BASE + "/admin");
        assertThat(request(BASE + "/admin", token("ADMIN", 60), null).statusCode()).isEqualTo(200);
    }

    @Test
    void normalizesValidationAndMalformedBodies() throws Exception {
        var invalid = request(BASE, token("USER", 60), "{}");
        error(invalid, 400, "VALIDATION_ERROR", BASE);
        assertThat(mapper.readTree(invalid.body()).get("errors").get("name").isArray()).isTrue();
        error(request(BASE, token("USER", 60), "{"), 400, "MALFORMED_REQUEST", BASE);
    }

    @Test
    void normalizesDomainFallbackAndNotFound() throws Exception {
        error(request(BASE + "/conflict", token("USER", 60), null), 409, "CONFLICT", BASE + "/conflict");
        error(request(BASE + "/failure", token("USER", 60), null), 500, "INTERNAL_ERROR", BASE + "/failure");
        error(request(BASE + "/missing", token("USER", 60), null), 404, "NOT_FOUND", BASE + "/missing");
    }

    @Test
    void notificationReceiverIsDisabledWithoutAConfiguredKey() throws Exception {
        String path = "/internal/v1/notifications/events";
        error(request(path, tokenFor("ADMIN", 912L), "{}"), 503, "SERVICE_UNAVAILABLE", path);
    }

    @Test
    void freeEnrollmentIsIdempotentForMyCourses() throws Exception {
        String access = Jwts.builder()
            .subject("123")
            .issuer("sgedu")
            .claim("role", "USER")
            .claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(1)))
            .expiration(Date.from(Instant.now().plusSeconds(60)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();

        var first = request("/api/v1/learning/enrollments", access, "{\"courseId\":777}");
        var second = request("/api/v1/learning/enrollments", access, "{\"courseId\":777}");

        assertThat(first.statusCode()).withFailMessage(first.body()).isEqualTo(200);
        assertThat(second.statusCode()).withFailMessage(second.body()).isEqualTo(200);
        JsonNode firstData = mapper.readTree(first.body()).get("data");
        JsonNode secondData = mapper.readTree(second.body()).get("data");
        assertThat(secondData.get("id").asLong()).isEqualTo(firstData.get("id").asLong());
        assertThat(enrollments.findByUserIdAndCourseId(123L, 777L)).isPresent();
        assertThat(enrollments.findByUserIdOrderByLastAccessedAtDescEnrolledAtDesc(123L)).hasSize(1);
    }

    @Test
    void paymentEnrollmentRequiresInternalTokenAndIsIdempotentByOrder() throws Exception {
        String path = "/internal/v1/learning/enrollments";
        String body = "{\"orderCode\":\"LS-PAY-INTEGRATION-001\",\"userId\":5001,\"courseId\":7001}";

        error(internalEnrollment(null, body), 401, "UNAUTHORIZED", path);
        error(internalEnrollment("wrong-internal-token-that-is-long-enough", body), 401, "UNAUTHORIZED", path);

        var first = internalEnrollment(INTERNAL_TOKEN, body);
        var repeated = internalEnrollment(INTERNAL_TOKEN, body);

        assertThat(first.statusCode()).withFailMessage(first.body()).isEqualTo(200);
        assertThat(repeated.statusCode()).withFailMessage(repeated.body()).isEqualTo(200);
        JsonNode firstData = mapper.readTree(first.body()).get("data");
        JsonNode repeatedData = mapper.readTree(repeated.body()).get("data");
        assertThat(repeatedData.get("id").asLong()).isEqualTo(firstData.get("id").asLong());
        assertThat(enrollments.findBySourceOrderCode("LS-PAY-INTEGRATION-001")).isPresent();
        assertThat(enrollments.findByUserIdOrderByLastAccessedAtDescEnrolledAtDesc(5001L)).hasSize(1);

        error(
            internalEnrollment(
                INTERNAL_TOKEN,
                "{\"orderCode\":\"LS-PAY-INTEGRATION-001\",\"userId\":5002,\"courseId\":7001}"
            ),
            409,
            "CONFLICT",
            path
        );
    }

    @Test
    void lessonAccessAndCompletionUpdateCourseProgressForEnrolledUser() throws Exception {
        String access = Jwts.builder()
            .subject("124")
            .issuer("sgedu")
            .claim("role", "USER")
            .claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(1)))
            .expiration(Date.from(Instant.now().plusSeconds(60)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();

        assertThat(
            request("/api/v1/learning/enrollments", access, "{\"courseId\":888}").statusCode()
        ).isEqualTo(200);

        var accessLesson = request(
            "/api/v1/learning/progress/courses/888/lessons/10001/access",
            access,
            "{}"
        );
        assertThat(accessLesson.statusCode()).withFailMessage(accessLesson.body()).isEqualTo(200);
        JsonNode accessed = mapper.readTree(accessLesson.body()).get("data");
        assertThat(accessed.get("status").asString()).isEqualTo("IN_PROGRESS");
        assertThat(accessed.get("progressPercent").asInt()).isEqualTo(10);

        var completeLesson = patch(
            "/api/v1/learning/progress/courses/888/lessons/10001/complete",
            access
        );
        assertThat(completeLesson.statusCode()).withFailMessage(completeLesson.body()).isEqualTo(200);
        JsonNode completed = mapper.readTree(completeLesson.body()).get("data");
        assertThat(completed.get("status").asString()).isEqualTo("COMPLETED");
        assertThat(completed.get("progressPercent").asInt()).isEqualTo(100);
        assertThat(completed.get("completedAt").isNull()).isFalse();

        var progress = request("/api/v1/learning/progress/courses/888", access, null);
        assertThat(progress.statusCode()).withFailMessage(progress.body()).isEqualTo(200);
        JsonNode progressItems = mapper.readTree(progress.body()).get("data");
        assertThat(progressItems).hasSize(1);
        assertThat(progressItems.get(0).get("lessonId").asLong()).isEqualTo(10001L);

        String otherUser = Jwts.builder()
            .subject("125")
            .issuer("sgedu")
            .claim("role", "USER")
            .claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(1)))
            .expiration(Date.from(Instant.now().plusSeconds(60)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();
        error(
            request("/api/v1/learning/progress/courses/888/lessons/10001/access", otherUser, "{}"),
            403,
            "FORBIDDEN",
            "/api/v1/learning/progress/courses/888/lessons/10001/access"
        );
    }

    @Test
    void adminCanPublishQuizAndEnrolledUserCanSubmitGradedAttempt() throws Exception {
        String admin = tokenFor("ADMIN", 200L);
        String learner = tokenFor("USER", 201L);
        String stranger = tokenFor("USER", 202L);
        String adminPath = "/api/v1/learning/admin/quizzes";
        String definition = """
            {"courseId":99001,"title":"Week 4 Quiz","description":"Practice",
             "passingScore":70,"timeLimitMinutes":10,"questions":[
              {"questionText":"Pick A","questionType":"SINGLE_CHOICE","points":2,
               "options":[{"optionText":"A","correct":true},{"optionText":"B","correct":false}]},
              {"questionText":"Pick C and D","questionType":"MULTIPLE_CHOICE","points":3,
               "options":[{"optionText":"C","correct":true},{"optionText":"D","correct":true},
                          {"optionText":"E","correct":false}]}
             ]}
            """;

        error(send("POST", adminPath, learner, definition), 403, "FORBIDDEN", adminPath);
        var created = send("POST", adminPath, admin, definition);
        assertThat(created.statusCode()).withFailMessage(created.body()).isEqualTo(201);
        JsonNode adminQuiz = mapper.readTree(created.body()).get("data");
        long quizId = adminQuiz.get("id").asLong();
        assertThat(adminQuiz.get("questions").get(0).get("options").get(0).get("correct").asBoolean())
            .isTrue();
        var updated = send("PUT", adminPath + "/" + quizId, admin,
            definition.replace("Week 4 Quiz", "Week 4 Quiz Updated"));
        assertThat(updated.statusCode()).withFailMessage(updated.body()).isEqualTo(200);
        assertThat(updated.body()).contains("Week 4 Quiz Updated");
        String quizPath = "/api/v1/learning/quizzes/" + quizId;
        error(send("GET", quizPath, learner, null), 404, "NOT_FOUND", quizPath);
        assertThat(send("POST", "/api/v1/learning/enrollments", learner, "{\"courseId\":99001}")
            .statusCode()).isEqualTo(200);
        assertThat(send("PATCH", adminPath + "/" + quizId + "/publish", admin, null).statusCode())
            .isEqualTo(200);
        error(send("PUT", adminPath + "/" + quizId, admin, definition), 409, "CONFLICT",
            adminPath + "/" + quizId);
        error(send("GET", quizPath, stranger, null), 403, "FORBIDDEN", quizPath);

        JsonNode userQuiz = mapper.readTree(send("GET", quizPath, learner, null).body()).get("data");
        assertThat(userQuiz.toString()).doesNotContain("correct");
        assertThat(userQuiz.get("questions")).hasSize(2);
        assertThat(send("GET", "/api/v1/learning/courses/99001/quizzes", learner, null).body())
            .contains("Week 4 Quiz Updated");
        long firstQuestion = userQuiz.get("questions").get(0).get("id").asLong();
        long firstOption = userQuiz.get("questions").get(0).get("options").get(0).get("id").asLong();
        long secondQuestion = userQuiz.get("questions").get(1).get("id").asLong();
        long secondOption = userQuiz.get("questions").get(1).get("options").get(0).get("id").asLong();
        long thirdOption = userQuiz.get("questions").get(1).get("options").get(1).get("id").asLong();

        String startPath = quizPath + "/attempts";
        error(send("POST", startPath, stranger, null), 403, "FORBIDDEN", startPath);
        JsonNode started = mapper.readTree(send("POST", startPath, learner, null).body()).get("data");
        long attemptId = started.get("attemptId").asLong();
        JsonNode resumed = mapper.readTree(send("POST", startPath, learner, null).body()).get("data");
        assertThat(resumed.get("attemptId").asLong()).isEqualTo(attemptId);
        String reviewPath = "/api/v1/learning/quizzes/attempts/" + attemptId + "/review";
        error(send("GET", reviewPath, learner, null), 409, "CONFLICT", reviewPath);
        error(send("GET", reviewPath, stranger, null), 404, "NOT_FOUND", reviewPath);
        String submitPath = "/api/v1/learning/quizzes/attempts/" + attemptId + "/submit";
        String answers = """
            {"answers":[{"questionId":%d,"optionIds":[%d]},
                        {"questionId":%d,"optionIds":[%d,%d]}]}
            """.formatted(firstQuestion, firstOption, secondQuestion, secondOption, thirdOption);
        error(send("POST", submitPath, stranger, answers), 404, "NOT_FOUND", submitPath);
        var result = send("POST", submitPath, learner, answers);
        assertThat(result.statusCode()).withFailMessage(result.body()).isEqualTo(200);
        JsonNode graded = mapper.readTree(result.body()).get("data");
        assertThat(graded.get("score").asInt()).isEqualTo(100);
        assertThat(graded.get("passed").asBoolean()).isTrue();
        assertThat(graded.get("status").asString()).isEqualTo("GRADED");
        JsonNode review = mapper.readTree(send("GET", reviewPath, learner, null).body()).get("data");
        assertThat(review.get("attemptId").asLong()).isEqualTo(attemptId);
        assertThat(review.get("quizTitle").asText()).isEqualTo("Week 4 Quiz Updated");
        assertThat(review.get("score").asInt()).isEqualTo(100);
        assertThat(review.get("passed").asBoolean()).isTrue();
        assertThat(review.get("questions")).hasSize(2);
        assertThat(review.get("questions").get(0).get("pointsAwarded").asInt()).isEqualTo(2);
        assertThat(review.get("questions").get(0).get("correct").asBoolean()).isTrue();
        assertThat(review.get("questions").get(0).get("options").get(0).get("selected").asBoolean())
            .isTrue();
        assertThat(review.get("questions").get(0).get("options").get(0).get("correct").asBoolean())
            .isTrue();
        assertThat(review.get("questions").get(1).get("pointsAwarded").asInt()).isEqualTo(3);
        assertThat(review.get("questions").get(1).get("options").get(2).get("correct").asBoolean())
            .isFalse();
        error(send("GET", reviewPath, stranger, null), 404, "NOT_FOUND", reviewPath);
        error(send("POST", submitPath, learner, answers), 409, "CONFLICT", submitPath);
        JsonNode notifications = mapper.readTree(send(
            "GET", "/api/v1/learning/notifications/feed?category=LEARNING", learner, null
        ).body()).get("data");
        assertThat(notifications.get("totalElements").asLong()).isEqualTo(1);
        assertThat(notifications.get("content").get(0).get("type").asString()).isEqualTo("QUIZ_RESULT_AVAILABLE");
        assertThat(notifications.get("content").get(0).get("actionUrl").asString())
            .isEqualTo("/quizzes/attempts/" + attemptId + "/result");
        assertThat(send("GET", quizPath + "/result", learner, null).body()).contains("\"score\":100");
        long retakeId = mapper.readTree(send("POST", startPath, learner, null).body())
            .get("data").get("attemptId").asLong();
        assertThat(retakeId).isNotEqualTo(attemptId);
        assertThat(send("GET", quizPath + "/result", learner, null).body()).contains("\"score\":100");
        assertThat(send("GET", reviewPath, learner, null).body()).contains("\"score\":100");
    }

    @Test
    void quizDefinitionAndAnswersRejectInvalidChoices() throws Exception {
        String admin = tokenFor("ADMIN", 210L);
        String learner = tokenFor("USER", 211L);
        String path = "/api/v1/learning/admin/quizzes";
        String invalid = """
            {"courseId":99002,"title":"Invalid","passingScore":70,"questions":[
             {"questionText":"Pick one","questionType":"SINGLE_CHOICE","points":1,
              "options":[{"optionText":"A","correct":false},{"optionText":"B","correct":false}]}]}
            """;
        error(send("POST", path, admin, invalid), 400, "BAD_REQUEST", path);
        String definition = invalid.replace("\"correct\":false", "\"correct\":true");
        definition = definition.replaceFirst("\"correct\":true", "\"correct\":false");
        var created = send("POST", path, admin, definition);
        assertThat(created.statusCode()).withFailMessage(created.body()).isEqualTo(201);
        long id = mapper.readTree(created.body()).get("data").get("id").asLong();
        long draftId = mapper.readTree(send("POST", path, admin,
            definition.replace("Invalid", "Draft to delete")).body()).get("data").get("id").asLong();
        assertThat(send("DELETE", path + "/" + draftId, admin, null).statusCode()).isEqualTo(200);
        error(send("GET", path + "/" + draftId, admin, null), 404, "NOT_FOUND",
            path + "/" + draftId);
        assertThat(send("PATCH", path + "/" + id + "/publish", admin, null).statusCode())
            .isEqualTo(200);
        error(send("DELETE", path + "/" + id, admin, null), 409, "CONFLICT", path + "/" + id);
        assertThat(send("POST", "/api/v1/learning/enrollments", learner, "{\"courseId\":99002}")
            .statusCode()).isEqualTo(200);
        long attemptId = mapper.readTree(send("POST", "/api/v1/learning/quizzes/" + id + "/attempts",
            learner, null).body()).get("data").get("attemptId").asLong();
        String submit = "/api/v1/learning/quizzes/attempts/" + attemptId + "/submit";
        error(send("POST", submit, learner, "{\"answers\":[{\"questionId\":999999,\"optionIds\":[1]}]}"),
            400, "BAD_REQUEST", submit);
        assertThat(send("POST", submit, learner, "{\"answers\":[]}").statusCode()).isEqualTo(200);
        assertThat(send("GET", "/api/v1/learning/quizzes/" + id + "/result", learner, null).body())
            .contains("\"score\":0");
        JsonNode unanswered = mapper.readTree(send("GET",
            "/api/v1/learning/quizzes/attempts/" + attemptId + "/review", learner, null).body())
            .get("data").get("questions").get(0);
        assertThat(unanswered.get("correct").asBoolean()).isFalse();
        assertThat(unanswered.get("pointsAwarded").asInt()).isZero();
        assertThat(unanswered.get("options").get(1).get("correct").asBoolean()).isTrue();
        assertThat(unanswered.get("options").get(1).get("selected").asBoolean()).isFalse();
    }

    @Test
    void reviewShowsWrongPartialAndUnansweredQuestionsWithWeightedScore() throws Exception {
        String admin = tokenFor("ADMIN", 230L);
        String learner = tokenFor("USER", 231L);
        String definition = """
            {"courseId":99001,"title":"Weighted quiz","passingScore":70,"questions":[
             {"questionText":"First","questionType":"SINGLE_CHOICE","points":1,
              "options":[{"optionText":"A","correct":true},{"optionText":"B","correct":false}]},
             {"questionText":"Second","questionType":"MULTIPLE_CHOICE","points":2,
              "options":[{"optionText":"C","correct":true},{"optionText":"D","correct":true},
                         {"optionText":"E","correct":false}]},
             {"questionText":"Third","questionType":"SINGLE_CHOICE","points":3,
              "options":[{"optionText":"F","correct":true},{"optionText":"G","correct":false}]}
            ]}
            """;
        long quizId = mapper.readTree(send("POST", "/api/v1/learning/admin/quizzes", admin,
            definition).body()).get("data").get("id").asLong();
        send("PATCH", "/api/v1/learning/admin/quizzes/" + quizId + "/publish", admin, null);
        send("POST", "/api/v1/learning/enrollments", learner, "{\"courseId\":99001}");
        JsonNode quiz = mapper.readTree(send("GET", "/api/v1/learning/quizzes/" + quizId,
            learner, null).body()).get("data");
        long firstQuestion = quiz.get("questions").get(0).get("id").asLong();
        long firstOption = quiz.get("questions").get(0).get("options").get(0).get("id").asLong();
        long secondQuestion = quiz.get("questions").get(1).get("id").asLong();
        long secondOption = quiz.get("questions").get(1).get("options").get(0).get("id").asLong();
        long attemptId = mapper.readTree(send("POST", "/api/v1/learning/quizzes/" + quizId
            + "/attempts", learner, null).body()).get("data").get("attemptId").asLong();
        String answers = """
            {"answers":[{"questionId":%d,"optionIds":[%d]},
                        {"questionId":%d,"optionIds":[%d]}]}
            """.formatted(firstQuestion, firstOption, secondQuestion, secondOption);
        JsonNode result = mapper.readTree(send("POST", "/api/v1/learning/quizzes/attempts/"
            + attemptId + "/submit", learner, answers).body()).get("data");
        assertThat(result.get("score").asInt()).isEqualTo(17);
        assertThat(result.get("passed").asBoolean()).isFalse();

        JsonNode review = mapper.readTree(send("GET", "/api/v1/learning/quizzes/attempts/"
            + attemptId + "/review", learner, null).body()).get("data");
        assertThat(review.get("questions")).hasSize(3);
        assertThat(review.get("questions").get(0).get("pointsAwarded").asInt()).isEqualTo(1);
        JsonNode partial = review.get("questions").get(1);
        assertThat(partial.get("correct").asBoolean()).isFalse();
        assertThat(partial.get("answered").asBoolean()).isTrue();
        assertThat(partial.get("pointsAwarded").asInt()).isZero();
        assertThat(partial.get("options").get(0).get("selected").asBoolean()).isTrue();
        assertThat(partial.get("options").get(1).get("correct").asBoolean()).isTrue();
        assertThat(partial.get("options").get(1).get("selected").asBoolean()).isFalse();
        JsonNode unanswered = review.get("questions").get(2);
        assertThat(unanswered.get("correct").asBoolean()).isFalse();
        assertThat(unanswered.get("answered").asBoolean()).isFalse();
        assertThat(unanswered.get("pointsAwarded").asInt()).isZero();
        assertThat(unanswered.get("options").get(0).get("correct").asBoolean()).isTrue();
        assertThat(unanswered.get("options").get(0).get("selected").asBoolean()).isFalse();
    }

    @Test
    void quizCreationRejectsUnknownCourse() throws Exception {
        doThrow(new AppException(ErrorCode.NOT_FOUND))
            .when(courseCatalog).requireExistingCourse(99004L);
        String path = "/api/v1/learning/admin/quizzes";
        String definition = """
            {"courseId":99004,"title":"Orphan","passingScore":70,"questions":[
             {"questionText":"Pick one","questionType":"SINGLE_CHOICE","points":1,
              "options":[{"optionText":"A","correct":true},{"optionText":"B","correct":false}]}]}
            """;
        error(send("POST", path, tokenFor("ADMIN", 220L), definition), 404, "NOT_FOUND", path);

        String draft = definition.replace("99004", "99005");
        String admin = tokenFor("ADMIN", 220L);
        long draftId = mapper.readTree(send("POST", path, admin, draft).body())
            .get("data").get("id").asLong();
        doThrow(new AppException(ErrorCode.NOT_FOUND))
            .when(courseCatalog).requireExistingCourse(99005L);
        String publishPath = path + "/" + draftId + "/publish";
        error(send("PATCH", publishPath, admin, null), 404, "NOT_FOUND", publishPath);
    }

    @Test
    void simultaneousStartsShareAttemptAndOnlyOneSubmissionIsGraded() throws Exception {
        String admin = tokenFor("ADMIN", 230L);
        String learner = tokenFor("USER", 231L);
        String definition = """
            {"courseId":99003,"title":"Concurrent quiz","passingScore":70,"questions":[
             {"questionText":"Pick one","questionType":"SINGLE_CHOICE","points":1,
              "options":[{"optionText":"A","correct":true},{"optionText":"B","correct":false}]}]}
            """;
        long quizId = mapper.readTree(send("POST", "/api/v1/learning/admin/quizzes", admin, definition)
            .body()).get("data").get("id").asLong();
        send("PATCH", "/api/v1/learning/admin/quizzes/" + quizId + "/publish", admin, null);
        send("POST", "/api/v1/learning/enrollments", learner, "{\"courseId\":99003}");
        var quiz = mapper.readTree(send("GET", "/api/v1/learning/quizzes/" + quizId, learner, null)
            .body()).get("data");
        long questionId = quiz.get("questions").get(0).get("id").asLong();
        long optionId = quiz.get("questions").get(0).get("options").get(0).get("id").asLong();

        try (var executor = Executors.newFixedThreadPool(2)) {
            CountDownLatch begin = new CountDownLatch(1);
            String startPath = "/api/v1/learning/quizzes/" + quizId + "/attempts";
            var firstStart = executor.submit(() -> {
                begin.await();
                return send("POST", startPath, learner, null);
            });
            var secondStart = executor.submit(() -> {
                begin.await();
                return send("POST", startPath, learner, null);
            });
            begin.countDown();
            var first = firstStart.get(10, TimeUnit.SECONDS);
            var second = secondStart.get(10, TimeUnit.SECONDS);
            assertThat(first.statusCode()).isEqualTo(200);
            assertThat(second.statusCode()).isEqualTo(200);
            long attemptId = mapper.readTree(first.body()).get("data").get("attemptId").asLong();
            assertThat(mapper.readTree(second.body()).get("data").get("attemptId").asLong())
                .isEqualTo(attemptId);

            String submitPath = "/api/v1/learning/quizzes/attempts/" + attemptId + "/submit";
            String answers = """
                {"answers":[{"questionId":%d,"optionIds":[%d]}]}
                """.formatted(questionId, optionId);
            CountDownLatch submit = new CountDownLatch(1);
            var firstSubmit = executor.submit(() -> {
                submit.await();
                return send("POST", submitPath, learner, answers);
            });
            var secondSubmit = executor.submit(() -> {
                submit.await();
                return send("POST", submitPath, learner, answers);
            });
            submit.countDown();
            var statuses = List.of(
                firstSubmit.get(10, TimeUnit.SECONDS).statusCode(),
                secondSubmit.get(10, TimeUnit.SECONDS).statusCode()
            );
            assertThat(statuses).containsExactlyInAnyOrder(200, 409);
        }
    }

    @Test
    void preservesPaginationMetadata() {
        var page = PageResponse.from(new PageImpl<>(List.of("item"), PageRequest.of(1, 2), 3));
        assertThat(page.page()).isEqualTo(1);
        assertThat(page.totalPages()).isEqualTo(2);
        assertThat(page.last()).isTrue();
    }

    @Test
    void rejectsWrongSignatureIssuerTypeAndMissingExpiry() {
        var key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String noExpiry = Jwts.builder()
            .subject("u")
            .issuer("sgedu")
            .claim("role", "USER")
            .claim("tokenType", "access")
            .issuedAt(new Date())
            .signWith(key)
            .compact();
        assertThatThrownBy(() -> tokens.validate(noExpiry)).isInstanceOf(JwtException.class);
        String wrongIssuer = Jwts.builder().subject("u").issuer("other").signWith(key).compact();
        assertThatThrownBy(() -> tokens.validate(wrongIssuer)).isInstanceOf(JwtException.class);
        String wrongType = Jwts.builder()
            .subject("u")
            .issuer("sgedu")
            .claim("tokenType", "refresh")
            .signWith(key)
            .compact();
        assertThatThrownBy(() -> tokens.validate(wrongType)).isInstanceOf(JwtException.class);
        var otherKey = Jwts.SIG.HS256.key().build();
        String wrongSignature = Jwts.builder().subject("u").signWith(otherKey).compact();
        assertThatThrownBy(() -> tokens.validate(wrongSignature)).isInstanceOf(JwtException.class);
    }

    @TestConfiguration
    static class Probes {

        @Bean
        ProbeController probeController() {
            return new ProbeController();
        }
    }

    @RestController
    @RequestMapping(BASE)
    static class ProbeController {

        record Input(@NotBlank String name) {}

        @GetMapping
        ApiResponse<?> success() {
            return ApiResponse.success(Map.of("ready", true));
        }

        @PostMapping
        ApiResponse<?> input(@Valid @RequestBody Input input) {
            return ApiResponse.success(input);
        }

        @GetMapping("/admin")
        @PreAuthorize("hasRole('ADMIN')")
        public ApiResponse<?> admin() {
            return success();
        }

        @GetMapping("/conflict")
        ApiResponse<?> conflict() {
            throw new AppException(ErrorCode.CONFLICT);
        }

        @GetMapping("/failure")
        ApiResponse<?> failure() {
            throw new IllegalStateException("sensitive-test-detail");
        }
    }
}
