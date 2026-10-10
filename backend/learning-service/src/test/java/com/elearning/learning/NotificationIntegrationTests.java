package com.elearning.learning;

import static org.assertj.core.api.Assertions.assertThat;

import com.elearning.learning.dto.NotificationEventRequest;
import com.elearning.learning.entity.Notification;
import com.elearning.learning.entity.enums.NotificationType;
import com.elearning.learning.repository.NotificationRepository;
import com.elearning.learning.service.CourseCatalogClient;
import com.elearning.learning.service.NotificationService;
import com.elearning.learning.service.NotificationStreamService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "notifications.sse.heartbeat-ms=100", "notifications.sse.max-duration-ms=4000",
    "logging.level.root=WARN", "logging.level.org.springframework=WARN"
})
@ActiveProfiles("test")
class NotificationIntegrationTests {

    private static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();
    private static final String KEY = UUID.randomUUID().toString();
    private static final String BASE = "/api/v1/learning/notifications";
    private static final String EVENTS = "/internal/v1/notifications/events";
    private static final AtomicLong USERS = new AtomicLong(500000);
    private final HttpClient client = HttpClient.newHttpClient();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
        registry.add("notifications.events.api-key", () -> KEY);
        String mysqlUrl = System.getenv("NOTIFICATION_TEST_MYSQL_URL");
        if (mysqlUrl != null && !mysqlUrl.isBlank()) {
            registry.add("spring.datasource.url", () -> mysqlUrl);
            registry.add("spring.datasource.username", () -> System.getenv("NOTIFICATION_TEST_MYSQL_USER"));
            registry.add("spring.datasource.password", () -> System.getenv("NOTIFICATION_TEST_MYSQL_PASSWORD"));
            registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
            registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
            registry.add("spring.flyway.placeholders.notificationCheckKeyword", () -> "CHECK");
            registry.add("spring.flyway.placeholders.notificationEventKeyCollation",
                () -> "CHARACTER SET utf8mb4 COLLATE utf8mb4_bin");
        }
    }

    @LocalServerPort int port;
    @Autowired JsonMapper mapper;
    @Autowired NotificationRepository repository;
    @Autowired NotificationService notifications;
    @Autowired NotificationStreamService streams;
    @Autowired TransactionTemplate transaction;
    @MockitoBean CourseCatalogClient courseCatalog;

    private String token(Long user, long seconds) {
        return Jwts.builder().subject(user.toString()).issuer("learnsphere")
            .claim("role", "USER").claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now())).expiration(Date.from(Instant.now().plusSeconds(seconds)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
    }

    private HttpResponse<String> send(String method, String path, Long user, String body, String key)
        throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (user != null) builder.header("Authorization", "Bearer " + token(user, 60));
        if (key != null) builder.header("X-Notification-Key", key);
        if (body != null) builder.header("Content-Type", "application/json");
        builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() :
            HttpRequest.BodyPublishers.ofString(body));
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode data(HttpResponse<String> response) throws Exception {
        assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(200);
        return mapper.readTree(response.body()).get("data");
    }

    private Notification seed(Long user, NotificationType type, Instant created) {
        Notification n = new Notification();
        n.setUserId(user);
        n.setType(type);
        n.setTitle("Thông báo kiểm tra");
        n.setBody("Nội dung");
        n.setCreatedAt(created);
        return repository.saveAndFlush(n);
    }

    @Test
    void feedPreservesLegacyTypesOrdersTiesAndCountsBeyondTwenty() throws Exception {
        long owner = USERS.incrementAndGet();
        Instant now = Instant.now();
        for (int i = 0; i < 25; i++) seed(owner, NotificationType.ENROLLMENT, now);
        seed(USERS.incrementAndGet(), NotificationType.PAYMENT_SUCCESS, now.plusSeconds(1));
        var first = data(send("GET", BASE + "/feed?category=COURSE&size=10", owner, null, null));
        assertThat(first.get("totalElements").asLong()).isEqualTo(25);
        assertThat(first.get("totalPages").asInt()).isEqualTo(3);
        assertThat(first.get("last").asBoolean()).isFalse();
        assertThat(first.get("content").size()).isEqualTo(10);
        assertThat(first.get("content").get(0).get("category").asString()).isEqualTo("COURSE");
        assertThat(first.get("content").get(0).get("id").asLong())
            .isGreaterThan(first.get("content").get(1).get("id").asLong());
        assertThat(data(send("GET", BASE, owner, null, null)).size()).isEqualTo(20);
        var summary = data(send("GET", BASE + "/summary", owner, null, null));
        assertThat(summary.get("unreadCount").asLong()).isEqualTo(25);
        assertThat(summary.get("notifications").size()).isEqualTo(5);
        for (String query : new String[]{"?page=-1", "?size=0", "?size=101", "?category=UNKNOWN"}) {
            assertThat(send("GET", BASE + "/feed" + query, owner, null, null).statusCode()).isEqualTo(400);
        }
        assertThat(send("GET", BASE + "/summary", null, null, null).statusCode()).isEqualTo(401);
    }

    @Test
    void readsAreOwnedIdempotentAndBulkReadDoesNotTouchAnotherUser() throws Exception {
        long owner = USERS.incrementAndGet();
        long stranger = USERS.incrementAndGet();
        var n = seed(owner, NotificationType.QUIZ, Instant.now());
        seed(stranger, NotificationType.SYSTEM, Instant.now());
        String path = BASE + "/" + n.getId() + "/read";
        assertThat(send("PATCH", path, stranger, null, null).statusCode()).isEqualTo(404);
        var read = data(send("PATCH", path, owner, null, null));
        assertThat(read.get("read").asBoolean()).isTrue();
        assertThat(read.get("category").asString()).isEqualTo("LEARNING");
        assertThat(data(send("PATCH", path, owner, null, null)).get("readAt")).isEqualTo(read.get("readAt"));
        seed(owner, NotificationType.PROGRESS, Instant.now());
        assertThat(data(send("GET", BASE + "/feed?unreadOnly=true", owner, null, null))
            .get("totalElements").asLong()).isEqualTo(1);
        assertThat(data(send("PATCH", BASE + "/read-all", owner, null, null))
            .get("unreadCount").asLong()).isZero();
        assertThat(data(send("PATCH", BASE + "/read-all", owner, null, null))
            .get("unreadCount").asLong()).isZero();
        assertThat(repository.countByUserIdAndReadAtIsNull(stranger)).isEqualTo(1);
    }

    @Test
    void receiverRequiresItsKeyValidatesPayloadAndPreservesReadStateOnRetry() throws Exception {
        long user = USERS.incrementAndGet();
        String event = "{\"eventId\":\"payment-1\",\"userId\":" + user +
            ",\"type\":\"PAYMENT_SUCCESS\",\"orderCode\":\"ORDER-1\"}";
        assertThat(send("POST", EVENTS, user, event, null).statusCode()).isEqualTo(401);
        assertThat(send("POST", EVENTS, user, event, "wrong").statusCode()).isEqualTo(401);
        var created = data(send("POST", EVENTS, null, event, KEY));
        assertThat(created.get("category").asString()).isEqualTo("PAYMENT");
        assertThat(created.get("actionUrl").asString()).isEqualTo("/payment/result?orderCode=ORDER-1");
        data(send("PATCH", BASE + "/" + created.get("id").asLong() + "/read", user, null, null));
        var duplicate = data(send("POST", EVENTS, null, event, KEY));
        assertThat(duplicate.get("id")).isEqualTo(created.get("id"));
        assertThat(duplicate.get("read").asBoolean()).isTrue();
        assertThat(duplicate.get("createdAt")).isEqualTo(created.get("createdAt"));
        for (String invalid : new String[]{
            event.replace("PAYMENT_SUCCESS", "QUIZ"),
            event.replace("ORDER-1", ""),
            event.replace("\"userId\":" + user, "\"userId\":-1"),
            "{\"eventId\":\"course-1\",\"userId\":" + user + ",\"type\":\"COURSE_ENROLLED\"}"
        }) {
            assertThat(send("POST", EVENTS, null, invalid, KEY).statusCode()).isEqualTo(400);
        }
        for (String type : new String[]{"PAYMENT_FAILED", "PAYMENT_CANCELLED", "PAYMENT_REFUNDED"}) {
            assertThat(data(send("POST", EVENTS, null, event.replace("PAYMENT_SUCCESS", type), KEY))
                .get("type").asString()).isEqualTo(type);
        }
        String course = "{\"eventId\":\"course-1\",\"userId\":" + user +
            ",\"type\":\"COURSE_ENROLLED\",\"courseId\":42}";
        assertThat(data(send("POST", EVENTS, null, course, KEY)).get("actionUrl").asString())
            .isEqualTo("/learning/42");
    }

    @Test
    void concurrentEventRetriesCreateOneNotification() throws Exception {
        long user = USERS.incrementAndGet();
        String event = "{\"eventId\":\"concurrent\",\"userId\":" + user +
            ",\"type\":\"PAYMENT_FAILED\",\"orderCode\":\"ORDER-2\"}";
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var futures = java.util.stream.IntStream.range(0, 6)
                .mapToObj(i -> executor.submit(() -> send("POST", EVENTS, null, event, KEY))).toList();
            Long id = null;
            for (var future : futures) {
                long result = data(future.get(5, TimeUnit.SECONDS)).get("id").asLong();
                if (id == null) id = result;
                assertThat(result).isEqualTo(id);
            }
        }
        assertThat(repository.countByUserIdAndReadAtIsNull(user)).isEqualTo(1);
    }

    @Test
    void learningTransitionsCreateOneNotificationForEachSuccessfulEvent() throws Exception {
        long user = USERS.incrementAndGet();
        String enroll = "/api/v1/learning/enrollments";
        data(send("POST", enroll, user, "{\"courseId\":42}", null));
        data(send("POST", enroll, user, "{\"courseId\":42}", null));
        String complete = "/api/v1/learning/progress/courses/42/lessons/8/complete";
        data(send("PATCH", complete, user, null, null));
        data(send("PATCH", complete, user, null, null));
        assertThat(repository.countByUserIdAndReadAtIsNull(user)).isEqualTo(2);
        var items = data(send("GET", BASE, user, null, null));
        assertThat(items.get(0).get("type").asString()).isEqualTo("LESSON_COMPLETED");
        assertThat(items.get(1).get("type").asString()).isEqualTo("COURSE_ENROLLED");
        assertThat(send("PATCH", complete, USERS.incrementAndGet(), null, null).statusCode()).isEqualTo(403);
    }

    @Test
    void streamPublishesOnlyCommittedChangesToItsOwnerAndCleansUp() throws Exception {
        long owner = USERS.incrementAndGet();
        long stranger = USERS.incrementAndGet();
        try (var mine = stream(owner, 60); var other = stream(stranger, 60)) {
            assertThat(mine.events.poll(2, TimeUnit.SECONDS)).isEqualTo("connected");
            assertThat(other.events.poll(2, TimeUnit.SECONDS)).isEqualTo("connected");
            transaction.executeWithoutResult(status -> {
                notifications.receive(new NotificationEventRequest(
                    "rolled-back", owner, NotificationType.PAYMENT_SUCCESS, null, "ROLLBACK"
                ));
                status.setRollbackOnly();
            });
            assertThat(repository.countByUserIdAndReadAtIsNull(owner)).isZero();
            assertThat(mine.events.poll(250, TimeUnit.MILLISECONDS)).isNull();
            notifications.receive(new NotificationEventRequest(
                "committed", owner, NotificationType.PAYMENT_SUCCESS, null, "COMMIT"
            ));
            assertThat(mine.events.poll(2, TimeUnit.SECONDS)).isEqualTo("notifications-changed");
            assertThat(other.events.poll(250, TimeUnit.MILLISECONDS)).isNull();
            assertThat(mine.heartbeats.get()).isPositive();
            long id = data(send("GET", BASE, owner, null, null)).get(0).get("id").asLong();
            data(send("PATCH", BASE + "/" + id + "/read", owner, null, null));
            assertThat(mine.events.poll(2, TimeUnit.SECONDS)).isEqualTo("notifications-changed");
        }
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
        while (streams.connectionCount(owner) > 0 && System.nanoTime() < deadline) Thread.sleep(25);
        assertThat(streams.connectionCount(owner)).isZero();
    }

    @Test
    void streamClosesAtTokenExpiryAndRejectsMissingAuthentication() throws Exception {
        assertThat(send("GET", BASE + "/stream", null, null, null).statusCode()).isEqualTo(401);
        long user = USERS.incrementAndGet();
        try (var stream = stream(user, 2)) {
            assertThat(stream.events.poll(1, TimeUnit.SECONDS)).isEqualTo("connected");
            assertThat(stream.events.poll(3, TimeUnit.SECONDS)).isEqualTo("closed");
            assertThat(streams.connectionCount(user)).isZero();
        }
    }

    private LiveStream stream(Long user, long seconds) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + BASE + "/stream"))
            .header("Authorization", "Bearer " + token(user, seconds))
            .header("Accept", "text/event-stream").build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("content-type").orElse("")).contains("text/event-stream");
        return new LiveStream(response.body());
    }

    private static final class LiveStream implements AutoCloseable {
        private final InputStream body;
        private final BlockingQueue<String> events = new LinkedBlockingQueue<>();
        private final AtomicLong heartbeats = new AtomicLong();

        private LiveStream(InputStream body) {
            this.body = body;
            Thread.startVirtualThread(() -> {
                try (var reader = new BufferedReader(new InputStreamReader(body, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (line.startsWith("event:")) events.add(line.substring(6).strip());
                        if (line.startsWith(":heartbeat")) heartbeats.incrementAndGet();
                    }
                } catch (Exception ignored) {
                    // Client cancellation is expected during stream cleanup.
                } finally {
                    events.add("closed");
                }
            });
        }

        @Override
        public void close() throws Exception {
            body.close();
        }
    }
}
