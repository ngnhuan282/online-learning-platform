package com.elearning.auth.service;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.common.exception.ErrorCode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GoogleLoginCodeService {

    private final JdbcTemplate jdbc;
    private final AuthService auth;
    private final RefreshTokenService refresh;
    private final SecureRandom random = new SecureRandom();

    public GoogleLoginCodeService(JdbcTemplate jdbc, AuthService auth, RefreshTokenService refresh) {
        this.jdbc = jdbc;
        this.auth = auth;
        this.refresh = refresh;
    }

    @Transactional
    public String issue(Long userId, String challenge) {
        return issueCode(userId, challenge, "LOGIN", null, null, null);
    }

    @Transactional
    public String issueLink(Long userId, String challenge, String intentHash, String subject, String email) {
        return issueCode(userId, challenge, "LINK", intentHash, subject, email);
    }

    public String newIntentIdentifier() {
        return hash(randomCode());
    }

    private String randomCode() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String issueCode(
        Long userId,
        String challenge,
        String purpose,
        String intentHash,
        String subject,
        String email
    ) {
        if (challenge == null || !challenge.matches("[A-Za-z0-9_-]{43}")) throw invalid(
            ErrorCode.GOOGLE_EXCHANGE_INVALID
        );
        String code = randomCode();
        jdbc.update("DELETE FROM oauth_login_codes WHERE expires_at < ?", Timestamp.from(Instant.now()));
        jdbc.update(
            "INSERT INTO oauth_login_codes (code_hash, browser_challenge, user_id, expires_at, purpose, link_intent_hash, provider_subject, provider_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            hash(code),
            challenge,
            userId,
            Timestamp.from(Instant.now().plusSeconds(60)),
            purpose,
            intentHash,
            subject == null ? null : subject.getBytes(StandardCharsets.UTF_8),
            email
        );
        return code;
    }

    @Transactional
    public RefreshTokenService.Rotation exchange(String code, String verifier) {
        var result = consume(code, verifier, "LOGIN", ErrorCode.GOOGLE_EXCHANGE_INVALID);
        var authResult = auth.loginUser(result.userId());
        return new RefreshTokenService.Rotation(refresh.create(result.userId()), authResult);
    }

    public VerifiedLink peekLink(String code) {
        validateCode(code, ErrorCode.GOOGLE_LINK_INVALID);
        var rows = jdbc.queryForList(
            "SELECT * FROM oauth_login_codes WHERE code_hash = ? AND purpose = 'LINK'",
            hash(code)
        );
        if (rows.size() != 1) throw invalid(ErrorCode.GOOGLE_LINK_INVALID);
        return link(rows.getFirst());
    }

    @Transactional
    public VerifiedLink consumeLink(String code, String verifier) {
        return consume(code, verifier, "LINK", ErrorCode.GOOGLE_LINK_INVALID);
    }

    private VerifiedLink consume(String code, String verifier, String purpose, ErrorCode error) {
        validateCode(code, error);
        if (verifier == null || !verifier.matches("[A-Za-z0-9_-]{43}")) throw invalid(error);
        // Database row lock makes consumption atomic across requests and Auth instances.
        var rows = jdbc.queryForList(
            "SELECT * FROM oauth_login_codes WHERE code_hash = ? AND purpose = ? FOR UPDATE",
            hash(code),
            purpose
        );
        if (rows.size() != 1) throw invalid(error);
        var row = rows.getFirst();
        String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(digest(verifier));
        if (
            !MessageDigest.isEqual(
                challenge.getBytes(StandardCharsets.US_ASCII),
                row.get("browser_challenge").toString().getBytes(StandardCharsets.US_ASCII)
            ) ||
            !((Timestamp) row.get("expires_at")).toInstant().isAfter(Instant.now())
        ) throw invalid(error);
        jdbc.update("DELETE FROM oauth_login_codes WHERE code_hash = ?", hash(code));
        return link(row);
    }

    private void validateCode(String code, ErrorCode error) {
        if (code == null || !code.matches("[A-Za-z0-9_-]{43}")) throw invalid(error);
    }

    private VerifiedLink link(Map<String, Object> row) {
        var subject = (byte[]) row.get("provider_subject");
        return new VerifiedLink(
            ((Number) row.get("user_id")).longValue(),
            (String) row.get("link_intent_hash"),
            subject == null ? null : new String(subject, StandardCharsets.UTF_8),
            (String) row.get("provider_email")
        );
    }

    public record VerifiedLink(Long userId, String intentHash, String subject, String email) {
        @Override
        public String toString() {
            return "VerifiedLink[redacted]";
        }
    }

    private AppException invalid(ErrorCode error) {
        return new AppException(error);
    }

    private String hash(String value) {
        return HexFormat.of().formatHex(digest(value));
    }

    private byte[] digest(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.US_ASCII));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
}
