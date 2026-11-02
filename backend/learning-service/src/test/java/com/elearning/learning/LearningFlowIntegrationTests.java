package com.elearning.learning;

import static org.assertj.core.api.Assertions.assertThat;

import com.elearning.learning.dto.PaymentEnrollmentRequest;
import com.elearning.learning.entity.enums.EnrollmentStatus;
import com.elearning.learning.repository.EnrollmentRepository;
import com.elearning.learning.repository.NotificationRepository;
import com.elearning.learning.service.LearningService;
import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = { "logging.level.root=WARN", "logging.level.org.springframework=WARN" }
)
@ActiveProfiles("test")
class LearningFlowIntegrationTests {

    private static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();
    private static final String INTERNAL_TOKEN = "test-internal-service-token-1234567890";
    private static final String EVENT_KEY = "test-course-event-key";
    private static final String BASE = "/api/v1/learning";
    private static final String PAID = "/internal/v1/learning/enrollments";
    private static final AtomicLong USERS = new AtomicLong(System.currentTimeMillis());
    private static final HttpServer COURSES = courseServer();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
        registry.add("course.service-url", () -> "http://127.0.0.1:" + COURSES.getAddress().getPort());
        registry.add("notifications.events.api-key", () -> EVENT_KEY);
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:learningFlows;MODE=MySQL;DB_CLOSE_DELAY=-1");
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

    @AfterAll
    static void stopCourseServer() {
        COURSES.stop(0);
    }

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper mapper;

    @Autowired
    EnrollmentRepository enrollments;

    @Autowired
    NotificationRepository notifications;

    @Autowired
    LearningService learning;

    @Autowired
    TransactionTemplate transaction;

    @Autowired
    JdbcTemplate jdbc;

    private final HttpClient client = HttpClient.newHttpClient();

    private String token(long user, String role) {
        return Jwts.builder()
            .subject(Long.toString(user))
            .issuer("sgedu")
            .claim("role", role)
            .claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now()))
            .expiration(Date.from(Instant.now().plusSeconds(120)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();
    }

    private HttpResponse<String> send(
        String method,
        String path,
        String bearer,
        String body,
        String header,
        String key
    ) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).timeout(
            java.time.Duration.ofSeconds(10)
        );
        if (bearer != null) request.header("Authorization", "Bearer " + bearer);
        if (header != null && key != null) request.header(header, key);
        if (body != null) request.header("Content-Type", "application/json");
        request.method(
            method,
            body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)
        );
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> api(String method, String path, long user, String body) throws Exception {
        return send(method, BASE + path, token(user, "USER"), body, null, null);
    }

    private HttpResponse<String> paid(String order, long user, long course) throws Exception {
        return send(
            "POST",
            PAID,
            null,
            paymentBody(order, user, course),
            "X-Internal-Service-Token",
            INTERNAL_TOKEN
        );
    }

    private String paymentBody(String order, long user, long course) {
        return "{\"orderCode\":\"%s\",\"userId\":%d,\"courseId\":%d}".formatted(order, user, course);
    }

    private JsonNode data(HttpResponse<String> response) throws Exception {
        assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(200);
        return mapper.readTree(response.body()).get("data");
    }

    @Test
    void enrollmentCheckRequiresTheSameJwtOwnerAndIgnoresForgedIdentityHeaders() throws Exception {
        long owner = USERS.incrementAndGet();
        long stranger = USERS.incrementAndGet();
        String ownerCheck = BASE + "/enrollments/check?userId=" + owner + "&courseId=801";
        String strangerCheck = BASE + "/enrollments/check?userId=" + stranger + "&courseId=801";
        assertThat(send("GET", ownerCheck, null, null, null, null).statusCode()).isEqualTo(401);
        assertThat(send("GET", ownerCheck, null, null, "X-User-Id", Long.toString(owner)).statusCode())
            .isEqualTo(401);
        var unenrolled = data(send("GET", ownerCheck, token(owner, "USER"), null, null, null));
        assertThat(unenrolled.get("enrolled").asBoolean()).isFalse();
        assertThat(unenrolled.get("userId").asLong()).isEqualTo(owner);
        assertThat(unenrolled.get("courseId").asLong()).isEqualTo(801);
        assertThat(unenrolled.get("status").isNull()).isTrue();

        data(api("POST", "/enrollments", owner, "{\"courseId\":801}"));
        // Course forwards the caller's JWT with these existing query parameters.
        var enrolled = data(send("GET", ownerCheck, token(owner, "USER"), null,
            "X-Request-ID", "course-enrollment-check-c11"));
        assertThat(enrolled.get("enrolled").asBoolean()).isTrue();
        assertThat(enrolled.get("status").asString()).isEqualTo("ACTIVE");
        assertThat(send("GET", ownerCheck, token(stranger, "USER"), null,
            "X-User-Id", Long.toString(owner)).statusCode()).isEqualTo(403);
        assertThat(send("GET", strangerCheck, token(owner, "USER"), null,
            "X-User-Id", Long.toString(stranger)).statusCode()).isEqualTo(403);
        assertThat(send("GET", ownerCheck, token(stranger, "ADMIN"), null, null, null).statusCode())
            .isEqualTo(403);
    }

    @Test
    void coreFlowUsesActualCurriculumCompletesEnrollmentAndGradesQuiz() throws Exception {
        long user = USERS.incrementAndGet();
        assertThat(api("GET", "/courses/801", user, null).statusCode()).isEqualTo(403);
        long enrollment = data(api("POST", "/enrollments", user, "{\"courseId\":801}"))
            .get("id")
            .asLong();
        assertThat(
            data(api("POST", "/enrollments", user, "{\"courseId\":801}"))
                .get("id")
                .asLong()
        ).isEqualTo(enrollment);
        var course = data(api("GET", "/courses/801", user, null));
        assertThat(course.get("totalLessons").asInt()).isEqualTo(2);
        assertThat(course.get("sections").get(0).get("lessons").get(0).get("id").asLong()).isEqualTo(8101);
        assertThat(api("POST", "/progress/courses/801/lessons/1/access", user, null).statusCode()).isEqualTo(
            404
        );
        assertThat(
            api("PATCH", "/progress/courses/801/lessons/9999/complete", user, null).statusCode()
        ).isEqualTo(404);
        assertThat(
            data(api("POST", "/progress/courses/801/lessons/8101/access", user, null))
                .get("status")
                .asString()
        ).isEqualTo("IN_PROGRESS");
        var complete = data(api("PATCH", "/progress/courses/801/lessons/8101/complete", user, null));
        assertThat(
            data(api("PATCH", "/progress/courses/801/lessons/8101/complete", user, null)).get("completedAt")
        ).isEqualTo(complete.get("completedAt"));
        assertThat(
            data(api("GET", "/courses/801", user, null))
                .get("progressPercent")
                .asInt()
        ).isEqualTo(50);
        data(api("PATCH", "/progress/courses/801/lessons/8102/complete", user, null));
        assertThat(
            data(api("GET", "/courses/801", user, null))
                .get("progressPercent")
                .asInt()
        ).isEqualTo(100);
        assertThat(enrollments.findById(enrollment).orElseThrow().getStatus()).isEqualTo(
            EnrollmentStatus.COMPLETED
        );
        assertThat(
            data(api("POST", "/enrollments", user, "{\"courseId\":801}"))
                .get("status")
                .asString()
        ).isEqualTo("COMPLETED");

        String definition = """
        {"courseId":801,"title":"Core flow quiz","passingScore":70,"questions":[
        {"questionText":"Choose Java","questionType":"SINGLE_CHOICE","points":1,
        "options":[{"optionText":"Java","correct":true},{"optionText":"Other","correct":false}]}]}
        """;
        var created = send("POST", BASE + "/admin/quizzes", token(user, "ADMIN"), definition, null, null);
        assertThat(created.statusCode()).withFailMessage(created.body()).isEqualTo(201);
        long quiz = mapper.readTree(created.body()).get("data").get("id").asLong();
        data(
            send(
                "PATCH",
                BASE + "/admin/quizzes/" + quiz + "/publish",
                token(user, "ADMIN"),
                null,
                null,
                null
            )
        );
        var questions = data(api("GET", "/quizzes/" + quiz, user, null)).get("questions");
        long attempt = data(api("POST", "/quizzes/" + quiz + "/attempts", user, null))
            .get("attemptId")
            .asLong();
        String answers = "{\"answers\":[{\"questionId\":%d,\"optionIds\":[%d]}]}".formatted(
            questions.get(0).get("id").asLong(),
            questions.get(0).get("options").get(0).get("id").asLong()
        );
        var result = data(api("POST", "/quizzes/attempts/" + attempt + "/submit", user, answers));
        assertThat(result.get("score").asInt()).isEqualTo(100);
        assertThat(result.get("passed").asBoolean()).isTrue();
        assertThat(
            data(api("GET", "/quizzes/attempts/" + attempt + "/review", user, null))
                .get("questions")
                .get(0)
                .get("correct")
                .asBoolean()
        ).isTrue();
        assertThat(
            api("GET", "/quizzes/attempts/" + attempt + "/review", USERS.incrementAndGet(), null).statusCode()
        ).isEqualTo(404);
        var dashboard = data(api("GET", "/dashboard", user, null));
        assertThat(dashboard.get("completedEnrollments").asInt()).isEqualTo(1);
        assertThat(dashboard.get("completedLessons").asInt()).isEqualTo(2);
        assertThat(notifications.countByUserIdAndReadAtIsNull(user)).isEqualTo(4);
    }

    @Test
    void paidEnrollmentAuthenticatesBindsEveryOrderAndCreatesPaymentNotificationOnce() throws Exception {
        long user = USERS.incrementAndGet();
        String order = "PAID-" + user;
        assertThat(api("POST", "/enrollments", user, "{\"courseId\":802}").statusCode()).isEqualTo(403);
        assertThat(
            send("POST", PAID, token(user, "USER"), paymentBody(order, user, 802), null, null).statusCode()
        ).isEqualTo(401);
        var first = data(paid(order, user, 802));
        assertThat(Instant.parse(first.get("enrolledAt").asString())).isBetween(
            Instant.now().minusSeconds(30),
            Instant.now().plusSeconds(30)
        );
        assertThat(data(paid(order, user, 802)).get("id")).isEqualTo(first.get("id"));
        assertThat(
            data(api("GET", "/courses/802", user, null))
                .get("courseId")
                .asLong()
        ).isEqualTo(802);
        assertThat(notifications.countByUserIdAndReadAtIsNull(user)).isEqualTo(2);
        var payment = data(api("GET", "/notifications/feed?category=PAYMENT", user, null));
        assertThat(payment.get("totalElements").asLong()).isEqualTo(1);
        assertThat(Instant.parse(payment.get("content").get(0).get("createdAt").asString())).isBetween(
            Instant.now().minusSeconds(30),
            Instant.now().plusSeconds(30)
        );
        assertThat(payment.get("content").get(0).get("actionUrl").asString()).isEqualTo(
            "/payment/result?orderCode=" + order
        );
        assertThat(paid(order, USERS.incrementAndGet(), 802).statusCode()).isEqualTo(409);
        assertThat(paid(order, user, 801).statusCode()).isEqualTo(409);

        String secondOrder = "SECOND-" + user;
        assertThat(data(paid(secondOrder, user, 802)).get("id")).isEqualTo(first.get("id"));
        data(paid(secondOrder, user, 802));
        assertThat(paid(secondOrder, USERS.incrementAndGet(), 802).statusCode()).isEqualTo(409);
        assertThat(enrollments.findByUserIdOrderByLastAccessedAtDescEnrolledAtDesc(user)).hasSize(1);
        assertThat(notifications.countByUserIdAndReadAtIsNull(user)).isEqualTo(3);
    }

    @Test
    void simultaneousPaymentRetriesAndCompletionsDoNotDuplicateBusinessRows() throws Exception {
        long user = USERS.incrementAndGet();
        try (var executor = Executors.newFixedThreadPool(6)) {
            CountDownLatch start = new CountDownLatch(1);
            var calls = java.util.stream.IntStream.range(0, 6)
                .mapToObj(index ->
                    executor.submit(() -> {
                        start.await();
                        return paid("CONCURRENT-" + user, user, 802);
                    })
                )
                .toList();
            start.countDown();
            Long id = null;
            for (var call : calls) {
                long current = data(call.get(15, TimeUnit.SECONDS)).get("id").asLong();
                if (id == null) id = current;
                assertThat(current).isEqualTo(id);
            }
            var first = executor.submit(() ->
                api("PATCH", "/progress/courses/802/lessons/8201/complete", user, null)
            );
            var second = executor.submit(() ->
                api("PATCH", "/progress/courses/802/lessons/8202/complete", user, null)
            );
            data(first.get(15, TimeUnit.SECONDS));
            data(second.get(15, TimeUnit.SECONDS));
        }
        assertThat(enrollments.findByUserIdOrderByLastAccessedAtDescEnrolledAtDesc(user)).hasSize(1);
        assertThat(enrollments.findByUserIdAndCourseId(user, 802L).orElseThrow().getStatus()).isEqualTo(
            EnrollmentStatus.COMPLETED
        );
        assertThat(notifications.countByUserIdAndReadAtIsNull(user)).isEqualTo(4);
    }

    @Test
    void simultaneousFreeEnrollmentRetriesAreIdempotent() throws Exception {
        long user = USERS.incrementAndGet();
        try (var executor = Executors.newFixedThreadPool(4)) {
            var calls = java.util.stream.IntStream.range(0, 4)
                .mapToObj(index ->
                    executor.submit(() -> api("POST", "/enrollments", user, "{\"courseId\":801}"))
                )
                .toList();
            for (var call : calls) data(call.get(15, TimeUnit.SECONDS));
        }
        assertThat(enrollments.findByUserIdOrderByLastAccessedAtDescEnrolledAtDesc(user)).hasSize(1);
        assertThat(notifications.countByUserIdAndReadAtIsNull(user)).isEqualTo(1);
    }

    @Test
    void rollbackRemovesEnrollmentReceiptAndBothNotifications() {
        long user = USERS.incrementAndGet();
        String order = "ROLLBACK-" + user;
        transaction.executeWithoutResult(status -> {
            learning.enrollFromPayment(new PaymentEnrollmentRequest(order, user, 802L));
            status.setRollbackOnly();
        });
        assertThat(enrollments.findByUserIdAndCourseId(user, 802L)).isEmpty();
        assertThat(notifications.countByUserIdAndReadAtIsNull(user)).isZero();
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM payment_enrollment_receipts WHERE order_code = ?",
                Long.class,
                order
            )
        ).isZero();
    }

    @Test
    void courseFailuresAndNotificationOnlyEventsDoNotInventLearningAccess() throws Exception {
        long user = USERS.incrementAndGet();
        data(paid("UNAVAILABLE-" + user, user, 900));
        assertThat(
            api("PATCH", "/progress/courses/900/lessons/9001/complete", user, null).statusCode()
        ).isEqualTo(503);
        assertThat(data(api("GET", "/progress/courses/900", user, null))).hasSize(0);
        assertThat(notifications.countByUserIdAndReadAtIsNull(user)).isEqualTo(2);
        long other = USERS.incrementAndGet();
        String event =
            "{\"eventId\":\"FAILED-%d\",\"userId\":%d,\"type\":\"PAYMENT_FAILED\",\"orderCode\":\"FAIL-%d\"}".formatted(
                other,
                other,
                other
            );
        data(send("POST", "/internal/v1/notifications/events", null, event, "X-Notification-Key", EVENT_KEY));
        data(send("POST", "/internal/v1/notifications/events", null, event, "X-Notification-Key", EVENT_KEY));
        assertThat(notifications.countByUserIdAndReadAtIsNull(other)).isEqualTo(1);
        assertThat(api("GET", "/courses/802", other, null).statusCode()).isEqualTo(403);
        assertThat(
            send(
                "POST",
                PAID,
                null,
                "{\"orderCode\":\"X\",\"userId\":-1,\"courseId\":802}",
                "X-Internal-Service-Token",
                INTERNAL_TOKEN
            ).statusCode()
        ).isEqualTo(400);
    }

    @Test
    void cancelledFreeAndPaidEnrollmentsCannotRestoreOrUseLearningAccess() throws Exception {
        long user = USERS.incrementAndGet();
        data(api("POST", "/enrollments", user, "{\"courseId\":801}"));
        String order = "CANCELLED-" + user;
        data(paid(order, user, 802));
        transaction.executeWithoutResult(status -> {
            for (long course : new long[] {801, 802}) {
                var enrollment = enrollments.findByUserIdAndCourseId(user, course).orElseThrow();
                enrollment.setStatus(EnrollmentStatus.CANCELLED);
                enrollments.save(enrollment);
            }
        });
        assertThat(api("POST", "/enrollments", user, "{\"courseId\":801}").statusCode()).isEqualTo(409);
        assertThat(paid(order, user, 802).statusCode()).isEqualTo(409);
        assertThat(paid("NEW-" + order, user, 802).statusCode()).isEqualTo(409);
        for (long course : new long[] {801, 802}) {
            long lesson = course == 801 ? 8101 : 8201;
            assertThat(api("GET", "/courses/" + course, user, null).statusCode()).isEqualTo(403);
            assertThat(api("GET", "/progress/courses/" + course, user, null).statusCode()).isEqualTo(403);
            assertThat(api("GET", "/courses/" + course + "/quizzes", user, null).statusCode()).isEqualTo(403);
            assertThat(api("POST", "/progress/courses/" + course + "/lessons/" + lesson + "/access", user, null)
                .statusCode()).isEqualTo(403);
            assertThat(api("PATCH", "/progress/courses/" + course + "/lessons/" + lesson + "/complete", user, null)
                .statusCode()).isEqualTo(403);
        }
        assertThat(notifications.countByUserIdAndReadAtIsNull(user)).isEqualTo(3);
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM payment_enrollment_receipts WHERE order_code = ?", Long.class, "NEW-" + order
        )).isZero();
    }

    @Test
    void everyExternalPaymentStatusIsNotificationOnlyAndCannotEnrollTheRecipient() throws Exception {
        for (String type : List.of("PAYMENT_SUCCESS", "PAYMENT_FAILED", "PAYMENT_CANCELLED", "PAYMENT_REFUNDED")) {
            long user = USERS.incrementAndGet();
            String body = """
                {"eventId":"C11-%d","userId":%d,"type":"%s","orderCode":"C11-ORDER-%d"}
                """.formatted(user, user, type, user);
            data(send("POST", "/internal/v1/notifications/events", null, body, "X-Notification-Key", EVENT_KEY));
            data(send("POST", "/internal/v1/notifications/events", null, body, "X-Notification-Key", EVENT_KEY));
            assertThat(enrollments.findByUserIdAndCourseId(user, 802L)).isEmpty();
            assertThat(api("GET", "/courses/802", user, null).statusCode()).isEqualTo(403);
            assertThat(notifications.countByUserIdAndReadAtIsNull(user)).isEqualTo(1);
        }
    }

    private static HttpServer courseServer() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/api/v1/courses/", exchange -> {
                String[] parts = exchange.getRequestURI().getPath().split("/");
                long course = Long.parseLong(parts[4]);
                boolean sections = parts.length > 5;
                int status = course == 900 ? 503 : course == 404 ? 404 : 200;
                long section = course * 10;
                long lessonBase = (course - 800) * 100 + 8000;
                String body = sections
                    ? """
                      {"success":true,"data":[{"id":%d,"courseId":%d,"title":"Real section","orderIndex":0,"lessons":[
                      {"id":%d,"sectionId":%d,"title":"First lesson","lessonType":"TEXT","content":"Content","orderIndex":0,"preview":false},
                      {"id":%d,"sectionId":%d,"title":"Second lesson","lessonType":"TEXT","content":"Content","orderIndex":1,"preview":false}]}]}
                      """.formatted(section, course, lessonBase + 1, section, lessonBase + 2, section)
                    : "{\"success\":true,\"data\":{\"id\":%d,\"title\":\"Course fixture\",\"price\":%d,\"status\":\"PUBLISHED\"}}".formatted(
                          course,
                          course == 802 ? 100000 : 0
                      );
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(status, bytes.length);
                try (var output = exchange.getResponseBody()) {
                    output.write(bytes);
                }
            });
            server.start();
            return server;
        } catch (Exception exception) {
            throw new ExceptionInInitializerError(exception);
        }
    }
}
