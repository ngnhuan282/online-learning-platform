package com.elearning.learning;

import static org.assertj.core.api.Assertions.assertThat;

import com.elearning.learning.dto.ShopModels.PurchaseRequest;
import com.elearning.learning.service.EngagementService;
import com.elearning.learning.service.ShopService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=${ANALYTICS_TEST_DB_URL:jdbc:h2:mem:commerce-analytics;MODE=MySQL;DB_CLOSE_DELAY=-1}",
    "spring.datasource.username=${ANALYTICS_TEST_DB_USERNAME:sa}",
    "spring.datasource.password=${ANALYTICS_TEST_DB_PASSWORD:}",
    "spring.datasource.driver-class-name=${ANALYTICS_TEST_DB_DRIVER:org.h2.Driver}",
    "security.jwt.secret=commerce-analytics-test-secret-at-least-32-bytes",
    "logging.level.root=WARN"
})
@Import(CommerceAnalyticsIntegrationTests.AnalyticsClock.class)
@ActiveProfiles("test")
class CommerceAnalyticsIntegrationTests {

    private static final String SECRET = "commerce-analytics-test-secret-at-least-32-bytes";
    private static final Instant NOW = Instant.parse("2026-11-19T10:00:00Z");
    private static final String RANGE = "?from=2026-11-14&to=2026-11-15";
    private static final String TODAY = "?from=2026-11-19&to=2026-11-19";

    @TestConfiguration
    static class AnalyticsClock {
        @Bean @Primary
        Clock reportingClock() {
            return Clock.fixed(NOW, ZoneOffset.UTC);
        }
    }

    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired JsonMapper json;
    @Autowired EngagementService engagement;
    @Autowired ShopService shop;
    private final HttpClient client = HttpClient.newHttpClient();

    @BeforeEach
    void clearFixtures() {
        for (String table : List.of(
            "learning_xp_events", "learning_activity_days", "learner_rewards", "learner_admin_adjustments",
            "gem_topup_receipts", "shop_inventory", "shop_purchases", "learning_frozen_days", "pro_activation_codes",
            "pro_grants", "pro_memberships", "learner_profiles"
        )) {
            jdbc.update("DELETE FROM " + table);
        }
    }

    @Test
    void authorizesEachReportAndValidatesTheDateWindow() throws Exception {
        assertThat(get("shop", null).statusCode()).isEqualTo(401);
        assertThat(get("shop", token("USER", "ADMIN_ACCESS", "SHOP_VIEW")).statusCode()).isEqualTo(403);
        String viewer = token("SUPPORT", "ADMIN_ACCESS", "ENGAGEMENT_VIEW");
        assertThat(get("gems", viewer).statusCode()).isEqualTo(200);
        assertThat(get("pro", viewer).statusCode()).isEqualTo(403);
        assertThat(get("shop", viewer).statusCode()).isEqualTo(403);
        for (String invalid : List.of(
            "?from=2026-11-14", "?to=2026-11-15", "?from=2026-11-15&to=2026-11-14",
            "?from=2026-08-01&to=2026-11-15", "?from=2026-11-19&to=2026-11-20",
            "?from=1969-12-31&to=1970-01-01", "?from=2026-02-30&to=2026-03-01"
        )) {
            assertThat(get("shop" + invalid, token("ADMIN")).statusCode()).as(invalid).isEqualTo(400);
        }
        var empty = report("shop", token("ADMIN"));
        assertThat(empty.path("range").path("from").asString()).isEqualTo("2026-10-21");
        assertThat(empty.path("range").path("to").asString()).isEqualTo("2026-11-19");
        assertThat(empty.path("previousRange").path("to").asString()).isEqualTo("2026-10-20");
        assertThat(empty.path("current").path("purchases").asLong()).isZero();
        assertThat(empty.path("snapshot").path("ownedItems").asLong()).isZero();
        assertThat(empty.path("snapshot").path("equipRate").isNull()).isTrue();
        assertThat(empty.path("details")).isEmpty();
        assertThat(empty.path("trend").size()).isLessThanOrEqualTo(7);
        assertThat(report("gems" + RANGE, token("ADMIN")).path("current").path("issued").asLong()).isZero();
        assertThat(report("pro" + RANGE, token("ADMIN")).path("snapshot").path("active").asLong()).isZero();
    }

    @Test
    void proReportsFirstAndRepeatGrantsAndOnlyRevealsMaskedCodesWithCodePermission() throws Exception {
        member(11, "2026-11-25T00:00:00Z", false);
        member(12, "2027-01-01T00:00:00Z", false);
        member(13, "2026-11-19T10:00:00Z", false);
        member(14, "2027-01-01T00:00:00Z", true);
        member(15, null, false);
        grant(11, "PAYMENT", "2026-11-13T16:59:59Z", null);
        grant(11, "CODE", "2026-11-13T17:00:00Z", null);
        grant(12, "ADMIN", "2026-11-14T00:00:00Z", null);
        grant(12, "PAYMENT", "2026-11-14T00:00:00Z", null);
        grant(15, "ADMIN", "2026-11-15T00:00:00Z", "2026-11-15T01:00:00Z");
        grant(13, "PAYMENT", "2026-11-15T17:00:00Z", null);
        code("RDM1", "2026-11-12T00:00:00Z", "2026-11-14T05:00:00Z", null, null);
        code("OLD1", "2026-11-14T02:00:00Z", null, "2026-11-18T00:00:00Z", null);
        code("REV1", "2026-11-14T03:00:00Z", null, null, "2026-11-16T00:00:00Z");
        code("NEW1", "2026-11-14T04:00:00Z", null, null, null);

        var result = report("pro" + RANGE, token("SUPPORT", "ADMIN_ACCESS", "PRO_MEMBER_VIEW"));
        assertThat(result.path("snapshot").path("active").asLong()).isEqualTo(2);
        assertThat(result.path("snapshot").path("expiringSoon").asLong()).isEqualTo(1);
        assertThat(result.path("snapshot").path("expired").asLong()).isEqualTo(1);
        assertThat(result.path("snapshot").path("suspended").asLong()).isEqualTo(1);
        var period = result.path("current");
        assertThat(period.path("grants").asLong()).isEqualTo(3);
        assertThat(period.path("newMembers").asLong()).isEqualTo(1);
        assertThat(period.path("repeatGrants").asLong()).isEqualTo(2);
        assertThat(period.path("paid").asLong()).isEqualTo(1);
        assertThat(period.path("code").asLong()).isEqualTo(1);
        assertThat(period.path("admin").asLong()).isEqualTo(1);
        assertThat(period.path("revocations").asLong()).isEqualTo(1);
        assertThat(result.path("previous").path("grants").asLong()).isEqualTo(1);
        assertThat(result.path("trend").get(0).path("current").asLong()).isEqualTo(3);
        assertThat(result.path("trend").get(1).path("current").asLong()).isZero();
        assertThat(result.path("details").path("recentGrants").size()).isEqualTo(4);
        assertThat(result.path("details").path("codes").isNull()).isTrue();

        var codes = report("pro" + RANGE, token("ADMIN")).path("details").path("codes");
        assertThat(codes.path("created").asLong()).isEqualTo(3);
        assertThat(codes.path("redeemed").asLong()).isEqualTo(1);
        assertThat(codes.path("recent").get(0).path("maskedCode").asString()).endsWith("-RDM1");
        assertThat(codes.toString()).contains("REDEEMED", "AVAILABLE", "REVOKED", "EXPIRED")
            .doesNotContain("test-hash", "codeHash", "referenceCode");
    }

    @Test
    void gemAccountingUsesActualAwardsWalletCreditsDebitsAndVietnamDateBoundaries() throws Exception {
        profile(61, 300);
        profile(62, 48);
        jdbc.update("""
            INSERT INTO learning_activity_days(user_id, activity_date, gems_awarded)
            VALUES (61, '2026-11-14', 25), (62, '2026-11-14', NULL), (61, '2026-11-15', 10)
            """);
        jdbc.update("INSERT INTO learner_rewards VALUES (61, 'FIRST_LESSON', 20, ?)", ts("2026-11-13T17:00:00Z"));
        jdbc.update("INSERT INTO gem_topup_receipts VALUES ('TOPUP_1',61,200,?)", ts("2026-11-14T17:00:00Z"));
        jdbc.update("INSERT INTO gem_topup_receipts VALUES ('TOPUP_PREV',61,50,?)", ts("2026-11-13T16:59:59Z"));
        jdbc.update("INSERT INTO gem_topup_receipts VALUES ('TOPUP_NEXT',61,100,?)", ts("2026-11-15T17:00:00Z"));
        adjustment(61, 5, "2026-11-14T03:00:00Z");
        adjustment(62, -3, "2026-11-15T03:00:00Z");
        adjustment(62, 0, "2026-11-15T04:00:00Z");
        receipt(61, "FRAME_KITTY", 50, true, "2026-11-14T04:00:00Z");
        receipt(61, "STREAK_FREEZE", 25, true, "2026-11-14T05:00:00Z");

        var result = report("gems" + RANGE, token("ADMIN"));
        var period = result.path("current");
        assertThat(period.path("daily").asLong()).isEqualTo(35);
        assertThat(period.path("legacyActivityDays").asLong()).isEqualTo(1);
        assertThat(period.path("issued").asLong()).isEqualTo(260);
        assertThat(period.path("spent").asLong()).isEqualTo(78);
        assertThat(period.path("topups").asLong()).isEqualTo(200);
        assertThat(period.path("rewards").asLong()).isEqualTo(20);
        assertThat(period.path("adminCredits").asLong()).isEqualTo(5);
        assertThat(period.path("adminDebits").asLong()).isEqualTo(3);
        assertThat(result.path("previous").path("issued").asLong()).isEqualTo(50);
        assertThat(result.path("snapshot").path("balance").asLong()).isEqualTo(348);
        assertThat(result.path("snapshot").path("walletsWithBalance").asLong()).isEqualTo(2);
        assertThat(result.path("details").size()).isEqualTo(2);
        assertThat(result.path("details").get(0).path("delta").asLong()).isEqualTo(-3);
        assertThat(result.path("trend").get(0).path("current").asLong()).isEqualTo(50);
        assertThat(result.path("trend").get(1).path("current").asLong()).isEqualTo(210);
    }

    @Test
    void shopSeparatesAcquisitionsLegacyReceiptsFreezeUsageAndCurrentInventory() throws Exception {
        profile(71, 0);
        profile(72, 0);
        jdbc.update("UPDATE learner_profiles SET active_frame='FRAME_KITTY',streak_freezes=3 WHERE user_id=71");
        jdbc.update("INSERT INTO shop_inventory VALUES (71,'FRAME_KITTY',?), (72,'FRAME_KITTY',?)",
            ts("2026-11-14T10:00:00Z"), ts("2026-11-14T10:00:00Z"));
        receipt(71, "FRAME_KITTY", 75, null, "2026-11-14T00:00:00Z");
        receipt(72, "FRAME_KITTY", 0, true, "2026-11-14T01:00:00Z");
        receipt(72, "FRAME_KITTY", 0, false, "2026-11-14T02:00:00Z");
        receipt(72, "FRAME_KITTY", 0, null, "2026-11-14T03:00:00Z");
        receipt(72, "STREAK_FREEZE", 25, true, "2026-11-14T04:00:00Z");
        receipt(72, "STREAK_FREEZE", 0, null, "2026-11-14T05:00:00Z");
        receipt(71, "STREAK_FREEZE", 25, true, "2026-11-12T07:00:00Z");
        jdbc.update("INSERT INTO learning_frozen_days VALUES (71,'2026-11-12',?)", ts("2026-11-14T12:00:00Z"));

        var result = report("shop" + RANGE, token("SUPPORT", "ADMIN_ACCESS", "SHOP_VIEW"));
        var period = result.path("current");
        assertThat(period.path("purchases").asLong()).isEqualTo(4);
        assertThat(period.path("buyers").asLong()).isEqualTo(2);
        assertThat(period.path("gemSpent").asLong()).isEqualTo(100);
        assertThat(period.path("freezePurchases").asLong()).isEqualTo(2);
        assertThat(period.path("freezeUses").asLong()).isEqualTo(1);
        assertThat(period.path("unclassifiedReceipts").asLong()).isEqualTo(1);
        assertThat(result.path("snapshot").path("freezesInWallets").asLong()).isEqualTo(3);
        assertThat(result.path("snapshot").path("ownedItems").asLong()).isEqualTo(2);
        assertThat(result.path("snapshot").path("equippedItems").asLong()).isEqualTo(1);
        assertThat(result.path("snapshot").path("equipRate").asDouble()).isEqualTo(50);
        assertThat(result.path("previous").path("purchases").asLong()).isEqualTo(1);
        var item = result.path("details").get(0);
        assertThat(item.path("code").asString()).isEqualTo("FRAME_KITTY");
        assertThat(item.path("currentPrice").asInt()).isEqualTo(150);
        assertThat(item.path("gemSpent").asLong()).isEqualTo(75);
        assertThat(item.path("owners").asLong()).isEqualTo(2);
        assertThat(item.path("equipped").asLong()).isEqualTo(1);
        assertThat(item.path("equipRate").asDouble()).isEqualTo(50);
        assertThat(result.path("details").get(1).path("owners").isNull()).isTrue();
        assertThat(result.path("details").get(1).path("equipRate").isNull()).isTrue();
    }

    @Test
    void currentActivityPersistsTheAwardAndCountsFreeItemsOnlyWhenGranted() throws Exception {
        engagement.lessonCompleted(81, 1);
        engagement.lessonCompleted(81, 2);
        shop.grantGems("REPORT_TOPUP", 81, 200);
        shop.grantGems("REPORT_TOPUP", 81, 200);
        var purchase = new PurchaseRequest("FRAME_CLASSIC", "analytics-first-purchase-1");
        shop.purchase(81, purchase);
        shop.purchase(81, purchase);
        shop.purchase(81, new PurchaseRequest("FRAME_CLASSIC", "analytics-already-owned-2"));
        var gems = report("gems" + TODAY, token("ADMIN")).path("current");
        assertThat(gems.path("issued").asLong()).isEqualTo(225);
        assertThat(gems.path("daily").asLong()).isEqualTo(25);
        assertThat(gems.path("legacyActivityDays").asLong()).isZero();
        var purchases = report("shop" + TODAY, token("ADMIN")).path("current");
        assertThat(purchases.path("purchases").asLong()).isEqualTo(1);
        assertThat(purchases.path("gemSpent").asLong()).isZero();
        assertThat(purchases.path("unclassifiedReceipts").asLong()).isZero();
    }

    private void profile(long id, int gems) {
        jdbc.update("INSERT INTO learner_profiles(user_id, display_name, gems) VALUES (?, ?, ?)", id, "Learner " + id, gems);
    }

    private void member(long id, String expiration, boolean suspended) {
        jdbc.update("INSERT INTO pro_memberships(user_id, expires_at, suspended) VALUES (?, ?, ?)", id, ts(expiration), suspended);
    }

    private void grant(long id, String type, String granted, String revoked) {
        jdbc.update("""
            INSERT INTO pro_grants(reference_code,user_id,source_type,plan_code,duration_months,granted_at,revoked_at)
            VALUES (?, ?, ?, 'PRO_MONTH', 1, ?, ?)
            """, type + "-" + id + "-" + granted, id, type, ts(granted), ts(revoked));
    }

    private void code(String suffix, String created, String redeemed, String expires, String revoked) {
        jdbc.update("""
            INSERT INTO pro_activation_codes(code_hash,code_suffix,plan_code,duration_months,created_by,
                created_at,redeemed_at,expires_at,revoked_at)
            VALUES (?, ?, 'PRO_MONTH', 1, 99, ?, ?, ?, ?)
            """, "test-hash-" + suffix, suffix, ts(created), ts(redeemed), ts(expires), ts(revoked));
    }

    private void receipt(long user, String item, int gems, Boolean granted, String created) {
        jdbc.update("""
            INSERT INTO shop_purchases(user_id,request_id,item_code,gems_spent,created_at,item_granted)
            VALUES (?, ?, ?, ?, ?, ?)
            """, user, item + "-" + created, item, gems, ts(created), granted);
    }

    private void adjustment(long user, int delta, String time) {
        jdbc.update("""
            INSERT INTO learner_admin_adjustments(user_id,actor_id,request_id,gems_delta,xp_delta,freezes_delta,
                gems_before,gems_after,xp_before,xp_after,freezes_before,freezes_after,reason,created_at)
            VALUES (?,99,?,?,0,0,10,?,0,0,0,0,'Support adjustment',?)
            """, user, "adjustment-" + time, delta, 10 + delta, ts(time));
    }

    private Timestamp ts(String value) {
        return value == null ? null : Timestamp.from(Instant.parse(value));
    }

    private String token(String role, String... permissions) {
        Instant now = Instant.now();
        return Jwts.builder().subject("99").issuer("sgedu").claim("tokenType", "access")
            .claim("role", "ADMIN".equals(role) ? "ADMIN" : "USER")
            .claim("roles", List.of(role)).claim("permissions", List.of(permissions))
            .issuedAt(Date.from(now.minusSeconds(1))).expiration(Date.from(now.plusSeconds(300)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
    }

    private JsonNode report(String path, String token) throws Exception {
        var response = get(path, token);
        assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(200);
        return json.readTree(response.body()).path("data");
    }

    private HttpResponse<String> get(String path, String token) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/learning/admin/analytics/" + path));
        if (token != null) request.header("Authorization", "Bearer " + token);
        return client.send(request.GET().build(), HttpResponse.BodyHandlers.ofString());
    }
}
