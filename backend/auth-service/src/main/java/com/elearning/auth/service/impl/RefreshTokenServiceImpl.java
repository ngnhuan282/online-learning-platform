package com.elearning.auth.service.impl;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.common.exception.ErrorCode;
import com.elearning.auth.dto.AuthResponse;
import com.elearning.auth.entity.RefreshToken;
import com.elearning.auth.entity.User;
import com.elearning.auth.repository.RefreshTokenRepository;
import com.elearning.auth.repository.UserRepository;
import com.elearning.auth.security.JwtTokenProvider;
import com.elearning.auth.service.AuthService;
import com.elearning.auth.service.RefreshTokenService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class RefreshTokenServiceImpl implements RefreshTokenService {

    private final RefreshTokenRepository refreshTokens;
    private final UserRepository users;
    private final AuthService auth;
    private final JwtTokenProvider jwt;
    private final long expirationSeconds;
    private final SecureRandom random = new SecureRandom();

    public RefreshTokenServiceImpl(
        RefreshTokenRepository refreshTokens,
        UserRepository users,
        AuthService auth,
        JwtTokenProvider jwt,
        @Value("${security.refresh.expiration-seconds:604800}") long expirationSeconds
    ) {
        if (expirationSeconds <= 0 || expirationSeconds > 31536000) {
            throw new IllegalArgumentException("Refresh lifetime must be 1..31536000 seconds");
        }
        this.refreshTokens = refreshTokens;
        this.users = users;
        this.auth = auth;
        this.jwt = jwt;
        this.expirationSeconds = expirationSeconds;
    }

    @Override
    public String create(Long userId) {
        auth.getCurrentUser(userId.toString()); // Check current account status using existing Auth rules.
        return issue(users.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND)));
    }

    @Override
    @Transactional(readOnly = true)
    public RefreshToken validate(String rawToken) {
        return check(
            refreshTokens
                .findByTokenHash(hashRequired(rawToken))
                .orElseThrow(() -> new AppException(ErrorCode.REFRESH_TOKEN_INVALID))
        );
    }

    @Override
    public Rotation rotate(String rawToken) {
        // Serialize rotation/revocation on this token, including across Auth instances.
        var old = check(
            refreshTokens
                .findForUpdate(hashRequired(rawToken))
                .orElseThrow(() -> new AppException(ErrorCode.REFRESH_TOKEN_INVALID))
        );
        var user = auth.getCurrentUser(old.getUser().getId().toString());
        if (user.roles().isEmpty()) throw new AppException(ErrorCode.ROLE_NOT_FOUND);
        old.revoke();
        String next = issue(old.getUser());
        var response = new AuthResponse(
            jwt.createAccessToken(user.id().toString(), user.roles()),
            "Bearer",
            jwt.getAccessTokenSeconds(),
            user
        );
        return new Rotation(next, response);
    }

    @Override
    public void revoke(String rawToken) {
        if (rawToken == null || !rawToken.matches("[A-Za-z0-9_-]{43}")) return;
        refreshTokens.findForUpdate(hash(rawToken)).ifPresent(RefreshToken::revoke);
    }

    private String issue(User user) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        refreshTokens.save(new RefreshToken(user, hash(raw), Instant.now().plusSeconds(expirationSeconds)));
        return raw;
    }

    private RefreshToken check(RefreshToken token) {
        if (token.getRevokedAt() != null) throw new AppException(ErrorCode.REFRESH_TOKEN_REVOKED);
        if (!token.getExpiresAt().isAfter(Instant.now())) throw new AppException(
            ErrorCode.REFRESH_TOKEN_EXPIRED
        );
        return token;
    }

    private String hashRequired(String raw) {
        if (raw == null || raw.isBlank()) throw new AppException(ErrorCode.REFRESH_TOKEN_MISSING);
        if (!raw.matches("[A-Za-z0-9_-]{43}")) throw new AppException(ErrorCode.REFRESH_TOKEN_INVALID);
        return hash(raw);
    }

    private String hash(String raw) {
        try {
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
}
