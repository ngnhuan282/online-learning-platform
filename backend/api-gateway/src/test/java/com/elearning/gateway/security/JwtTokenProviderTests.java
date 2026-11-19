package com.elearning.gateway.security;

import static org.assertj.core.api.Assertions.*;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;

class JwtTokenProviderTests {
    static final String SECRET = "jwt-contract-test-secret-at-least-64-bytes-abcdefghijklmnopqrstuvwxyz";
    final JwtTokenProvider provider = new JwtTokenProvider(SECRET, "sgedu", 900);

    @Test
    void rejectsWeakSecretsAndInvalidLifetimesAtStartup() {
        for (String secret : Arrays.asList(null, "", " ", "x".repeat(31))) {
            assertThatThrownBy(() -> new JwtTokenProvider(secret, "sgedu", 900)).isInstanceOf(IllegalArgumentException.class);
        }
        for (long ttl : new long[]{-1, 0, 86401}) {
            assertThatThrownBy(() -> new JwtTokenProvider(SECRET, "sgedu", ttl)).isInstanceOf(IllegalArgumentException.class);
        }
        assertThat(new JwtTokenProvider("\u00e9".repeat(16), "sgedu", 86400)).isNotNull();
    }

    @Test
    void supportsLegacyClaimsAndDeduplicatesValidatedRoleAndPermissionCodes() {
        var legacy = provider.validate(token(builder -> {}));
        assertThat(provider.roles(legacy)).containsExactly("USER");
        assertThat(provider.permissions(legacy)).isEmpty();
        var custom = provider.validate(token(builder -> builder.claim("role", "ADMIN")
            .claim("roles", List.of("ADMIN", "SUPPORT", "ADMIN"))
            .claim("permissions", List.of("COURSE_VIEW", "COURSE_VIEW", "USER_VIEW"))));
        assertThat(provider.roles(custom)).containsExactly("ADMIN", "SUPPORT");
        assertThat(provider.permissions(custom)).containsExactly("COURSE_VIEW", "USER_VIEW");
    }

    @Test
    void rejectsMalformedAndInconsistentRoleCollections() {
        for (Object invalid : List.of("ADMIN", List.of(), List.of(1), List.of("user"), Collections.nCopies(101, "USER"))) {
            assertThatThrownBy(() -> provider.validate(token(builder -> builder.claim("roles", invalid))))
                .isInstanceOf(JwtException.class);
        }
        assertThatThrownBy(() -> provider.validate(token(builder -> builder.claim("roles", List.of("ADMIN")))))
            .isInstanceOf(JwtException.class);
        for (Object invalid : List.of("COURSE_VIEW", List.of(1), List.of("bad-permission"))) {
            assertThatThrownBy(() -> provider.validate(token(builder -> builder.claim("permissions", invalid))))
                .isInstanceOf(JwtException.class);
        }
    }

    @Test
    void rejectsMissingOrInvalidIdentityAndTimeClaims() {
        List<Consumer<JwtBuilder>> mutations = List.of(
            builder -> builder.subject(null), builder -> builder.subject(" "),
            builder -> builder.expiration(null), builder -> builder.issuedAt(null),
            builder -> builder.issuedAt(Date.from(Instant.now().plusSeconds(60))),
            builder -> builder.expiration(Date.from(Instant.now().minusSeconds(20))),
            builder -> builder.claim("role", null), builder -> builder.claim("role", "SUPERUSER"),
            builder -> builder.issuer("other-issuer"), builder -> builder.claim("tokenType", "refresh")
        );
        for (var mutation : mutations) {
            assertThatThrownBy(() -> provider.validate(token(mutation))).isInstanceOf(JwtException.class);
        }
    }

    String token(Consumer<JwtBuilder> modify) {
        var builder = Jwts.builder().subject("7").issuer("sgedu").claim("role", "USER")
            .claim("tokenType", "access").issuedAt(Date.from(Instant.now().minusSeconds(10)))
            .expiration(Date.from(Instant.now().plusSeconds(300)));
        modify.accept(builder);
        return builder.signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
    }
}
