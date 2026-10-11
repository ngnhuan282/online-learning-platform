package com.elearning.payment;

import static org.assertj.core.api.Assertions.*;

import com.elearning.payment.security.JwtAuthenticationFilter;
import com.elearning.payment.security.JwtTokenProvider;
import com.elearning.payment.security.SecurityErrorHandler;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import tools.jackson.databind.json.JsonMapper;

class JwtAuthContractTests {

    final String secret = UUID.randomUUID().toString() + UUID.randomUUID();
    final JwtTokenProvider tokens = new JwtTokenProvider(secret, "learnsphere", 900);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    String token(String role, Object roles, Object permissions) {
        return Jwts.builder()
            .subject("42")
            .issuer("learnsphere")
            .claim("role", role)
            .claim("roles", roles)
            .claim("permissions", permissions)
            .claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(1)))
            .expiration(Date.from(Instant.now().plusSeconds(900)))
            .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();
    }

    MockHttpServletResponse authenticate(String token) throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/v1/probe");
        request.addHeader("Authorization", "Bearer " + token);
        var response = new MockHttpServletResponse();
        var filter = new JwtAuthenticationFilter(
            tokens,
            new SecurityErrorHandler(JsonMapper.builder().build())
        );
        filter.doFilter(request, response, (req, res) -> {});
        return response;
    }

    @Test
    void preservesAuthCustomRolesAndPermissionsWithoutInventingUserRole() throws Exception {
        assertThat(
            authenticate(token("USER", List.of("COURSE_EDITOR"), List.of("COURSE_UPDATE"))).getStatus()
        ).isEqualTo(200);
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication.getName()).isEqualTo("42");
        assertThat(authentication.getAuthorities())
            .extracting("authority")
            .containsExactly("ROLE_COURSE_EDITOR", "COURSE_UPDATE");
    }

    @Test
    void acceptsLegacySingleRoleAndAuthMultiRoleTokens() throws Exception {
        authenticate(token("USER", null, null));
        assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
            .extracting("authority")
            .containsExactly("ROLE_USER");
        authenticate(token("ADMIN", List.of("ADMIN", "USER"), List.of("PAYMENT_REPORT_VIEW")));
        assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
            .extracting("authority")
            .containsExactly("ROLE_ADMIN", "ROLE_USER", "PAYMENT_REPORT_VIEW");
    }

    @Test
    void rejectsConflictingOrMalformedRolesAndPermissionsBeforeAuthentication() throws Exception {
        for (String token : List.of(
            token("USER", List.of("ADMIN"), List.of()),
            token("ADMIN", List.of("USER"), List.of()),
            token("USER", List.of(), List.of()),
            token("USER", "USER", List.of()),
            token("USER", List.of("ROLE-INVALID"), List.of()),
            token("USER", List.of("USER"), List.of("ROLE_ADMIN:invalid")),
            token("USER", List.of("USER"), "PAYMENT_REPORT_VIEW")
        )) {
            assertThat(authenticate(token).getStatus()).isEqualTo(401);
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        }
    }
}
