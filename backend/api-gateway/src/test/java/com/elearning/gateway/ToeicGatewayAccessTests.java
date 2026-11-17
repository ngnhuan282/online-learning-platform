package com.elearning.gateway;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.elearning.gateway.filter.AuthenticationFilter;
import com.elearning.gateway.security.JwtTokenProvider;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

class ToeicGatewayAccessTests {

    private final AuthenticationFilter filter = new AuthenticationFilter(mock(JwtTokenProvider.class));

    @Test
    void onlyThePublishedExamCatalogueCanBeReadWithoutSigningIn() {
        AtomicBoolean forwarded = new AtomicBoolean();
        filter.filter(
            MockServerWebExchange.from(MockServerHttpRequest.get("/api/v1/learning/toeic/exams")),
            exchange -> {
                forwarded.set(true);
                return Mono.empty();
            }
        ).block();
        assertThat(forwarded).isTrue();
    }

    @Test
    void learningAttemptsResultsAndAdministrationStillRequireAuthentication() {
        for (String path : new String[] {
            "/api/v1/learning/toeic/exams/1",
            "/api/v1/learning/toeic/exams/1/progress",
            "/api/v1/learning/toeic/attempts/1",
            "/api/v1/learning/admin/toeic/exams",
            "/api/v1/learning/toeic/exams-extra"
        }) {
            assertUnauthenticated(MockServerHttpRequest.get(path).build());
        }
        assertUnauthenticated(MockServerHttpRequest.post("/api/v1/learning/toeic/exams").build());
        assertUnauthenticated(MockServerHttpRequest.post("/api/v1/learning/toeic/attempts/1/submit").build());
    }

    private void assertUnauthenticated(MockServerHttpRequest request) {
        AtomicBoolean forwarded = new AtomicBoolean();
        assertThatThrownBy(() -> filter.filter(
            MockServerWebExchange.from(request),
            exchange -> {
                forwarded.set(true);
                return Mono.empty();
            }
        ).block()).isInstanceOfSatisfying(ResponseStatusException.class,
            error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
        assertThat(forwarded).isFalse();
    }
}
