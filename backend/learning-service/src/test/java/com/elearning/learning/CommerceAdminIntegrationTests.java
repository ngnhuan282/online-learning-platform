package com.elearning.learning;

import static org.assertj.core.api.Assertions.*;

import com.elearning.learning.dto.LearningAdminModels.*;
import com.elearning.learning.dto.ShopModels.*;
import com.elearning.learning.service.*;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.datasource.url=jdbc:h2:mem:commerce_admin;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "security.jwt.secret=commerce-admin-test-secret-at-least-32-bytes",
        "logging.level.root=WARN",
    }
)
@ActiveProfiles("test")
class CommerceAdminIntegrationTests {

    @Test
    void inventoryGrantsAreIdempotentAndRevocationUnequipsWithoutChangingGems() {
        var gift = new InventoryRequest(true, "support gift");
        admin.saveInventory(7, "FRAME_KITTY", gift, 99);
        admin.saveInventory(7, "FRAME_KITTY", gift, 99);
        assertThat(admin.inventory(7)).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM learning_admin_audit", Integer.class)).isEqualTo(
            1
        );
        shop.equip(7, new EquipRequest("FRAME", "FRAME_KITTY"));
        admin.saveInventory(7, "FRAME_KITTY", new InventoryRequest(false, "gift correction"), 99);
        assertThat(engagement.summary(7).activeFrame()).isNull();
        assertThat(engagement.summary(7).gems()).isZero();
        assertThat(admin.inventory(7)).isEmpty();
        assertThatThrownBy(() -> admin.saveInventory(7, "STREAK_FREEZE", gift, 99)).isInstanceOf(
            com.elearning.learning.common.exception.AppException.class
        );
    }

    @Test
    void proMembersWithoutLearningProfilesRemainManageable() {
        pro.grant(
            new com.elearning.learning.dto.ProModels.GrantRequest("PAYMENT-API-ONLY", 15L, "PRO_MONTH", 1)
        );
        assertThat(admin.members("15", 0, 20).totalElements()).isEqualTo(1);
        admin.requireProTarget(15L);
        assertThat(admin.grants(15L)).hasSize(1);
        assertThatThrownBy(() -> admin.requireProTarget(90000L)).isInstanceOf(
            com.elearning.learning.common.exception.AppException.class
        );
    }

    static final String SECRET = "commerce-admin-test-secret-at-least-32-bytes";

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JsonMapper json;

    @Autowired
    LearningAdminService admin;

    @Autowired
    EngagementService engagement;

    @Autowired
    ShopService shop;

    @Autowired
    ProMembershipService pro;

    @BeforeEach
    void setup() {
        for (String table : List.of(
            "learning_admin_audit",
            "learner_admin_adjustments",
            "learning_admin_actor_locks",
            "shop_purchases",
            "shop_inventory",
            "learning_frozen_days",
            "learner_rewards",
            "learning_activity_days",
            "learning_xp_events",
            "community_comments",
            "community_posts",
            "pro_grants",
            "pro_activation_codes",
            "pro_memberships",
            "pro_activation_attempts",
            "learner_profiles"
        ))
            jdbc.update("DELETE FROM " + table);
        jdbc.update("DELETE FROM shop_items WHERE code='FRAME_ADMIN_TEST'");
        jdbc.update("UPDATE shop_items SET active=TRUE WHERE code='FRAME_KITTY'");
        jdbc.update(
            "UPDATE engagement_settings SET lesson_xp=20,quiz_xp=10,daily_gems=25,xp_per_level=100,version=0 WHERE id=1"
        );
        jdbc.update("UPDATE engagement_reward_rules SET active=TRUE");
        engagement.lockProfile(7L);
    }

    private String token(String role, String... permissions) {
        return Jwts.builder()
            .subject("99")
            .issuer("sgedu")
            .claim("tokenType", "access")
            .claim("role", role.equals("ADMIN") ? "ADMIN" : "USER")
            .claim("roles", List.of(role))
            .claim("permissions", List.of(permissions))
            .issuedAt(new Date())
            .expiration(Date.from(Instant.now().plusSeconds(600)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
            .compact();
    }

    private HttpResponse<String> request(String method, String path, String token, Object body)
        throws Exception {
        var builder = HttpRequest.newBuilder(
            URI.create("http://localhost:" + port + "/api/v1/learning/admin" + path)
        ).header("Content-Type", "application/json");
        if (token != null) builder.header("Authorization", "Bearer " + token);
        return HttpClient.newHttpClient().send(
            builder
                .method(
                    method,
                    body == null
                        ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))
                )
                .build(),
            HttpResponse.BodyHandlers.ofString()
        );
    }

    private JsonNode data(HttpResponse<String> response) throws Exception {
        assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(200);
        return json.readTree(response.body()).get("data");
    }

    private UsernamePasswordAuthenticationToken actor(String... permissions) {
        var authorities = new ArrayList<SimpleGrantedAuthority>();
        authorities.add(new SimpleGrantedAuthority("ROLE_SUPPORT"));
        authorities.add(new SimpleGrantedAuthority("ADMIN_ACCESS"));
        for (String p : permissions) authorities.add(new SimpleGrantedAuthority(p));
        return new UsernamePasswordAuthenticationToken("99", null, authorities);
    }

    @Test
    void granularPermissionsDenyLearnerForgedClaimsAndReadOnlyWrites() throws Exception {
        assertThat(request("GET", "/shop/items", null, null).statusCode()).isEqualTo(401);
        assertThat(
            request("GET", "/shop/items", token("USER", "ADMIN_ACCESS", "SHOP_VIEW"), null).statusCode()
        ).isEqualTo(403);
        assertThat(
            data(request("GET", "/shop/items", token("SUPPORT", "ADMIN_ACCESS", "SHOP_VIEW"), null)).isArray()
        ).isTrue();
        assertThat(
            request(
                "POST",
                "/shop/items",
                token("SUPPORT", "ADMIN_ACCESS", "SHOP_VIEW"),
                new ItemRequest(
                    "FRAME_DENIED",
                    "Denied item",
                    "FRAME",
                    "RARE",
                    0,
                    null,
                    "classic",
                    1,
                    true,
                    0,
                    "permission test"
                )
            ).statusCode()
        ).isEqualTo(403);
        var change = new AdjustmentRequest(
            UUID.randomUUID().toString(),
            20,
            0,
            null,
            0,
            null,
            "support correction"
        );
        assertThat(
            request(
                "POST",
                "/engagement/learners/7/adjustments",
                token("SUPPORT", "ADMIN_ACCESS", "ENGAGEMENT_VIEW"),
                change
            ).statusCode()
        ).isEqualTo(403);
        assertThat(
            request("GET", "/pro/members", token("SUPPORT", "ADMIN_ACCESS", "SHOP_VIEW"), null).statusCode()
        ).isEqualTo(403);
    }

    @Test
    void adjustmentsAreIdempotentAtomicAuditedAndBounded() throws Exception {
        var request = new AdjustmentRequest(
            UUID.randomUUID().toString(),
            50,
            100,
            null,
            2,
            null,
            "reward correction"
        );
        var auth = actor("GEM_ADJUST", "XP_ADJUST", "STREAK_ADJUST");
        admin.adjust(7, request, auth);
        admin.adjust(7, request, auth);
        assertThat(engagement.summary(7).gems()).isEqualTo(50);
        assertThat(engagement.summary(7).level()).isEqualTo(2);
        assertThat(engagement.summary(7).streakFreezes()).isEqualTo(2);
        assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM learner_admin_adjustments", Integer.class)
        ).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM learning_admin_audit", Integer.class)).isEqualTo(
            1
        );
        assertThatThrownBy(() ->
            admin.adjust(
                7,
                new AdjustmentRequest(request.requestId(), 51, 100, null, 2, null, "reward correction"),
                auth
            )
        ).isInstanceOf(com.elearning.learning.common.exception.AppException.class);
        assertThatThrownBy(() ->
            admin.adjust(
                7,
                new AdjustmentRequest(
                    UUID.randomUUID().toString(),
                    -51,
                    0,
                    null,
                    0,
                    null,
                    "invalid negative"
                ),
                auth
            )
        ).isInstanceOf(com.elearning.learning.common.exception.AppException.class);
        assertThatThrownBy(() ->
            admin.adjust(
                7,
                new AdjustmentRequest(UUID.randomUUID().toString(), 0, 0, null, 6, null, "over capacity"),
                auth
            )
        ).isInstanceOf(com.elearning.learning.common.exception.AppException.class);
        assertThat(engagement.summary(7).gems()).isEqualTo(50);
        assertThat(
            data(request("GET", "/engagement/learners?keyword=7", token("ADMIN"), null))
                .get("totalElements")
                .asInt()
        ).isEqualTo(1);
    }

    @Test
    void concurrentRepeatedAdjustmentAppliesOnce() throws Exception {
        var change = new AdjustmentRequest(UUID.randomUUID().toString(), 70, 0, null, 0, null, "one award");
        try (var executor = Executors.newFixedThreadPool(2)) {
            var a = executor.submit(() -> admin.adjust(7, change, actor("GEM_ADJUST")));
            var b = executor.submit(() -> admin.adjust(7, change, actor("GEM_ADJUST")));
            a.get(10, TimeUnit.SECONDS);
            b.get(10, TimeUnit.SECONDS);
        }
        assertThat(engagement.summary(7).gems()).isEqualTo(70);
    }

    @Test
    void configurableRewardsAndLevelsDriveRealLearningAndPreventStaleUpdates() {
        admin.saveSettings(new SettingsRequest(30, 15, 40, 50, 0, "new learning rules"), 99);
        engagement.lessonCompleted(7, 101);
        assertThat(engagement.summary(7).totalXp()).isEqualTo(30);
        assertThat(engagement.summary(7).gems()).isEqualTo(40);
        engagement.quizSubmitted(7, 201);
        assertThat(engagement.summary(7).totalXp()).isEqualTo(45);
        assertThat(engagement.summary(7).gems()).isEqualTo(40);
        admin.adjust(
            7,
            new AdjustmentRequest(UUID.randomUUID().toString(), 0, 0, 5, 0, null, "level correction"),
            actor("XP_ADJUST")
        );
        assertThat(engagement.summary(7).totalXp()).isEqualTo(200);
        assertThat(engagement.summary(7).level()).isEqualTo(5);
        assertThatThrownBy(() ->
            admin.saveSettings(new SettingsRequest(20, 10, 25, 100, 0, "stale version"), 99)
        ).isInstanceOf(com.elearning.learning.common.exception.AppException.class);
        var reward = admin
            .rewards()
            .stream()
            .filter(r -> r.get("code").equals("FIRST_LESSON"))
            .findFirst()
            .orElseThrow();
        admin.saveReward(
            "FIRST_LESSON",
            new RewardRequest(7, true, ((Number) reward.get("version")).longValue(), "updated reward"),
            99
        );
        engagement.claim(7, "FIRST_LESSON");
        engagement.claim(7, "FIRST_LESSON");
        assertThat(engagement.summary(7).gems()).isEqualTo(47);
    }

    @Test
    void catalogCreatesRealEquippableItemsAndHidingPreservesOwnership() {
        var item = new ItemRequest(
            "FRAME_ADMIN_TEST",
            "New kitty",
            "FRAME",
            "EPIC",
            0,
            null,
            "kitty-scholar",
            10,
            true,
            0,
            "new collectible"
        );
        admin.saveItem(null, item, 99);
        shop.purchase(7, new PurchaseRequest(item.code(), UUID.randomUUID().toString()));
        shop.equip(7, new EquipRequest("FRAME", item.code()));
        assertThat(engagement.summary(7).activeFrameAssetKey()).isEqualTo("kitty-scholar");
        admin.saveItem(
            item.code(),
            new ItemRequest(
                item.code(),
                item.nameKey(),
                "FRAME",
                "EPIC",
                10,
                null,
                item.assetKey(),
                10,
                false,
                0,
                "retired collectible"
            ),
            99
        );
        assertThat(
            shop
                .state(7)
                .items()
                .stream()
                .anyMatch(r -> r.code().equals(item.code()) && r.owned() && !r.active())
        ).isTrue();
        assertThatThrownBy(() ->
            shop.purchase(7, new PurchaseRequest(item.code(), UUID.randomUUID().toString()))
        ).isInstanceOf(com.elearning.learning.common.exception.AppException.class);
        assertThat(shop.equip(7, new EquipRequest("FRAME", item.code())).activeFrame()).isEqualTo(
            item.code()
        );
        assertThatThrownBy(() -> admin.saveItem(item.code(), item, 99)).isInstanceOf(
            com.elearning.learning.common.exception.AppException.class
        );
    }

    @Test
    void proAdminGrantsAndSuspensionPreservePaidGrantsAndNeverDoubleExtend() {
        pro.grant(
            new com.elearning.learning.dto.ProModels.GrantRequest("PAYMENT-ADMIN-TEST", 7L, "PRO_YEAR", 12)
        );
        var request = new GrantRequest("PRO_MONTH", UUID.randomUUID().toString(), "support extension");
        var extended = pro.grantAdmin(7, 99, request);
        assertThat(pro.grantAdmin(7, 99, request).expiresAt()).isEqualTo(extended.expiresAt());
        var blocked = pro.suspend(7, 99, new SuspensionRequest(true, extended.version(), "investigation"));
        assertThat(blocked.active()).isFalse();
        assertThat(blocked.suspended()).isTrue();
        assertThat(
            pro.suspend(7, 99, new SuspensionRequest(false, blocked.version(), "resolved")).active()
        ).isTrue();
        long paidId = jdbc.queryForObject(
            "SELECT id FROM pro_grants WHERE source_type='PAYMENT'",
            Long.class
        );
        assertThatThrownBy(() -> pro.revokeAdmin(7, paidId, 99, "cannot refund here")).isInstanceOf(
            com.elearning.learning.common.exception.AppException.class
        );
        long giftId = jdbc.queryForObject("SELECT id FROM pro_grants WHERE source_type='ADMIN'", Long.class);
        assertThat(pro.revokeAdmin(7, giftId, 99, "gift correction").active()).isTrue();
    }

    @Test
    void moderationHidesRestoresAndClearsHiddenAcceptedAnswer() {
        jdbc.update(
            "INSERT INTO community_posts(id,author_id,topic_id,kind,title,body,created_at,updated_at) VALUES (100,7,1,'QUESTION','Question','text',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
        );
        jdbc.update(
            "INSERT INTO community_comments(id,post_id,author_id,body,created_at,updated_at) VALUES (101,100,7,'answer',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
        );
        jdbc.update("UPDATE community_posts SET accepted_comment_id=101 WHERE id=100");
        admin.moderate(100, new ModerationRequest(true, true, "moderation"), 99);
        assertThat(admin.posts(true, 0, 20).totalElements()).isEqualTo(1);
        admin.moderateComment(100, 101, new ModerationRequest(true, false, "spam"), 99);
        assertThat(
            jdbc.queryForObject("SELECT accepted_comment_id FROM community_posts WHERE id=100", Long.class)
        ).isNull();
        admin.moderate(100, new ModerationRequest(false, false, "restore"), 99);
        assertThat(admin.posts(false, 0, 20).totalElements()).isEqualTo(1);
    }

    @Test
    void codeAndQuizNotificationPermissionsAreDelegatable() throws Exception {
        String viewer = token("SUPPORT", "ADMIN_ACCESS", "PRO_CODE_VIEW", "QUIZ_VIEW", "NOTIFICATION_VIEW");
        assertThat(request("GET", "/pro/codes", viewer, null).statusCode()).isEqualTo(200);
        assertThat(
            request("POST", "/pro/codes", viewer, Map.of("planCode", "PRO_MONTH")).statusCode()
        ).isEqualTo(403);
        assertThat(request("GET", "/quizzes", viewer, null).statusCode()).isEqualTo(200);
        var quiz = Map.of(
            "courseId",
            1,
            "title",
            "Permission test",
            "passingScore",
            50,
            "questions",
            List.of(
                Map.of(
                    "questionText",
                    "Question",
                    "questionType",
                    "SINGLE_CHOICE",
                    "points",
                    1,
                    "options",
                    List.of(
                        Map.of("optionText", "Yes", "correct", true),
                        Map.of("optionText", "No", "correct", false)
                    )
                )
            )
        );
        assertThat(request("POST", "/quizzes", viewer, quiz).statusCode()).isEqualTo(403);
        assertThat(request("GET", "/notifications", viewer, null).statusCode()).isEqualTo(200);
        assertThat(
            request(
                "POST",
                "/notifications",
                viewer,
                Map.of("eventId", "permission-test", "userId", 7, "title", "Title", "body", "Body")
            ).statusCode()
        ).isEqualTo(403);
    }
}
