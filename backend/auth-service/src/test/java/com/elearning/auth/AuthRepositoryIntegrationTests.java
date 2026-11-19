package com.elearning.auth;

import static org.assertj.core.api.Assertions.*;

import com.elearning.auth.entity.*;
import com.elearning.auth.entity.enums.UserStatus;
import com.elearning.auth.repository.*;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:auth-repository;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "security.jwt.secret=repository-test-secret-at-least-32-bytes", "logging.level.root=WARN"
})
@ActiveProfiles("test")
@Transactional
class AuthRepositoryIntegrationTests {
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired RefreshTokenRepository tokens;
    @Autowired EntityManager entityManager;

    @Test
    void emailLookupIsCaseInsensitiveAndFilteredPagesExcludeDeletedAccounts() {
        Role role = roles.findByName("USER").orElseThrow();
        var active = users.saveAndFlush(new User("FilterActive@example.test", "hash", "Repository Learner", role));
        var locked = new User("filterLocked@example.test", "hash", "Repository Locked", role);
        locked.updateStatus(UserStatus.LOCKED);
        users.saveAndFlush(locked);
        var deleted = new User("filterDeleted@example.test", "hash", "Repository Deleted", role);
        deleted.softDelete(); users.saveAndFlush(deleted);
        entityManager.clear();
        assertThat(users.existsByEmailIgnoreCase("FILTERACTIVE@EXAMPLE.TEST")).isTrue();
        assertThat(users.findByEmailIgnoreCase("filteractive@example.test").orElseThrow().getId()).isEqualTo(active.getId());
        var result = users.findByFilter("repository", UserStatus.ACTIVE, "USER", PageRequest.of(0, 1));
        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent()).extracting(User::getId).containsExactly(active.getId());
        assertThat(users.findByFilter("FILTER", null, null, PageRequest.of(0, 10)).getTotalElements()).isEqualTo(2);
        assertThat(users.findByFilter(null, null, "MISSING_ROLE", PageRequest.of(0, 10))).isEmpty();
        assertThat(users.findForUpdate(active.getId())).isPresent();
    }

    @Test
    void refreshTokenQueriesPreserveOwnerSessionAndRevocation() {
        var user = users.saveAndFlush(new User("token-owner@example.test", "hash", "Token Owner", roles.findByName("USER").orElseThrow()));
        var token = tokens.saveAndFlush(new RefreshToken(user, "a".repeat(64), Instant.now().plusSeconds(600), "session-a", true));
        var independent = new RefreshToken(user, "b".repeat(64), Instant.now().plusSeconds(600));
        assertThat(independent.getSessionId()).isNotBlank().isNotEqualTo(token.getSessionId());
        token.revoke(); var revokedAt = token.getRevokedAt(); token.revoke();
        tokens.flush(); entityManager.clear();
        assertThat(tokens.findUserIdByTokenHash("a".repeat(64))).contains(user.getId());
        var persisted = tokens.findForUpdate("a".repeat(64)).orElseThrow();
        assertThat(persisted.isPersistent()).isTrue();
        assertThat(persisted.getSessionId()).isEqualTo("session-a");
        assertThat(persisted.getRevokedAt()).isCloseTo(revokedAt, org.assertj.core.api.Assertions.within(1, java.time.temporal.ChronoUnit.MILLIS));
        assertThat(tokens.findByTokenHash("missing")).isEmpty();
    }
}
