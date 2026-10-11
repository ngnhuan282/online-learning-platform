package com.elearning.learning.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.Set;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final JwtParser parser;
    private final String issuer;
    private final long accessTokenSeconds;

    public JwtTokenProvider(
        @Value("${security.jwt.secret}") String secret,
        @Value("${security.jwt.issuer}") String issuer,
        @Value("${security.jwt.access-token-seconds:900}") long accessTokenSeconds
    ) {
        if (secret == null || secret.isBlank() || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("JWT_SECRET must contain at least 32 UTF-8 bytes");
        }
        if (accessTokenSeconds <= 0 || accessTokenSeconds > 86400) {
            throw new IllegalArgumentException("JWT access token lifetime must be 1..86400 seconds");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.issuer = issuer;
        this.accessTokenSeconds = accessTokenSeconds;
        this.parser = Jwts.parser()
            .verifyWith(key)
            .requireIssuer(issuer)
            .require("tokenType", "access")
            .sig()
            .clear()
            .add(Jwts.SIG.HS256)
            .and()
            .build();
    }

    public Claims validate(String token) {
        Claims claims = parser.parseSignedClaims(token).getPayload();
        if (
            claims.getSubject() == null ||
            claims.getSubject().isBlank() ||
            claims.getExpiration() == null ||
            claims.getIssuedAt() == null ||
            claims.getIssuedAt().after(new Date()) ||
            !claims.getExpiration().after(claims.getIssuedAt()) ||
            claims.get("role", String.class) == null ||
            !Set.of("USER", "ADMIN").contains(claims.get("role", String.class))
        ) {
            throw new JwtException("Invalid access token claims");
        }
        roles(claims);
        permissions(claims);
        return claims;
    }

    // Auth emits roles plus a legacy primary role. Legacy tokens may omit roles.
    public List<String> roles(Claims claims) {
        Object value = claims.get("roles");
        if (value == null) return List.of(claims.get("role", String.class));
        List<String> roles = claimCodes(value, "roles", false);
        String primaryRole = roles.contains("ADMIN") ? "ADMIN" : "USER";
        if (!primaryRole.equals(claims.get("role", String.class))) {
            throw new JwtException("Inconsistent access token roles");
        }
        return roles;
    }

    public List<String> permissions(Claims claims) {
        Object value = claims.get("permissions");
        return value == null ? List.of() : claimCodes(value, "permissions", true);
    }

    private List<String> claimCodes(Object value, String claim, boolean allowEmpty) {
        if (
            !(value instanceof List<?> list) ||
            list.size() > 100 ||
            (!allowEmpty && list.isEmpty()) ||
            list
                .stream()
                .anyMatch(code -> !(code instanceof String name) || !name.matches("[A-Z][A-Z0-9_]{1,63}"))
        ) {
            throw new JwtException("Invalid access token " + claim);
        }
        return ((List<?>) value).stream().map(String.class::cast).distinct().toList();
    }
}
