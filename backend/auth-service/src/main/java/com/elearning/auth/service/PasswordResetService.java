package com.elearning.auth.service;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.common.exception.ErrorCode;
import com.elearning.auth.config.PasswordResetProperties;
import com.elearning.auth.entity.User;
import com.elearning.auth.entity.enums.UserStatus;
import com.elearning.auth.repository.UserRepository;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final int WINDOW_SECONDS = 900;
    private static final int COOLDOWN_SECONDS = 60;
    private static final int MAX_REQUESTS = 3;
    private final SecureRandom random = new SecureRandom();
    private final PasswordResetProperties properties;
    private final ObjectProvider<JavaMailSender> mail;
    private final TaskExecutor executor;
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final TransactionTemplate transactions;

    public PasswordResetService(
        PasswordResetProperties properties,
        ObjectProvider<JavaMailSender> mail,
        @Qualifier("passwordResetMailExecutor") TaskExecutor executor,
        JdbcTemplate jdbc,
        UserRepository users,
        PasswordEncoder passwords,
        PlatformTransactionManager manager
    ) {
        this.properties = properties;
        this.mail = mail;
        this.executor = executor;
        this.jdbc = jdbc;
        this.users = users;
        this.passwords = passwords;
        this.transactions = new TransactionTemplate(manager);
    }

    public void forgot(String email) {
        // Check globally before querying a user or issuing a token, including for unknown emails.
        if (!properties.ready() || mail.getIfAvailable() == null) throw unavailable();
        Delivery delivery = transactions.execute(status -> prepare(email));
        try {
            // Queue even a no-op for an ineligible address: response/queue errors cannot enumerate users.
            executor.execute(() -> deliver(delivery));
        } catch (TaskRejectedException rejected) {
            discard(delivery);
            throw unavailable();
        }
    }

    private Delivery prepare(String email) {
        throttle(email);
        var ids = jdbc.queryForList("SELECT id FROM users WHERE LOWER(email) = ?", Long.class, email);
        if (ids.isEmpty()) return null;
        var user = users.findForUpdate(ids.getFirst()).orElseThrow();
        // MySQL's email collation can fold accents; only the project's exact normalized address qualifies.
        if (!eligible(user) || !user.getEmail().trim().toLowerCase(Locale.ROOT).equals(email)) return null;
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String hash = hash(raw);
        // User lock serializes issuance/reset; the accepted new request invalidates its predecessor now.
        jdbc.update("DELETE FROM password_reset_tokens WHERE user_id = ?", user.getId());
        jdbc.update(
            "INSERT INTO password_reset_tokens (user_id, token_hash, credential_version, expires_at) VALUES (?, ?, ?, ?)",
            user.getId(),
            hash,
            user.getCredentialVersion(),
            Timestamp.from(Instant.now().plusSeconds(properties.tokenTtlMinutes() * 60L))
        );
        return new Delivery(user.getEmail(), raw, hash);
    }

    private void throttle(String email) {
        Instant now = Instant.now();
        String key = hash(email);
        jdbc.update(
            "INSERT INTO password_reset_rate_limits (bucket_key, window_start, request_count) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE bucket_key = bucket_key",
            key,
            Timestamp.from(now)
        );
        var bucket = jdbc.queryForMap(
            "SELECT * FROM password_reset_rate_limits WHERE bucket_key = ? FOR UPDATE",
            key
        );
        boolean freshWindow = !((Timestamp) bucket.get("window_start"))
            .toInstant()
            .plusSeconds(WINDOW_SECONDS)
            .isAfter(now);
        var last = (Timestamp) bucket.get("last_requested_at");
        int count = freshWindow ? 0 : ((Number) bucket.get("request_count")).intValue();
        if (
            count >= MAX_REQUESTS ||
            (!freshWindow && last != null && last.toInstant().plusSeconds(COOLDOWN_SECONDS).isAfter(now))
        ) {
            throw new AppException(ErrorCode.PASSWORD_RESET_RATE_LIMITED);
        }
        jdbc.update(
            "UPDATE password_reset_rate_limits SET window_start = ?, last_requested_at = ?, request_count = ? WHERE bucket_key = ?",
            freshWindow ? Timestamp.from(now) : bucket.get("window_start"),
            Timestamp.from(now),
            count + 1,
            key
        );
    }

    @Scheduled(fixedDelay = 3600000, initialDelay = 3600000)
    public void cleanupExpired() {
        jdbc.update("DELETE FROM password_reset_tokens WHERE expires_at < ?", Timestamp.from(Instant.now()));
        jdbc.update(
            "DELETE FROM password_reset_rate_limits WHERE window_start < ?",
            Timestamp.from(Instant.now().minusSeconds(86400))
        );
    }

    private void deliver(Delivery delivery) {
        if (delivery == null) return;
        try {
            if (
                jdbc.queryForObject(
                    "SELECT COUNT(*) FROM password_reset_tokens WHERE token_hash = ? AND expires_at > ?",
                    Long.class,
                    delivery.hash(),
                    Timestamp.from(Instant.now())
                ) == 0
            ) return;
            JavaMailSender sender = mail.getObject();
            MimeMessage message = sender.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(properties.mailFrom());
            helper.setTo(delivery.email());
            helper.setSubject("SGEdu — Đặt lại mật khẩu");
            // Fragment never reaches the web server/access log. The page removes it from history.
            String link = properties.frontendResetUrl() + "#token=" + delivery.rawToken();
            helper.setText(
                "Xin chào,\n\nBạn đã yêu cầu đặt lại mật khẩu tài khoản SGEdu.\n" +
                    "Mở liên kết sau để chọn mật khẩu mới (có hiệu lực " +
                    properties.tokenTtlMinutes() +
                    " phút, chỉ dùng một lần):\n" +
                    link +
                    "\n\nNếu bạn không yêu cầu, hãy bỏ qua email này. Mật khẩu của bạn chưa bị thay đổi.\n\nSGEdu",
                false
            );
            // No database transaction spans this network call.
            sender.send(message);
        } catch (Exception failure) {
            discard(delivery);
            // Provider exception messages can contain addresses, credentials and message contents.
            log.warn("Password reset mail delivery failed type={}", failure.getClass().getSimpleName());
        }
    }

    private void discard(Delivery delivery) {
        if (delivery != null) jdbc.update(
            "DELETE FROM password_reset_tokens WHERE token_hash = ?",
            delivery.hash()
        );
    }

    public void reset(String rawToken, String newPassword) {
        if (rawToken == null || !rawToken.matches("[A-Za-z0-9_-]{43}")) throw invalidToken();
        String hash = hash(rawToken);
        transactions.executeWithoutResult(status -> {
            var ids = jdbc.queryForList(
                "SELECT user_id FROM password_reset_tokens WHERE token_hash = ?",
                Long.class,
                hash
            );
            if (ids.size() != 1) throw invalidToken();
            // All refresh/link operations take the user lock first as well, avoiding bulk-revocation deadlocks.
            var user = users.findForUpdate(ids.getFirst()).orElseThrow(this::invalidToken);
            var rows = jdbc.queryForList(
                "SELECT * FROM password_reset_tokens WHERE user_id = ? AND token_hash = ? FOR UPDATE",
                user.getId(),
                hash
            );
            if (rows.size() != 1) throw invalidToken();
            var token = rows.getFirst();
            if (
                !eligible(user) ||
                !((Timestamp) token.get("expires_at")).toInstant().isAfter(Instant.now()) ||
                ((Number) token.get("credential_version")).longValue() != user.getCredentialVersion()
            ) throw invalidToken();
            user.updatePassword(passwords.encode(newPassword));
            jdbc.update(
                "UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
                Timestamp.from(Instant.now()),
                user.getId()
            );
            jdbc.update("DELETE FROM google_link_intents WHERE user_id = ?", user.getId());
            jdbc.update("DELETE FROM password_reset_tokens WHERE user_id = ?", user.getId());
        });
    }

    private boolean eligible(User user) {
        return (
            user.getPasswordHash() != null &&
            user.getStatus() == UserStatus.ACTIVE &&
            user.getDeletedAt() == null
        );
    }

    private AppException invalidToken() {
        return new AppException(ErrorCode.PASSWORD_RESET_TOKEN_INVALID);
    }

    private AppException unavailable() {
        return new AppException(ErrorCode.PASSWORD_RESET_UNAVAILABLE);
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 unavailable", impossible);
        }
    }

    private record Delivery(String email, String rawToken, String hash) {
        @Override
        public String toString() {
            return "PasswordResetDelivery[redacted]";
        }
    }
}
