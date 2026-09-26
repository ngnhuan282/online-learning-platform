package com.elearning.auth.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.UUID;
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
        return claims;
    }

    // Retain the single-role overload for existing service consumers and foundation tests.
    public String createAccessToken(String subject, String role) {
        return createAccessToken(subject, role == null ? List.of() : List.of(role));
    }

    public String createAccessToken(String subject, List<String> roles) {
        return createAccessToken(subject, roles, List.of());
    }

    public String createAccessToken(String subject, List<String> roles, List<String> permissions) {
        if (
            subject == null ||
            subject.isBlank() ||
            roles == null ||
            roles.isEmpty() ||
            roles.stream().anyMatch(role -> role == null || !role.matches("[A-Z][A-Z0-9_]{1,63}"))
        ) {
            throw new IllegalArgumentException("A subject and a supported role are required");
        }
        Instant now = Instant.now();
        String primaryRole = roles.contains("ADMIN") ? "ADMIN" : "USER";
        return Jwts.builder()
            .id(UUID.randomUUID().toString())
            .subject(subject)
            .issuer(issuer)
            .claim("role", primaryRole)
            .claim("roles", roles.stream().distinct().sorted().toList())
            .claim("permissions", permissions.stream().distinct().sorted().toList())
            .claim("tokenType", "access")
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(accessTokenSeconds)))
            .signWith(key, Jwts.SIG.HS256)
            .compact();
    }

    public List<String> roles(Claims claims) {
        Object value = claims.get("roles");
        if (value == null) return List.of(claims.get("role", String.class));
        if (
            !(value instanceof List<?> list) ||
            list.isEmpty() ||
            list
                .stream()
                .anyMatch(role -> !(role instanceof String name) || !name.matches("[A-Z][A-Z0-9_]{1,63}")) ||
            ("ADMIN".equals(claims.get("role", String.class)) && !list.contains("ADMIN"))
        ) throw new JwtException("Invalid access token roles");
        return ((List<?>) value).stream().map(String.class::cast).toList();
    }

    public long getAccessTokenSeconds() {
        return accessTokenSeconds;
    }
}
