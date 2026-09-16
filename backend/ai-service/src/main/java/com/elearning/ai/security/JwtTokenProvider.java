package com.elearning.ai.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
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
        return claims;
    }
}
