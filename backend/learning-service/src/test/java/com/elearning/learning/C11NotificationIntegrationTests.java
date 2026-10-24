package com.elearning.learning;

import static org.assertj.core.api.Assertions.assertThat;

import com.elearning.learning.dto.AdminNotificationRequest;
import com.elearning.learning.entity.Notification;
import com.elearning.learning.entity.enums.NotificationType;
import com.elearning.learning.repository.NotificationRepository;
import com.elearning.learning.service.NotificationService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
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
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "logging.level.root=WARN", "logging.level.org.springframework=WARN"
})
@ActiveProfiles("test")
class C11NotificationIntegrationTests {

    private static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();
    private static final String ADMIN = "/api/v1/learning/admin/notifications";
    private static final String USER = "/api/v1/learning/notifications";
    private static final AtomicLong USERS = new AtomicLong(System.currentTimeMillis());
    private final HttpClient client = HttpClient.newHttpClient();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
    }

    @LocalServerPort int port;
    @Autowired JsonMapper mapper;
    @Autowired NotificationRepository repository;
    @Autowired NotificationService notifications;
    @Autowired TransactionTemplate transaction;

    private String token(long userId, String role) {
        return Jwts.builder().subject(Long.toString(userId)).issuer("sgedu")
            .claim("role", role).claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now())).expiration(Date.from(Instant.now().plusSeconds(120)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
    }

    private HttpResponse<String> send(String method, String path, Long userId, String role, Object body)
        throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (userId != null) request.header("Authorization", "Bearer " + token(userId, role));
        if (body != null) request.header("Content-Type", "application/json");
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode data(HttpResponse<String> response, int expectedStatus) throws Exception {
        assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(expectedStatus);
        return mapper.readTree(response.body()).get("data");
    }

    private AdminNotificationRequest message(long recipient) {
        return new AdminNotificationRequest(UUID.randomUUID().toString(), recipient,
            "Lịch bảo trì hệ thống", "Vui lòng lưu bài làm trước thời gian bảo trì.");
    }

    private void seed(long recipient, NotificationType type, Instant created) {
        var notification = new Notification();
        notification.setUserId(recipient);
        notification.setType(type);
        notification.setTitle("Dữ liệu kiểm thử");
        notification.setBody("Thông báo nghiệp vụ");
        notification.setCreatedAt(created);
        repository.saveAndFlush(notification);
    }

    @Test
    void adminRoutesRequireAdminAndCannotChangeBusinessNotifications() throws Exception {
        long learner = USERS.incrementAndGet();
        assertThat(send("GET", ADMIN, null, null, null).statusCode()).isEqualTo(401);
        assertThat(send("GET", ADMIN, learner, "USER", null).statusCode()).isEqualTo(403);
        assertThat(send("POST", ADMIN, learner, "USER", message(learner)).statusCode()).isEqualTo(403);
        var saved = data(send("POST", ADMIN, learner, "ADMIN", message(learner)), 201);
        long id = saved.get("id").asLong();
        assertThat(send("DELETE", ADMIN + "/" + id, learner, "ADMIN", null).statusCode()).isEqualTo(404);
        assertThat(send("PUT", ADMIN + "/" + id, learner, "ADMIN", message(learner)).statusCode()).isEqualTo(404);
    }

    @Test
    void sendsSystemOnlyAndRetriesPreserveOriginalMessageAndReadState() throws Exception {
        long admin = USERS.incrementAndGet();
        long owner = USERS.incrementAndGet();
        long stranger = USERS.incrementAndGet();
        var request = message(owner);
        var first = data(send("POST", ADMIN, admin, "ADMIN", request), 201);
        assertThat(first.get("type").asString()).isEqualTo("SYSTEM");
        assertThat(first.get("category").asString()).isEqualTo("SYSTEM");
        assertThat(first.get("actionUrl").asString()).isEqualTo("/notifications");
        long id = first.get("id").asLong();
        assertThat(send("PATCH", USER + "/" + id + "/read", stranger, "USER", null).statusCode()).isEqualTo(404);
        var read = data(send("PATCH", USER + "/" + id + "/read", owner, "USER", null), 200);
        var retry = data(send("POST", ADMIN, admin, "ADMIN", request), 201);
        assertThat(retry.get("id").asLong()).isEqualTo(id);
        assertThat(retry.get("readAt").asString()).isEqualTo(read.get("readAt").asString());
        var conflict = new AdminNotificationRequest(request.eventId(), owner, "Nội dung khác", request.body());
        assertThat(send("POST", ADMIN, admin, "ADMIN", conflict).statusCode()).isEqualTo(409);
        assertThat(repository.countByUserIdAndReadAtIsNull(owner)).isZero();
        assertThat(data(send("GET", USER + "/summary", stranger, "USER", null), 200)
            .get("notifications").size()).isZero();
    }

    @Test
    void adminFeedFiltersRecipientCategoryUnreadAndOrdersTies() throws Exception {
        long owner = USERS.incrementAndGet();
        long other = USERS.incrementAndGet();
        Instant now = Instant.now();
        seed(owner, NotificationType.QUIZ, now);
        seed(owner, NotificationType.LESSON_COMPLETED, now);
        seed(owner, NotificationType.PAYMENT_SUCCESS, now);
        seed(other, NotificationType.SYSTEM, now);
        String filter = ADMIN + "?userId=" + owner + "&category=LEARNING&size=1";
        var first = data(send("GET", filter, other, "ADMIN", null), 200);
        assertThat(first.get("totalElements").asLong()).isEqualTo(2);
        assertThat(first.get("totalPages").asInt()).isEqualTo(2);
        assertThat(first.get("content").get(0).get("userId").asLong()).isEqualTo(owner);
        long firstId = first.get("content").get(0).get("id").asLong();
        var second = data(send("GET", filter + "&page=1", other, "ADMIN", null), 200);
        assertThat(second.get("content").get(0).get("id").asLong()).isLessThan(firstId);
        data(send("PATCH", USER + "/" + firstId + "/read", owner, "USER", null), 200);
        assertThat(data(send("GET", filter + "&unreadOnly=true", other, "ADMIN", null), 200)
            .get("totalElements").asLong()).isEqualTo(1);
        assertThat(data(send("GET", ADMIN + "?userId=" + other, other, "ADMIN", null), 200)
            .get("totalElements").asLong()).isEqualTo(1);
    }

    @Test
    void validatesPayloadAndAdminFiltersWithoutServerErrors() throws Exception {
        long admin = USERS.incrementAndGet();
        for (String query : List.of("?page=-1", "?size=101", "?size=0", "?userId=0", "?userId=abc", "?category=UNKNOWN")) {
            assertThat(send("GET", ADMIN + query, admin, "ADMIN", null).statusCode()).isEqualTo(400);
        }
        for (Object request : List.of(
            new AdminNotificationRequest("event", 0L, "Title", "Body"),
            new AdminNotificationRequest("event", admin, " ", "Body"),
            new AdminNotificationRequest("event", admin, "Title", "x".repeat(1001)),
            Map.of("eventId", "event", "title", "Title", "body", "Body")
        )) {
            assertThat(send("POST", ADMIN, admin, "ADMIN", request).statusCode()).isEqualTo(400);
        }
        assertThat(repository.countByUserIdAndReadAtIsNull(admin)).isZero();
    }

    @Test
    void concurrentSendCreatesOneRowAndRollbackLeavesNoMessage() throws Exception {
        long recipient = USERS.incrementAndGet();
        var request = message(recipient);
        try (var workers = Executors.newVirtualThreadPerTaskExecutor()) {
            var results = java.util.stream.IntStream.range(0, 5)
                .mapToObj(index -> workers.submit(() -> notifications.sendSystem(request))).toList();
            long id = results.getFirst().get().id();
            for (var result : results) assertThat(result.get().id()).isEqualTo(id);
        }
        assertThat(repository.countByUserIdAndReadAtIsNull(recipient)).isEqualTo(1);
        long rollbackRecipient = USERS.incrementAndGet();
        transaction.executeWithoutResult(status -> {
            notifications.sendSystem(message(rollbackRecipient));
            status.setRollbackOnly();
        });
        assertThat(repository.countByUserIdAndReadAtIsNull(rollbackRecipient)).isZero();
    }
}
