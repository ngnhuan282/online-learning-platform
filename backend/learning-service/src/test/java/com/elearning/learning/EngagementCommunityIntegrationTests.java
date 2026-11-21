package com.elearning.learning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.elearning.learning.dto.CommunityModels.*;
import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.dto.ShopModels.PurchaseRequest;
import com.elearning.learning.service.CommunityService;
import com.elearning.learning.service.CurrentProfileClient;
import com.elearning.learning.service.EngagementService;
import com.elearning.learning.service.ShopService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "security.jwt.secret=engagement-test-secret-at-least-thirty-two-characters",
        "security.jwt.issuer=sgedu",
        "spring.datasource.url=jdbc:h2:mem:engagementCommunity;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "logging.level.root=WARN",
        "logging.level.org.springframework=WARN",
})
@ActiveProfiles("test")
class EngagementCommunityIntegrationTests {

    private static final String SECRET = "engagement-test-secret-at-least-thirty-two-characters";
    private static final String BASE = "/api/v1/learning";
    private final AtomicReference<Instant> time = new AtomicReference<>();

    @LocalServerPort
    int port;

    @Autowired
    EngagementService engagement;

    @Autowired
    ShopService shop;

    @Autowired
    CommunityService community;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JsonMapper mapper;

    @MockitoBean
    Clock clock;

    @MockitoBean
    CurrentProfileClient profiles;

    @BeforeEach
    void setup() {
        time.set(Instant.parse("2026-11-14T16:59:59Z"));
        when(clock.instant()).thenAnswer(call -> time.get());
        when(clock.withZone(any(ZoneId.class))).thenAnswer(call -> Clock.fixed(time.get(), call.getArgument(0)));
        for (String table : List.of(
                "community_comments",
                "community_posts",
                "shop_purchases",
                "shop_inventory",
                "learning_frozen_days",
                "learner_rewards",
                "learning_activity_days",
                "learning_xp_events",
                "learner_profiles"))
            jdbc.update("DELETE FROM " + table);
    }

    @Test
    void vietnamMidnightStreakResetAndUniqueXp() {
        engagement.lessonCompleted(101, 1);
        engagement.lessonCompleted(101, 1);
        assertThat(engagement.summary(101).totalXp()).isEqualTo(20);
        assertThat(engagement.summary(101).currentStreak()).isEqualTo(1);
        time.set(Instant.parse("2026-11-14T17:00:00Z"));
        engagement.quizSubmitted(101, 2);
        assertThat(engagement.summary(101).currentStreak()).isEqualTo(2);
        assertThat(engagement.summary(101).today().toString()).isEqualTo("2026-11-15");
        time.set(Instant.parse("2026-11-15T17:00:00Z"));
        engagement.quizSubmitted(101, 2);
        assertThat(engagement.summary(101).totalXp()).isEqualTo(30);
        assertThat(engagement.summary(101).currentStreak()).isEqualTo(3);
        assertThat(engagement.summary(101).days()).hasSize(3);
        time.set(Instant.parse("2026-11-18T17:00:00Z"));
        assertThat(engagement.summary(101).currentStreak()).isZero();
        engagement.lessonCompleted(101, 3);
        assertThat(engagement.summary(101).currentStreak()).isEqualTo(1);
        assertThat(engagement.summary(101).longestStreak()).isEqualTo(3);
    }

    @Test
    void concurrentAwardsAndRewardClaimsAreIdempotent() throws Exception {
        try (var pool = Executors.newFixedThreadPool(6)) {
            var tasks = java.util.stream.IntStream.range(0, 12)
                    .mapToObj(i -> pool.submit(() -> engagement.lessonCompleted(102, 77)))
                    .toList();
            for (var task : tasks)
                task.get(15, TimeUnit.SECONDS);
            assertThat(engagement.summary(102).totalXp()).isEqualTo(20);
            var claims = java.util.stream.IntStream.range(0, 12)
                    .mapToObj(i -> pool.submit(() -> engagement.claim(102, "FIRST_LESSON")))
                    .toList();
            for (var task : claims)
                task.get(15, TimeUnit.SECONDS);
        }
        assertThat(engagement.summary(102).gems()).isEqualTo(45);
        assertThat(engagement.equipFrame(102, "FIRST_LESSON").activeFrame()).isEqualTo("FIRST_LESSON");
        assertThat(
                request(102, false, "POST", "/engagement/frame", "{\"code\":\"STREAK_30\"}").statusCode())
                .isEqualTo(409);
        assertThat(
                request(102, false, "POST", "/engagement/frame", "{\"code\":null}").statusCode()).isEqualTo(200);
        assertThat(engagement.summary(102).activeFrame()).isNull();
        assertThat(
                jdbc.queryForObject("SELECT COUNT(*) FROM learner_rewards WHERE user_id = 102", Long.class))
                .isEqualTo(1);
        assertThat(
                request(102, false, "POST", "/engagement/rewards/STREAK_7/claim", "{}").statusCode()).isEqualTo(409);
        assertThat(
                request(102, false, "POST", "/engagement/rewards/UNKNOWN/claim", "{}").statusCode()).isEqualTo(404);
    }

    @Test
    void leaderboardUsesVietnamMonthBoundariesAndStablePagination() {
        time.set(Instant.parse("2026-10-31T16:59:59Z"));
        engagement.lessonCompleted(103, 1);
        time.set(Instant.parse("2026-10-31T17:00:00Z"));
        engagement.quizSubmitted(104, 1);
        engagement.lessonCompleted(105, 1);
        var november = engagement.leaderboard(104, "month", "2026-11", 0, 1);
        assertThat(november.totalElements()).isEqualTo(2);
        assertThat(november.content().getFirst().userId()).isEqualTo(105);
        assertThat(november.me().rank()).isEqualTo(2);
        assertThat(engagement.leaderboard(103, "month", "2026-10", 0, 20).content()).hasSize(1);
        assertThat(engagement.leaderboard(103, "all", null, 0, 20).totalElements()).isEqualTo(3);
    }

    @Test
    void topicSearchAndOwnerEditsPreserveAcceptedAnswers() {
        var topic = community.topics().getFirst();
        long post = community
                .create(101, new PostRequest(topic.id(), "QUESTION", "Prefix study question", "Need help"), null).id();
        long other = community
                .create(102, new PostRequest(topic.id(), "DISCUSSION", "Prefix study discussion", "Ideas"), null).id();
        assertThat(community.posts(topic.id(), "STUDY", "QUESTION", true, 0, 10).content())
                .extracting(Post::id).containsExactly(post);
        assertThat(community.posts(topic.id(), "prefix", null, false, 0, 1).totalElements()).isEqualTo(2);
        var comment = community.addComment(102, false, post, new CommentRequest("Suggested answer"), null);
        assertThat(community.comments(post, 0, 1).content()).extracting(Comment::id).containsExactly(comment.id());
        assertThat(community.updateComment(102, false, post, comment.id(), new CommentRequest(" Corrected answer "))
                .body())
                .isEqualTo("Corrected answer");
        community.acceptAnswer(101, false, post, comment.id());
        assertThat(community.posts(topic.id(), "prefix", "QUESTION", true, 0, 10).content()).isEmpty();
        assertThatThrownBy(() -> community.update(101, false, post,
                new PostRequest(topic.id(), "DISCUSSION", "Wrong type", "Body"))).isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONFLICT);
        assertThat(community
                .update(101, false, post, new PostRequest(topic.id(), "QUESTION", " Updated title ", "Body")).title())
                .isEqualTo("Updated title");
        assertThat(community.get(post).acceptedCommentId()).isEqualTo(comment.id());
        community.delete(102, false, other);
        assertThat(community.posts(topic.id(), null, null, false, 0, 10).content())
                .extracting(Post::id).containsExactly(post);
    }

    @Test
    void forumOwnershipModerationAcceptanceAndSoftDeletion() throws Exception {
        long post = createPost(201, "QUESTION", "How do I practise listening?");
        assertThat(
                request(
                        202,
                        false,
                        "PUT",
                        "/community/posts/" + post,
                        postJson("DISCUSSION", "Hijack")).statusCode())
                .isEqualTo(403);
        var commentResponse = request(
                202,
                false,
                "POST",
                "/community/posts/" + post + "/comments",
                "{\"body\":\"Try daily dictation.\"}");
        assertThat(commentResponse.statusCode()).isEqualTo(201);
        long comment = mapper.readTree(commentResponse.body()).path("data").path("id").asLong();
        assertThat(
                request(
                        202,
                        false,
                        "PATCH",
                        "/community/posts/" + post + "/answer",
                        "{\"commentId\":" + comment + "}").statusCode())
                .isEqualTo(403);
        assertThat(
                request(
                        201,
                        false,
                        "PATCH",
                        "/community/posts/" + post + "/answer",
                        "{\"commentId\":" + comment + "}").statusCode())
                .isEqualTo(200);
        assertThat(community.get(post).acceptedCommentId()).isEqualTo(comment);
        assertThat(
                request(
                        201,
                        false,
                        "PATCH",
                        "/community/posts/" + post + "/lock",
                        "{\"locked\":true}").statusCode())
                .isEqualTo(403);
        assertThat(
                request(
                        999,
                        true,
                        "PATCH",
                        "/community/posts/" + post + "/lock",
                        "{\"locked\":true}").statusCode())
                .isEqualTo(200);
        assertThat(
                request(
                        203,
                        false,
                        "POST",
                        "/community/posts/" + post + "/comments",
                        "{\"body\":\"Blocked\"}").statusCode())
                .isEqualTo(409);
        assertThat(
                request(
                        999,
                        true,
                        "DELETE",
                        "/community/posts/" + post + "/comments/" + comment,
                        null).statusCode())
                .isEqualTo(200);
        assertThat(community.get(post).acceptedCommentId()).isNull();
        assertThat(community.get(post).commentCount()).isZero();
        assertThat(request(999, true, "DELETE", "/community/posts/" + post, null).statusCode()).isEqualTo(
                200);
        assertThat(request(201, false, "GET", "/community/posts/" + post, null).statusCode()).isEqualTo(404);
    }

    @Test
    void forumRejectsCrossPostAnswersInvalidInputAndSpamAndRequiresLogin() throws Exception {
        long first = createPost(301, "QUESTION", "First question");
        long second = createPost(302, "QUESTION", "Second question");
        long comment = mapper
                .readTree(
                        request(
                                303,
                                false,
                                "POST",
                                "/community/posts/" + second + "/comments",
                                "{\"body\":\"Answer for second only\"}").body())
                .path("data")
                .path("id")
                .asLong();
        assertThat(
                request(
                        301,
                        false,
                        "PATCH",
                        "/community/posts/" + first + "/answer",
                        "{\"commentId\":" + comment + "}").statusCode())
                .isEqualTo(404);
        assertThat(
                request(301, false, "POST", "/community/posts", postJson("DISCUSSION", "Spam")).statusCode())
                .isEqualTo(429);
        assertThat(
                request(304, false, "POST", "/community/posts", postJson("INVALID", "Bad")).statusCode())
                .isEqualTo(400);
        assertThat(
                request(
                        304,
                        false,
                        "POST",
                        "/community/posts/" + first + "/comments",
                        "{\"body\":\"  \"}").statusCode())
                .isEqualTo(400);
        assertThat(
                request(301, false, "GET", "/community/posts?keyword=First&unanswered=true", null).statusCode())
                .isEqualTo(200);
        long profileCountBeforeGuestReads = jdbc.queryForObject(
            "SELECT COUNT(*) FROM learner_profiles",
            Long.class
        );
        for (String publicPath : List.of(
            "/community/topics",
            "/community/posts",
            "/engagement/leaderboard",
            "/shop"
        )) {
            assertThat(request((Long) null, false, "GET", publicPath, null).statusCode()).isEqualTo(200);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM learner_profiles", Long.class)).isEqualTo(
            profileCountBeforeGuestReads
        );
        for (String protectedGet : List.of(
            "/community/posts/" + first,
            "/community/posts/" + first + "/comments",
            "/engagement/me"
        )) {
            assertThat(request((Long) null, false, "GET", protectedGet, null).statusCode()).isEqualTo(401);
        }
        assertThat(
            request((Long) null, false, "POST", "/community/posts", postJson("QUESTION", "Guest"))
                .statusCode()
        ).isEqualTo(401);
        assertThat(
            request((Long) null, false, "POST", "/shop/purchases", purchaseJson("FRAME_CLASSIC", "guest-1"))
                .statusCode()
        ).isEqualTo(401);
        assertThat(
            request(
                (Long) null,
                false,
                "POST",
                "/shop/equip",
                "{\"itemType\":\"FRAME\",\"itemCode\":\"FRAME_CLASSIC\"}"
            ).statusCode()
        ).isEqualTo(401);
        assertThat(
                request(301, false, "GET", "/engagement/leaderboard?size=999", null).statusCode()).isEqualTo(400);
    }

    @Test
    void shopEnforcesBalanceOwnershipAndRequestIdempotencyOverHttp() throws Exception {
        assertThat(request(401, false, "GET", "/shop", null).statusCode()).isEqualTo(200);
        assertThat(
                request(
                        401,
                        false,
                        "POST",
                        "/shop/purchases",
                        purchaseJson("FRAME_KITTY", "insufficient-test-1")).statusCode())
                .isEqualTo(409);
        assertThat(
                request(
                        401,
                        false,
                        "POST",
                        "/shop/equip",
                        "{\"itemType\":\"FRAME\",\"itemCode\":\"FRAME_KITTY\"}").statusCode())
                .isEqualTo(403);
        assertThat(
                request(
                        401,
                        false,
                        "POST",
                        "/shop/purchases",
                        purchaseJson("UNKNOWN", "unknown-item-test")).statusCode())
                .isEqualTo(404);
        assertThat(
                request(
                        401,
                        false,
                        "POST",
                        "/shop/purchases",
                        purchaseJson("FRAME_CLASSIC", "short")).statusCode())
                .isEqualTo(400);
        assertThat(
                request(
                        401,
                        false,
                        "POST",
                        "/shop/purchases",
                        purchaseJson("FRAME_CLASSIC", "free-claim-test-1")).statusCode())
                .isEqualTo(200);
        assertThat(
                request(
                        401,
                        false,
                        "POST",
                        "/shop/equip",
                        "{\"itemType\":\"BACKGROUND\",\"itemCode\":\"FRAME_CLASSIC\"}").statusCode())
                .isEqualTo(403);
        assertThat(
                request(
                        401,
                        false,
                        "POST",
                        "/shop/equip",
                        "{\"itemType\":\"FRAME\",\"itemCode\":\"FRAME_CLASSIC\"}").statusCode())
                .isEqualTo(200);
        assertThat(engagement.summary(401).activeFrame()).isEqualTo("FRAME_CLASSIC");
        jdbc.update("UPDATE learner_profiles SET gems = 300 WHERE user_id = 401");
        var first = request(
                401,
                false,
                "POST",
                "/shop/purchases",
                purchaseJson("FRAME_KITTY", "paid-claim-test-1"));
        assertThat(first.statusCode()).isEqualTo(200);
        assertThat(mapper.readTree(first.body()).path("data").path("gemsSpent").asInt()).isEqualTo(150);
        assertThat(
                request(
                        401,
                        false,
                        "POST",
                        "/shop/purchases",
                        purchaseJson("FRAME_KITTY", "paid-claim-test-1")).statusCode())
                .isEqualTo(200);
        assertThat(
                request(
                        401,
                        false,
                        "POST",
                        "/shop/purchases",
                        purchaseJson("FRAME_KOALA", "paid-claim-test-1")).statusCode())
                .isEqualTo(409);
        assertThat(
                shop.purchase(401, new PurchaseRequest("FRAME_KITTY", "another-claim-test-1")).alreadyOwned()).isTrue();
        assertThat(engagement.summary(401).gems()).isEqualTo(150);
        assertThat(
                request(
                        401,
                        false,
                        "POST",
                        "/shop/purchases",
                        purchaseJson("BACKGROUND_SKY", "another-claim-test-1")).statusCode())
                .isEqualTo(409);
        assertThat(
                jdbc.queryForObject("SELECT COUNT(*) FROM shop_purchases WHERE user_id = 401", Long.class))
                .isEqualTo(3);
        assertThat(
                request(
                        401,
                        false,
                        "POST",
                        "/shop/equip",
                        "{\"itemType\":\"FRAME\",\"itemCode\":null}").statusCode())
                .isEqualTo(200);
        assertThat(engagement.summary(401).activeFrame()).isNull();
    }

    @Test
    void concurrentShopPurchasesSerializeSpendingAndFreezeCapacity() throws Exception {
        engagement.summary(402);
        jdbc.update("UPDATE learner_profiles SET gems = 500 WHERE user_id = 402");
        try (var pool = Executors.newFixedThreadPool(6)) {
            var tasks = java.util.stream.IntStream.range(0, 12)
                    .mapToObj(i -> pool.submit(
                            () -> shop.purchase(402, new PurchaseRequest("FRAME_KITTY", "concurrent-frame-" + i))))
                    .toList();
            for (var task : tasks)
                task.get(15, TimeUnit.SECONDS);
            assertThat(engagement.summary(402).gems()).isEqualTo(350);
            var sameRequest = java.util.stream.IntStream.range(0, 12)
                    .mapToObj(i -> pool.submit(
                            () -> shop.purchase(402, new PurchaseRequest("STREAK_FREEZE", "concurrent-freeze-same"))))
                    .toList();
            for (var task : sameRequest)
                task.get(15, TimeUnit.SECONDS);
            assertThat(shop.state(402).streakFreezes()).isEqualTo(1);
            jdbc.update("UPDATE learner_profiles SET streak_freezes = 6 WHERE user_id = 402");
            var capacity = java.util.stream.IntStream.range(0, 8)
                    .mapToObj(i -> pool.submit(() -> {
                        try {
                            shop.purchase(402, new PurchaseRequest("STREAK_FREEZE", "capacity-test-" + i));
                            return true;
                        } catch (com.elearning.learning.common.exception.AppException ex) {
                            return false;
                        }
                    }))
                    .toList();
            int successful = 0;
            for (var task : capacity)
                if (task.get(15, TimeUnit.SECONDS))
                    successful++;
            assertThat(successful).isEqualTo(1);
        }
        assertThat(shop.state(402).streakFreezes()).isEqualTo(7);
        assertThat(shop.state(402).gems()).isEqualTo(300);
    }

    @Test
    void freezesCoverOnlyClosedMissedDaysAndDailyGemsAreAwardedOnce() {
        time.set(Instant.parse("2026-11-14T03:00:00Z"));
        engagement.quizSubmitted(403, 1);
        engagement.quizSubmitted(403, 1);
        assertThat(engagement.summary(403).gems()).isEqualTo(25);
        shop.purchase(403, new PurchaseRequest("STREAK_FREEZE", "freeze-protection-1"));
        time.set(Instant.parse("2026-11-15T16:59:59Z"));
        assertThat(engagement.summary(403).streakFreezes()).isEqualTo(1);
        time.set(Instant.parse("2026-11-15T17:00:00Z"));
        var protectedDay = engagement.summary(403);
        assertThat(protectedDay.currentStreak()).isEqualTo(1);
        assertThat(protectedDay.frozenDays()).containsExactly(java.time.LocalDate.parse("2026-11-15"));
        assertThat(protectedDay.streakFreezes()).isZero();
        assertThat(protectedDay.activeToday()).isFalse();
        assertThat(protectedDay.days()).hasSize(1);
        assertThat(protectedDay.gems()).isZero();
        assertThat(protectedDay.totalXp()).isEqualTo(10);
        assertThat(engagement.summary(403).frozenDays()).hasSize(1);
        engagement.quizSubmitted(403, 1);
        assertThat(engagement.summary(403).currentStreak()).isEqualTo(2);
        assertThat(engagement.summary(403).gems()).isEqualTo(25);
        assertThat(engagement.summary(403).totalXp()).isEqualTo(10);
    }

    @Test
    void exhaustedFreezesResetStreakAndNewPurchasesCannotRepairPastDays() {
        time.set(Instant.parse("2026-11-14T03:00:00Z"));
        engagement.quizSubmitted(404, 1);
        shop.purchase(404, new PurchaseRequest("STREAK_FREEZE", "freeze-exhaustion-1"));
        time.set(Instant.parse("2026-11-17T03:00:00Z"));
        assertThat(engagement.summary(404).currentStreak()).isZero();
        assertThat(engagement.summary(404).frozenDays()).containsExactly(
                java.time.LocalDate.parse("2026-11-15"));
        jdbc.update("UPDATE learner_profiles SET gems = 100 WHERE user_id = 404");
        shop.purchase(404, new PurchaseRequest("STREAK_FREEZE", "freeze-exhaustion-2"));
        assertThat(engagement.summary(404).currentStreak()).isZero();
        engagement.quizSubmitted(404, 1);
        assertThat(engagement.summary(404).currentStreak()).isEqualTo(1);
        time.set(Instant.parse("2026-11-19T03:00:00Z"));
        assertThat(engagement.summary(404).currentStreak()).isEqualTo(1);
        assertThat(engagement.summary(404).frozenDays()).contains(java.time.LocalDate.parse("2026-11-18"));
    }

    @Test
    void differentItemsCannotOverspendTheSameBalance() throws Exception {
        engagement.summary(405);
        jdbc.update("UPDATE learner_profiles SET gems = 250 WHERE user_id = 405");
        try (var pool = Executors.newFixedThreadPool(2)) {
            var tasks = List.of("FRAME_KITTY", "FRAME_KOALA")
                    .stream()
                    .map(code -> pool.submit(() -> {
                        try {
                            shop.purchase(405, new PurchaseRequest(code, "overspend-test-" + code));
                            return true;
                        } catch (com.elearning.learning.common.exception.AppException ex) {
                            assertThat(ex.getErrorCode()).isEqualTo(
                                    com.elearning.learning.common.exception.ErrorCode.INSUFFICIENT_GEMS);
                            return false;
                        }
                    }))
                    .toList();
            int successful = 0;
            for (var task : tasks)
                if (task.get(15, TimeUnit.SECONDS))
                    successful++;
            assertThat(successful).isEqualTo(1);
        }
        assertThat(shop.state(405).gems()).isIn(70, 100);
        assertThat(
                jdbc.queryForObject("SELECT COUNT(*) FROM shop_inventory WHERE user_id = 405", Long.class))
                .isEqualTo(1);
    }

    private String purchaseJson(String code, String requestId) {
        return "{\"itemCode\":\"" + code + "\",\"requestId\":\"" + requestId + "\"}";
    }

    private long createPost(long userId, String kind, String title) throws Exception {
        var response = request(userId, false, "POST", "/community/posts", postJson(kind, title));
        assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(201);
        return mapper.readTree(response.body()).path("data").path("id").asLong();
    }

    private String postJson(String kind, String title) {
        return ("{\"topicId\":1,\"kind\":\"" +
                kind +
                "\",\"title\":\"" +
                title +
                "\",\"body\":\"Please share your experience.\"}");
    }

    private HttpResponse<String> request(long userId, boolean admin, String method, String path, String body)
            throws Exception {
        return request(Long.valueOf(userId), admin, method, path, body);
    }

    private HttpResponse<String> request(Long userId, boolean admin, String method, String path, String body)
        throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + BASE + path))
            .header("Content-Type", "application/json");
        if (userId != null) {
            Instant now = Instant.now();
            String token = Jwts.builder()
                .subject(Long.toString(userId))
                .issuer("sgedu")
                .claim("role", admin ? "ADMIN" : "USER")
                .claim("tokenType", "access")
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(300)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();
            request.header("Authorization", "Bearer " + token);
        }
        request.method(
            method,
            body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)
        );
        return HttpClient.newHttpClient().send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
