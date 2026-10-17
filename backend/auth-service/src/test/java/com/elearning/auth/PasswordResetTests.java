package com.elearning.auth;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.elearning.auth.config.PasswordResetProperties;
import com.elearning.auth.controller.PasswordResetController;
import com.elearning.auth.entity.UserExternalIdentity;
import com.elearning.auth.repository.UserExternalIdentityRepository;
import com.elearning.auth.repository.UserRepository;
import com.elearning.auth.service.GoogleLoginCodeService;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "security.password-reset.mail-enabled=true",
        "spring.mail.host=smtp.example.test",
        "spring.mail.port=587",
        "spring.mail.username=sender@example.test",
        "spring.mail.password=test-only-mail-password",
        "security.password-reset.mail-from=sender@example.test",
        "security.password-reset.token-ttl-minutes=15",
        "security.password-reset.frontend-reset-url=http://localhost:5173/reset-password",
        "security.google.enabled=true",
        "security.google.client-id=reset-test-client",
        "security.google.client-secret=reset-test-secret",
    }
)
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class PasswordResetTests {

    static final String PASSWORD = "OriginalPassword9!";
    static final String NEW_PASSWORD = "NewPassword8!";
    static final String FORGOT = "/api/v1/auth/forgot-password";
    static final String RESET = "/api/v1/auth/reset-password";
    static final String SECRET = UUID.randomUUID().toString().repeat(2);

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
        String mysql = System.getenv("PASSWORD_RESET_TEST_DB_URL");
        registry.add("spring.datasource.url", () ->
            mysql == null ? "jdbc:h2:mem:password_reset;MODE=MySQL;DB_CLOSE_DELAY=-1" : mysql
        );
        if (mysql != null) {
            registry.add("spring.datasource.username", () ->
                System.getenv("PASSWORD_RESET_TEST_DB_USERNAME")
            );
            registry.add("spring.datasource.password", () ->
                System.getenv("PASSWORD_RESET_TEST_DB_PASSWORD")
            );
            registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
        }
    }

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    UserRepository users;

    @Autowired
    UserExternalIdentityRepository identities;

    @Autowired
    PasswordEncoder encoder;

    @Autowired
    PasswordResetProperties properties;

    @Autowired
    GoogleLoginCodeService googleCodes;

    @Autowired
    @Qualifier("passwordResetMailExecutor")
    ThreadPoolTaskExecutor executor;

    @MockitoBean
    JavaMailSender sender;

    final HttpClient client = HttpClient.newHttpClient();
    final LinkedBlockingQueue<MimeMessage> messages = new LinkedBlockingQueue<>();
    final AtomicBoolean outsideTransaction = new AtomicBoolean(true);

    @BeforeEach
    void mailbox() {
        when(sender.createMimeMessage()).thenAnswer(call ->
            new MimeMessage(Session.getInstance(new Properties()))
        );
        doAnswer(call -> {
            if (TransactionSynchronizationManager.isActualTransactionActive()) outsideTransaction.set(false);
            messages.add(call.getArgument(0, MimeMessage.class));
            return null;
        })
            .when(sender)
            .send(any(MimeMessage.class));
    }

    @AfterEach
    void finishMailJobs() throws Exception {
        long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(8);
        while (
                (executor.getActiveCount() != 0 || executor.getThreadPoolExecutor().getQueue().size() != 0) &&
                System.nanoTime() < until
            )
            Thread.sleep(10);
        assertThat(executor.getActiveCount()).isZero();
        assertThat(outsideTransaction.get()).isTrue();
    }

    HttpResponse<String> request(String path, Object body, String cookie, String access) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (body != null) builder
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        if (cookie != null) builder.header("Cookie", cookie);
        if (access != null) builder.header("Authorization", "Bearer " + access);
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    JsonNode data(HttpResponse<String> response) {
        return json.readTree(response.body()).get("data");
    }

    String email() {
        return UUID.randomUUID() + "@example.test";
    }

    record Account(long id, String email, String access, String cookie) {
        @Override
        public String toString() {
            return "ResetTestAccount[redacted]";
        }
    }

    Account account() throws Exception {
        String email = email();
        assertThat(
            request(
                "/api/v1/auth/register",
                Map.of("email", email, "fullName", "Reset Learner", "password", PASSWORD),
                null,
                null
            ).statusCode()
        ).isEqualTo(201);
        return login(email, PASSWORD);
    }

    Account login(String email, String password) throws Exception {
        var response = request(
            "/api/v1/auth/login",
            Map.of("email", email, "password", password),
            null,
            null
        );
        assertThat(response.statusCode()).isEqualTo(200);
        return new Account(
            data(response).get("user").get("id").asLong(),
            email,
            data(response).get("accessToken").asString(),
            cookie(response)
        );
    }

    String cookie(HttpResponse<String> response) {
        return response.headers().firstValue("Set-Cookie").orElseThrow().split(";", 2)[0];
    }

    HttpResponse<String> forgot(String email) throws Exception {
        return request(FORGOT, Map.of("email", email), null, "broken");
    }

    HttpResponse<String> resetPassword(String token) throws Exception {
        return request(
            RESET,
            Map.of("token", token, "newPassword", NEW_PASSWORD, "confirmPassword", NEW_PASSWORD),
            null,
            "broken"
        );
    }

    String issue(String email) throws Exception {
        var result = forgot(email);
        assertThat(result.statusCode()).isEqualTo(200);
        assertThat(json.readTree(result.body()).get("message").asString()).isEqualTo(
            PasswordResetController.NOTICE
        );
        var message = messages.poll(5, TimeUnit.SECONDS);
        assertThat(message != null).isTrue();
        assertThat(message.getSubject()).isEqualTo("SGEdu — Đặt lại mật khẩu");
        String content = message.getContent().toString();
        assertThat(content).contains(
            "15 phút",
            "bỏ qua email này",
            "http://localhost:5173/reset-password#token="
        );
        var match = Pattern.compile("#token=([A-Za-z0-9_-]{43})").matcher(content);
        assertThat(match.find()).isTrue();
        return match.group(1);
    }

    String hash(String value) throws Exception {
        return HexFormat.of().formatHex(
            MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))
        );
    }

    void releaseCooldown(String email) throws Exception {
        jdbc.update(
            "UPDATE password_reset_rate_limits SET last_requested_at = ? WHERE bucket_key = ?",
            Timestamp.from(Instant.now().minusSeconds(61)),
            hash(email)
        );
    }

    long tokenCount(long userId) {
        return jdbc.queryForObject(
            "SELECT COUNT(*) FROM password_reset_tokens WHERE user_id = ?",
            Long.class,
            userId
        );
    }

    void invalid(HttpResponse<String> result) throws Exception {
        assertThat(result.statusCode()).isEqualTo(400);
        assertThat(json.readTree(result.body()).get("code").asString()).isEqualTo(
            "PASSWORD_RESET_TOKEN_INVALID"
        );
    }

    @Test
    void utf8MailUsesFixedFragmentLinkAndDatabaseStoresOnlyExpiringHash() throws Exception {
        var local = account();
        String before = users.findById(local.id()).orElseThrow().getPasswordHash();
        String token = issue(" " + local.email().toUpperCase() + " ");
        String stored = jdbc.queryForObject(
            "SELECT token_hash FROM password_reset_tokens WHERE user_id = ?",
            String.class,
            local.id()
        );
        assertThat(stored.equals(token)).isFalse();
        assertThat(stored.equals(hash(token))).isTrue();
        var expiry = jdbc
            .queryForObject(
                "SELECT expires_at FROM password_reset_tokens WHERE user_id = ?",
                Timestamp.class,
                local.id()
            )
            .toInstant();
        assertThat(expiry).isBetween(Instant.now().plusSeconds(880), Instant.now().plusSeconds(901));
        assertThat(users.findById(local.id()).orElseThrow().getPasswordHash().equals(before)).isTrue();
        assertThat(request("/api/v1/auth/reset-password", null, null, null).statusCode()).isEqualTo(401);
    }

    @Test
    void resetKeepsProfileRolesAndGoogleIdentityAndRevokesAllSessionsAndLinkIntents() throws Exception {
        var local = account();
        var second = login(local.email(), PASSWORD);
        var entity = users.findById(local.id()).orElseThrow();
        identities.save(new UserExternalIdentity(entity, UUID.randomUUID().toString(), local.email()));
        long identityId = identities.findByUserIdAndProvider(local.id(), "GOOGLE").orElseThrow().getId();
        var before = data(request("/api/v1/users/me", null, null, local.access()));
        assertThat(
            request(
                "/api/v1/auth/google/link/start",
                Map.of("currentPassword", PASSWORD, "challenge", "c".repeat(43)),
                local.cookie(),
                local.access()
            ).statusCode()
        ).isEqualTo(200);
        String intent = jdbc.queryForObject(
            "SELECT intent_hash FROM google_link_intents WHERE user_id = ?",
            String.class,
            local.id()
        );
        googleCodes.issueLink(
            local.id(),
            "c".repeat(43),
            intent,
            UUID.randomUUID().toString(),
            local.email()
        );
        String token = issue(local.email());
        var reset = resetPassword(token);
        assertThat(reset.statusCode()).isEqualTo(200);
        assertThat(reset.body()).doesNotContain("accessToken", "passwordHash");
        assertThat(reset.headers().firstValue("Set-Cookie").orElseThrow()).contains("Max-Age=0");
        assertThat(
            encoder.matches(NEW_PASSWORD, users.findById(local.id()).orElseThrow().getPasswordHash())
        ).isTrue();
        assertThat(data(request("/api/v1/users/me", null, null, local.access()))).isEqualTo(before);
        assertThat(identities.findByUserIdAndProvider(local.id(), "GOOGLE").orElseThrow().getId()).isEqualTo(
            identityId
        );
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM google_link_intents WHERE user_id = ?",
                Long.class,
                local.id()
            )
        ).isZero();
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM oauth_login_codes WHERE user_id = ? AND purpose = 'LINK'",
                Long.class,
                local.id()
            )
        ).isZero();
        for (var session : List.of(local, second))
            assertThat(
                request("/api/v1/auth/refresh", Map.of(), session.cookie(), null).statusCode()
            ).isEqualTo(401);
        assertThat(
            request(
                "/api/v1/auth/login",
                Map.of("email", local.email(), "password", PASSWORD),
                null,
                null
            ).statusCode()
        ).isEqualTo(401);
        assertThat(login(local.email(), NEW_PASSWORD).id()).isEqualTo(local.id());
        invalid(resetPassword(token));
    }

    @Test
    void newAcceptedRequestInvalidatesOlderLink() throws Exception {
        var local = account();
        String old = issue(local.email());
        releaseCooldown(local.email());
        String current = issue(local.email());
        invalid(resetPassword(old));
        assertThat(resetPassword(current).statusCode()).isEqualTo(200);
    }

    @Test
    void expirationMalformedAndUnknownTokensCannotChangePassword() throws Exception {
        var local = account();
        String token = issue(local.email());
        jdbc.update(
            "UPDATE password_reset_tokens SET expires_at = ? WHERE user_id = ?",
            Timestamp.from(Instant.now().minusSeconds(1)),
            local.id()
        );
        for (String value : List.of(token, "wrong", "x".repeat(43))) invalid(resetPassword(value));
        assertThat(login(local.email(), PASSWORD).id()).isEqualTo(local.id());
    }

    @Test
    void invalidPasswordAndConfirmationDoNotConsumeToken() throws Exception {
        var local = account();
        String token = issue(local.email());
        for (var input : List.of(
            Map.of("newPassword", "weak", "confirmPassword", "weak"),
            Map.of("newPassword", NEW_PASSWORD, "confirmPassword", "different"),
            Map.of("newPassword", "Aa1" + "界".repeat(24), "confirmPassword", "Aa1" + "界".repeat(24))
        )) {
            assertThat(
                request(
                    RESET,
                    Map.of(
                        "token",
                        token,
                        "newPassword",
                        input.get("newPassword"),
                        "confirmPassword",
                        input.get("confirmPassword")
                    ),
                    null,
                    null
                ).statusCode()
            ).isEqualTo(400);
            assertThat(tokenCount(local.id())).isEqualTo(1L);
        }
        assertThat(resetPassword(token).statusCode()).isEqualTo(200);
    }

    @Test
    void unknownGoogleOnlyInactiveAndLocalEmailsGetSameNotice() throws Exception {
        var google = account();
        jdbc.update("UPDATE users SET password_hash = NULL WHERE id = ?", google.id());
        identities.save(
            new UserExternalIdentity(
                users.findById(google.id()).orElseThrow(),
                UUID.randomUUID().toString(),
                google.email()
            )
        );
        var locked = account();
        jdbc.update("UPDATE users SET status = 'LOCKED' WHERE id = ?", locked.id());
        for (String email : List.of(email(), google.email(), locked.email())) {
            var response = forgot(email);
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(json.readTree(response.body()).get("message").asString()).isEqualTo(
                PasswordResetController.NOTICE
            );
        }
        finishMailJobs();
        verify(sender, never()).send(any(MimeMessage.class));
        assertThat(tokenCount(google.id())).isZero();
        assertThat(tokenCount(locked.id())).isZero();
    }

    @Test
    void mysqlAccentInsensitiveLookupCannotSendResetToAnotherAddress() throws Exception {
        String storedEmail = "é" + UUID.randomUUID() + "@example.test";
        assertThat(
            request(
                "/api/v1/auth/register",
                Map.of("email", storedEmail, "fullName", "Exact Email", "password", PASSWORD),
                null,
                null
            ).statusCode()
        ).isEqualTo(201);
        var local = login(storedEmail, PASSWORD);
        assertThat(forgot(storedEmail.replace("é", "e")).statusCode()).isEqualTo(200);
        finishMailJobs();
        verify(sender, never()).send(any(MimeMessage.class));
        assertThat(tokenCount(local.id())).isZero();
        issue(storedEmail);
        verify(sender, times(1)).send(any(MimeMessage.class));
    }

    @Test
    void changingCapabilitiesOrStatusAfterIssuanceRejectsReset() throws Exception {
        for (String update : List.of(
            "status = 'LOCKED'",
            "status = 'DISABLED'",
            "deleted_at = CURRENT_TIMESTAMP",
            "password_hash = NULL",
            "credential_version = credential_version + 1"
        )) {
            var local = account();
            String token = issue(local.email());
            // Values are fixed test SQL fragments, never request data.
            jdbc.update("UPDATE users SET " + update + " WHERE id = ?", local.id());
            invalid(resetPassword(token));
        }
    }

    @Test
    void perEmailCooldownAndWindowLimitApplyEvenToUnknownAddresses() throws Exception {
        String unknown = email();
        assertThat(forgot(unknown).statusCode()).isEqualTo(200);
        assertThat(forgot(" " + unknown.toUpperCase() + " ").statusCode()).isEqualTo(429);
        for (int count = 0; count < 2; count++) {
            releaseCooldown(unknown);
            assertThat(forgot(unknown).statusCode()).isEqualTo(200);
        }
        releaseCooldown(unknown);
        assertThat(forgot(unknown).statusCode()).isEqualTo(429);
        jdbc.update(
            "UPDATE password_reset_rate_limits SET window_start = ? WHERE bucket_key = ?",
            Timestamp.from(Instant.now().minusSeconds(901)),
            hash(unknown)
        );
        assertThat(forgot(unknown).statusCode()).isEqualTo(200);
    }

    @Test
    void simultaneousForgotRequestsIssueOnlyOneEmailAndToken() throws Exception {
        var local = account();
        var calls = IntStream.range(0, 3)
            .mapToObj(index ->
                CompletableFuture.supplyAsync(() -> {
                    try {
                        return forgot(local.email()).statusCode();
                    } catch (Exception failure) {
                        throw new IllegalStateException(failure);
                    }
                })
            )
            .toList();
        assertThat(calls.stream().map(CompletableFuture::join).toList()).containsExactlyInAnyOrder(
            200,
            429,
            429
        );
        finishMailJobs();
        verify(sender, times(1)).send(any(MimeMessage.class));
        assertThat(tokenCount(local.id())).isEqualTo(1L);
    }

    @Test
    void concurrentResetConsumesExactlyOnce() throws Exception {
        var local = account();
        String token = issue(local.email());
        var first = CompletableFuture.supplyAsync(() -> resetStatus(token));
        var second = CompletableFuture.supplyAsync(() -> resetStatus(token));
        assertThat(List.of(first.join(), second.join())).containsExactlyInAnyOrder(200, 400);
        assertThat(tokenCount(local.id())).isZero();
        assertThat(users.findById(local.id()).orElseThrow().getCredentialVersion()).isEqualTo(1L);
    }

    int resetStatus(String token) {
        try {
            return resetPassword(token).statusCode();
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
    }

    @Test
    void resetRacingRotationRevokesTheResultingRefreshCookieToo() throws Exception {
        var local = account();
        login(local.email(), PASSWORD);
        String token = issue(local.email());
        var resetting = CompletableFuture.supplyAsync(() -> resetStatus(token));
        var rotating = CompletableFuture.supplyAsync(() -> {
            try {
                return request("/api/v1/auth/refresh", Map.of(), local.cookie(), null);
            } catch (Exception failure) {
                throw new IllegalStateException(failure);
            }
        });
        assertThat(resetting.join()).isEqualTo(200);
        var rotated = rotating.join();
        assertThat(rotated.statusCode()).isIn(200, 401);
        if (rotated.statusCode() == 200) assertThat(
            request("/api/v1/auth/refresh", Map.of(), cookie(rotated), null).statusCode()
        ).isEqualTo(401);
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL",
                Long.class,
                local.id()
            )
        ).isZero();
    }

    @Test
    void smtpFailureIsControlledAndDoesNotLeakOrLeaveUsableToken(CapturedOutput output) throws Exception {
        var local = account();
        String privateDetail = "SMTP-private-provider-detail-never-log";
        doThrow(new MailAuthenticationException(privateDetail)).when(sender).send(any(MimeMessage.class));
        var response = forgot(local.email());
        assertThat(response.statusCode()).isEqualTo(200);
        finishMailJobs();
        assertThat(tokenCount(local.id())).isZero();
        assertThat(response.body().contains(privateDetail)).isFalse();
        assertThat(output.getAll().contains(privateDetail)).isFalse();
    }

    @Test
    void slowSmtpDoesNotHoldTheUserTransactionOrBlockReset() throws Exception {
        var local = account();
        var release = new CountDownLatch(1);
        doAnswer(call -> {
            if (TransactionSynchronizationManager.isActualTransactionActive()) outsideTransaction.set(false);
            messages.add(call.getArgument(0, MimeMessage.class));
            if (!release.await(10, TimeUnit.SECONDS)) throw new IllegalStateException(
                "SMTP test was not released"
            );
            return null;
        })
            .when(sender)
            .send(any(MimeMessage.class));
        try {
            String token = issue(local.email());
            assertThat(resetPassword(token).statusCode()).isEqualTo(200);
            assertThat(outsideTransaction.get()).isTrue();
        } finally {
            release.countDown();
        }
    }

    @Test
    void olderSmtpFailureCannotDeleteAReplacementToken() throws Exception {
        var local = account();
        var release = new CountDownLatch(1);
        var first = new AtomicBoolean(true);
        doAnswer(call -> {
            messages.add(call.getArgument(0, MimeMessage.class));
            if (first.getAndSet(false)) {
                if (!release.await(10, TimeUnit.SECONDS)) throw new IllegalStateException(
                    "SMTP test was not released"
                );
                throw new MailAuthenticationException("Test SMTP failure");
            }
            return null;
        })
            .when(sender)
            .send(any(MimeMessage.class));
        try {
            String old = issue(local.email());
            releaseCooldown(local.email());
            String replacement = issue(local.email());
            release.countDown();
            finishMailJobs();
            invalid(resetPassword(old));
            assertThat(resetPassword(replacement).statusCode()).isEqualTo(200);
        } finally {
            release.countDown();
        }
    }

    @Test
    void missingMailSettingsAndUnsafeResetUrlsAreUnavailable() {
        assertThat(properties.ready()).isTrue();
        for (var value : List.of(
            new PasswordResetProperties(
                false,
                "smtp.gmail.com",
                587,
                "sender",
                "secret",
                "sender@example.test",
                properties.frontendResetUrl(),
                15
            ),
            new PasswordResetProperties(
                true,
                "smtp.gmail.com",
                587,
                "sender",
                "",
                "sender@example.test",
                properties.frontendResetUrl(),
                15
            ),
            new PasswordResetProperties(
                true,
                "smtp.gmail.com",
                587,
                "sender",
                "secret",
                "",
                properties.frontendResetUrl(),
                15
            ),
            new PasswordResetProperties(
                true,
                "smtp.gmail.com",
                587,
                "sender",
                "secret",
                "sender@example.test",
                "javascript:reset-password",
                15
            ),
            new PasswordResetProperties(
                true,
                "smtp.gmail.com",
                587,
                "sender",
                "secret",
                "sender@example.test",
                properties.frontendResetUrl() + "?next=evil",
                15
            )
        )) {
            assertThat(value.ready()).isFalse();
            assertThat(value.toString()).isEqualTo("PasswordResetProperties[redacted]");
        }
    }
}
