package com.elearning.auth.service;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.common.exception.ErrorCode;
import com.elearning.auth.dto.LinkedAccountsResponse;
import com.elearning.auth.entity.User;
import com.elearning.auth.repository.UserExternalIdentityRepository;
import com.elearning.auth.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class GoogleLinkService {

    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final UserExternalIdentityRepository identities;
    private final AuthService auth;
    private final RefreshTokenService refresh;
    private final PasswordEncoder passwords;
    private final GoogleIdentityService google;
    private final GoogleLoginCodeService codes;

    public GoogleLinkService(
        JdbcTemplate jdbc,
        UserRepository users,
        UserExternalIdentityRepository identities,
        AuthService auth,
        RefreshTokenService refresh,
        PasswordEncoder passwords,
        GoogleIdentityService google,
        GoogleLoginCodeService codes
    ) {
        this.jdbc = jdbc;
        this.users = users;
        this.identities = identities;
        this.auth = auth;
        this.refresh = refresh;
        this.passwords = passwords;
        this.google = google;
        this.codes = codes;
    }

    @Transactional(readOnly = true)
    public LinkedAccountsResponse status(Long userId) {
        auth.getCurrentUser(userId.toString());
        var user = users.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        return new LinkedAccountsResponse(
            user.getPasswordHash() != null,
            identities
                .findByUserIdAndProvider(userId, "GOOGLE")
                .map(identity ->
                    new LinkedAccountsResponse.GoogleAccount(identity.getEmail(), identity.getLinkedAt())
                )
                .orElse(null)
        );
    }

    public String start(Long userId, String rawRefresh, String password, String challenge) {
        String sessionId = refresh.requireSession(userId, rawRefresh);
        var user = lockUser(userId);
        if (user.getPasswordHash() == null) throw new AppException(ErrorCode.GOOGLE_LINK_LOCAL_REQUIRED);
        if (!passwords.matches(password, user.getPasswordHash())) throw new AppException(
            ErrorCode.GOOGLE_LINK_PASSWORD_INVALID
        );
        String intentHash = codes.newIntentIdentifier();
        jdbc.update("DELETE FROM google_link_intents WHERE expires_at < ?", Timestamp.from(Instant.now()));
        jdbc.update(
            "INSERT INTO google_link_intents (intent_hash, user_id, session_id, browser_challenge, credential_version, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
            intentHash,
            userId,
            sessionId,
            challenge,
            user.getCredentialVersion(),
            Timestamp.from(Instant.now().plusSeconds(300))
        );
        return intentHash;
    }

    // The public browser redirect has no bearer JWT; the pending intent was created by protected start.
    public void authorize(String intentHash, String rawRefresh, String challenge) {
        Long userId = intentUser(intentHash);
        String sessionId = refresh.requireSession(userId, rawRefresh);
        var user = lockUser(userId);
        var intent = lockIntent(intentHash);
        checkIntent(intent, user, sessionId);
        if (!challenge.equals(intent.get("browser_challenge"))) throw new AppException(
            ErrorCode.GOOGLE_LINK_INVALID
        );
    }

    public String prepare(String intentHash, OidcUser principal, String rawRefresh) {
        Long userId = intentUser(intentHash);
        String sessionId = refresh.requireSession(userId, rawRefresh);
        var user = lockUser(userId);
        var intent = lockIntent(intentHash);
        checkIntent(intent, user, sessionId);
        var profile = google.verifiedProfile(principal);
        checkEmail(user, profile.email());
        // Callback only prepares a browser-bound LINK result. No identity or user is created here.
        return codes.issueLink(
            userId,
            intent.get("browser_challenge").toString(),
            intentHash,
            profile.subject(),
            profile.email()
        );
    }

    public Completion complete(Long userId, String rawRefresh, String code, String verifier) {
        // Consistent lock order: refresh row -> user -> intent -> code -> external identity.
        String sessionId = refresh.requireSession(userId, rawRefresh);
        var user = lockUser(userId);
        var preview = codes.peekLink(code);
        if (!preview.userId().equals(userId)) throw new AppException(ErrorCode.GOOGLE_LINK_SESSION_INVALID);
        var intent = lockIntent(preview.intentHash());
        checkIntent(intent, user, sessionId);
        var result = codes.consumeLink(code, verifier);
        checkEmail(user, result.email());
        byte[] subject = result.subject().getBytes(StandardCharsets.UTF_8);
        var owner = jdbc.queryForList(
            "SELECT user_id FROM user_external_identities WHERE provider = 'GOOGLE' AND provider_subject = ? FOR UPDATE",
            subject
        );
        boolean alreadyLinked = !owner.isEmpty();
        if (alreadyLinked && ((Number) owner.getFirst().get("user_id")).longValue() != userId) {
            throw new AppException(ErrorCode.GOOGLE_IDENTITY_IN_USE);
        }
        if (!alreadyLinked) {
            if (
                !jdbc
                    .queryForList(
                        "SELECT id FROM user_external_identities WHERE user_id = ? AND provider = 'GOOGLE' FOR UPDATE",
                        userId
                    )
                    .isEmpty()
            ) {
                throw new AppException(ErrorCode.GOOGLE_ACCOUNT_ALREADY_LINKED);
            }
            try {
                jdbc.update(
                    "INSERT INTO user_external_identities (user_id, provider, provider_subject, email, linked_at) VALUES (?, 'GOOGLE', ?, ?, ?)",
                    userId,
                    subject,
                    result.email(),
                    Timestamp.from(Instant.now())
                );
            } catch (DataIntegrityViolationException race) {
                throw new AppException(ErrorCode.GOOGLE_IDENTITY_IN_USE);
            }
        }
        jdbc.update("DELETE FROM google_link_intents WHERE intent_hash = ?", result.intentHash());
        return new Completion(alreadyLinked, status(userId));
    }

    private User lockUser(Long userId) {
        var user = users.findForUpdate(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        auth.getCurrentUser(userId.toString());
        return user;
    }

    private Long intentUser(String intentHash) {
        var rows = jdbc.queryForList(
            "SELECT user_id FROM google_link_intents WHERE intent_hash = ?",
            intentHash
        );
        if (rows.size() != 1) throw new AppException(ErrorCode.GOOGLE_LINK_INVALID);
        return ((Number) rows.getFirst().get("user_id")).longValue();
    }

    private Map<String, Object> lockIntent(String intentHash) {
        var rows = jdbc.queryForList(
            "SELECT * FROM google_link_intents WHERE intent_hash = ? FOR UPDATE",
            intentHash
        );
        if (rows.size() != 1) throw new AppException(ErrorCode.GOOGLE_LINK_INVALID);
        return rows.getFirst();
    }

    private void checkIntent(Map<String, Object> intent, User user, String sessionId) {
        if (
            ((Number) intent.get("user_id")).longValue() != user.getId() ||
            !sessionId.equals(intent.get("session_id"))
        ) throw new AppException(ErrorCode.GOOGLE_LINK_SESSION_INVALID);
        if (
            !((Timestamp) intent.get("expires_at")).toInstant().isAfter(Instant.now()) ||
            ((Number) intent.get("credential_version")).longValue() != user.getCredentialVersion()
        ) {
            throw new AppException(ErrorCode.GOOGLE_LINK_EXPIRED);
        }
    }

    private void checkEmail(User user, String verifiedEmail) {
        if (!user.getEmail().trim().toLowerCase(Locale.ROOT).equals(verifiedEmail)) {
            throw new AppException(ErrorCode.GOOGLE_LINK_EMAIL_MISMATCH);
        }
    }

    public record Completion(boolean alreadyLinked, LinkedAccountsResponse linkedAccounts) {}
}
