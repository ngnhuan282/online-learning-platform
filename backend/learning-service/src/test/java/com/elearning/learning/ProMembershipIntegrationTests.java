package com.elearning.learning;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.dto.EnrollRequest;
import com.elearning.learning.dto.PaymentEnrollmentRequest;
import com.elearning.learning.dto.ProModels.*;
import com.elearning.learning.service.*;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
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
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.datasource.url=jdbc:h2:mem:proMembership;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "security.jwt.secret=pro-membership-integration-secret-at-least-32-bytes",
        "integrations.internal-service-token=pro-internal-integration-token-at-least-32-bytes",
        "logging.level.root=WARN",
    }
)
@ActiveProfiles("test")
class ProMembershipIntegrationTests {

    private static final String SECRET = "pro-membership-integration-secret-at-least-32-bytes";
    private static final String INTERNAL = "pro-internal-integration-token-at-least-32-bytes";

    @LocalServerPort
    int port;

    @Autowired
    ProMembershipService pro;

    @Autowired
    LearningService learning;

    @Autowired
    QuizService quizzes;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JsonMapper json;

    @MockitoBean
    Clock clock;

    @MockitoBean
    CourseCatalogClient catalog;

    final AtomicReference<Instant> now = new AtomicReference<>();

    @BeforeEach
    void setup() {
        now.set(Instant.parse("2030-01-31T03:00:00Z"));
        when(clock.instant()).thenAnswer(call -> now.get());
        for (String table : List.of(
            "pro_activation_codes",
            "pro_grants",
            "pro_memberships",
            "pro_activation_attempts",
            "payment_enrollment_receipts",
            "enrollments",
            "notifications"
        ))
            jdbc.update("DELETE FROM " + table);
        when(catalog.requirePublishedCourse(10L)).thenReturn(false);
        when(catalog.requirePublishedCourse(11L)).thenReturn(true);
        doThrow(new AppException(ErrorCode.FORBIDDEN)).when(catalog).requireFreeCourse(10L);
    }

    @Test
    void grant_whenMembershipIsRenewedOrRefunded_shouldPreserveIndependentGrants() {
        // Arrange
        // Act
        var first = pro.grant(new GrantRequest("LS-PAY-PRO-FIRST", 1L, "PRO_MONTH", 1));
        assertThat(first.expiresAt()).isEqualTo(Instant.parse("2030-02-28T03:00:00Z"));
        assertThat(pro.grant(new GrantRequest("LS-PAY-PRO-FIRST", 1L, "PRO_MONTH", 1)).expiresAt()).isEqualTo(
            first.expiresAt()
        );
        assertThatThrownBy(() ->
            pro.grant(new GrantRequest("LS-PAY-PRO-FIRST", 2L, "PRO_MONTH", 1))
        ).isInstanceOf(AppException.class);
        now.set(Instant.parse("2030-02-15T03:00:00Z"));
        assertThat(
            pro.grant(new GrantRequest("LS-PAY-PRO-SECOND", 1L, "PRO_QUARTER", 3)).expiresAt()
        ).isEqualTo(Instant.parse("2030-05-28T03:00:00Z"));
        assertThat(pro.revoke(new RevokeRequest("LS-PAY-PRO-SECOND", 1L)).expiresAt()).isEqualTo(
            first.expiresAt()
        );
        assertThat(
            pro.grant(new GrantRequest("LS-PAY-PRO-SECOND", 1L, "PRO_QUARTER", 3)).expiresAt()
        ).isEqualTo(first.expiresAt());
        now.set(Instant.parse("2030-03-01T03:00:00Z"));
        // Assert
        assertThat(pro.membership(1).active()).isFalse();
        assertThat(pro.grant(new GrantRequest("LS-PAY-PRO-THIRD", 1L, "PRO_YEAR", 12)).expiresAt()).isEqualTo(
            Instant.parse("2031-03-01T03:00:00Z")
        );
    }

    @Test
    void grant_whenSamePaymentArrivesConcurrently_shouldExtendMembershipOnce() throws Exception {
        // Arrange
        // Act
        try (var pool = Executors.newFixedThreadPool(6)) {
            var tasks = java.util.stream.IntStream.range(0, 12)
                .mapToObj(i ->
                    pool.submit(() -> pro.grant(new GrantRequest("LS-PAY-CONCURRENT", 3L, "PRO_MONTH", 1)))
                )
                .toList();
            for (var task : tasks) task.get(15, TimeUnit.SECONDS);
        }
        // Assert
        assertThat(pro.membership(3).expiresAt()).isEqualTo(Instant.parse("2030-02-28T03:00:00Z"));
        assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM pro_grants WHERE user_id=3", Long.class)
        ).isEqualTo(1);
    }

    @Test
    void redeem_whenAdminIssuesActivationCode_shouldExposeSecretOnceAndPreventReuse() throws Exception {
        // Arrange
        // Act
        assertThat(
            request(
                1L,
                false,
                "POST",
                "/api/v1/learning/admin/pro/codes",
                "{\"planCode\":\"PRO_MONTH\"}",
                null
            ).statusCode()
        ).isEqualTo(403);
        var issue = request(
            1L,
            true,
            "POST",
            "/api/v1/learning/admin/pro/codes",
            "{\"planCode\":\"PRO_QUARTER\"}",
            null
        );
        assertThat(issue.statusCode()).isEqualTo(200);
        String code = json.readTree(issue.body()).path("data").path("code").asString();
        assertThat(code).matches("CCG-(?:[A-F0-9]{4}-){7}[A-F0-9]{4}");
        assertThat(jdbc.queryForObject("SELECT code_hash FROM pro_activation_codes", String.class))
            .hasSize(64)
            .doesNotContain(code);
        var list = request(1L, true, "GET", "/api/v1/learning/admin/pro/codes", null, null);
        assertThat(list.body()).doesNotContain(code);
        String redeem = "{\"code\":\"" + code + "\"}";
        var first = request(2L, false, "POST", "/api/v1/learning/pro/redeem", redeem, null);
        assertThat(first.statusCode()).isEqualTo(200);
        Instant expiry = pro.membership(2).expiresAt();
        // Assert
        assertThat(
            request(2L, false, "POST", "/api/v1/learning/pro/redeem", redeem, null).statusCode()
        ).isEqualTo(200);
        assertThat(pro.membership(2).expiresAt()).isEqualTo(expiry);
        assertThat(
            request(3L, false, "POST", "/api/v1/learning/pro/redeem", redeem, null).statusCode()
        ).isEqualTo(400);
        assertThat(pro.membership(3).active()).isFalse();
    }

    @Test
    void redeem_whenAttemptsAreConcurrentOrInvalid_shouldAllowOneWinnerAndRateLimitFailures() throws Exception {
        // Arrange
        String code = pro.createCode(1L, new CreateCodeRequest("PRO_YEAR", null)).code();
        // Act
        try (var pool = Executors.newFixedThreadPool(2)) {
            var tasks = List.of(21L, 22L)
                .stream()
                .map(user ->
                    pool.submit(() -> {
                        try {
                            pro.redeem(user, code);
                            return true;
                        } catch (AppException invalid) {
                            return false;
                        }
                    })
                )
                .toList();
            int winners = 0;
            for (var task : tasks) if (task.get(15, TimeUnit.SECONDS)) winners++;
            assertThat(winners).isEqualTo(1);
        }
        for (int i = 0; i < 6; i++) assertThat(
            request(
                9L,
                false,
                "POST",
                "/api/v1/learning/pro/redeem",
                "{\"code\":\"invalid\"}",
                null
            ).statusCode()
        ).isEqualTo(400);
        assertThat(
            request(
                9L,
                false,
                "POST",
                "/api/v1/learning/pro/redeem",
                "{\"code\":\"invalid\"}",
                null
            ).statusCode()
        ).isEqualTo(429);
        now.set(now.get().plusSeconds(901));
        // Assert
        assertThat(
            request(
                9L,
                false,
                "POST",
                "/api/v1/learning/pro/redeem",
                "{\"code\":\"invalid\"}",
                null
            ).statusCode()
        ).isEqualTo(400);
    }

    @Test
    void redeem_whenCodeIsExpiredOrRevoked_shouldDenyActivation() {
        // Arrange
        // Act
        var revoked = pro.createCode(1L, new CreateCodeRequest("PRO_MONTH", null));
        pro.revokeCode(revoked.info().id());
        assertThatThrownBy(() -> pro.redeem(2L, revoked.code())).isInstanceOf(AppException.class);
        var expired = pro.createCode(1L, new CreateCodeRequest("PRO_MONTH", now.get().plusSeconds(60)));
        now.set(now.get().plusSeconds(60));
        // Assert
        assertThatThrownBy(() -> pro.redeem(2L, expired.code())).isInstanceOf(AppException.class);
        assertThat(pro.membership(2).active()).isFalse();
    }

    @Test
    void authorize_whenProMembershipExpires_shouldBlockProOnlyContentAndKeepPermanentPurchases() {
        // Arrange
        // Act
        pro.grant(new GrantRequest("LS-PAY-PRO-ACCESS", 5L, "PRO_MONTH", 1));
        // Assert
        assertThat(learning.enroll(5L, new EnrollRequest(10L)).accessSource()).isEqualTo("PRO");
        assertThat(learning.enroll(5L, new EnrollRequest(11L)).accessSource()).isEqualTo("COURSE");
        assertThat(learning.checkEnrollment(5L, 10L).enrolled()).isTrue();
        quizzes.listPublished(5L, 10L);
        now.set(Instant.parse("2030-03-01T03:00:00Z"));
        assertThat(learning.checkEnrollment(5L, 10L).enrolled()).isFalse();
        assertThat(learning.checkEnrollment(5L, 11L).enrolled()).isTrue();
        assertThatThrownBy(() -> learning.getCourseProgress(5L, 10L)).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> quizzes.listPublished(5L, 10L)).isInstanceOf(AppException.class);
        learning.enrollFromPayment(new PaymentEnrollmentRequest("LS-PAY-PERMANENT", 5L, 10L));
        assertThat(learning.checkEnrollment(5L, 10L).enrolled()).isTrue();
        assertThat(
            learning
                .getMyEnrollments(5L)
                .stream()
                .filter(item -> item.courseId() == 10L)
                .findFirst()
                .orElseThrow()
                .accessSource()
        ).isEqualTo("COURSE");
        quizzes.listPublished(5L, 10L);
    }

    @Test
    void grant_whenInternalCredentialOrSnapshotIsInvalid_shouldRejectGrant() throws Exception {
        // Arrange
        String body =
            "{\"orderCode\":\"LS-PAY-INTERNAL\",\"userId\":4,\"planCode\":\"PRO_YEAR\",\"durationMonths\":12}";
        // Act
        String path = "/internal/v1/learning/pro/grants";

        // Assert
        assertThat(request(4L, true, "POST", path, body, null).statusCode()).isEqualTo(401);
        assertThat(request(null, false, "POST", path, body, "incorrect").statusCode()).isEqualTo(401);
        assertThat(request(null, false, "POST", path, body, INTERNAL).statusCode()).isEqualTo(200);
        assertThat(
            request(null, false, "POST", path, body.replace("12", "3"), INTERNAL).statusCode()
        ).isEqualTo(400);
        assertThat(request(null, false, "GET", "/api/v1/learning/pro/me", null, null).statusCode()).isEqualTo(
            401
        );
    }

    private HttpResponse<String> request(
        Long user,
        boolean admin,
        String method,
        String path,
        String body,
        String internal
    ) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).header(
            "Content-Type",
            "application/json"
        );
        if (user != null) {
            Instant time = Instant.now();
            String token = Jwts.builder()
                .subject(user.toString())
                .issuer("sgedu")
                .claim("role", admin ? "ADMIN" : "USER")
                .claim("tokenType", "access")
                .issuedAt(Date.from(time))
                .expiration(Date.from(time.plusSeconds(300)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();
            builder.header("Authorization", "Bearer " + token);
        }
        if (internal != null) builder.header("X-Internal-Service-Token", internal);
        return HttpClient.newHttpClient().send(
            builder
                .method(
                    method,
                    body == null
                        ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(body)
                )
                .build(),
            HttpResponse.BodyHandlers.ofString()
        );
    }
}
