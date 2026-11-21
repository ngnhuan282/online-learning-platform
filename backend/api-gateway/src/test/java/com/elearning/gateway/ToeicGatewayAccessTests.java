package com.elearning.gateway;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.elearning.gateway.filter.AuthenticationFilter;
import com.elearning.gateway.security.JwtTokenProvider;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

class ToeicGatewayAccessTests {

    private final AuthenticationFilter filter = new AuthenticationFilter(mock(JwtTokenProvider.class));

    @Test
    void onlyThePublishedExamCatalogueCanBeReadWithoutSigningIn() {
        for (String path : new String[] {
            "/api/v1/learning/toeic/exams",
            "/api/v1/learning/toeic/dictionary",
            "/api/v1/learning/dictation",
            "/api/v1/learning/dictation/topic-groups",
            "/api/v1/learning/shop",
            "/api/v1/learning/engagement/leaderboard",
            "/api/v1/learning/community/topics",
            "/api/v1/learning/community/posts",
            "/api/v1/payments/pro/plans"
        }) {
            AtomicBoolean forwarded = new AtomicBoolean();
            filter.filter(
                MockServerWebExchange.from(MockServerHttpRequest.get(path)),
                exchange -> {
                    forwarded.set(true);
                    return Mono.empty();
                }
            ).block();
            assertThat(forwarded).as("Expected public GET for %s", path).isTrue();
        }
    }

    @Test
    void learningAttemptsResultsAndAdministrationStillRequireAuthentication() {
        for (String path : new String[] {
            "/api/v1/learning/toeic/exams/1",
            "/api/v1/learning/toeic/exams/1/progress",
            "/api/v1/learning/toeic/attempts/1",
            "/api/v1/learning/admin/toeic/exams",
            "/api/v1/learning/admin/toeic/media",
            "/api/v1/learning/toeic/exams-extra",
            "/api/v1/learning/dictation/attempts",
            "/api/v1/learning/dictation/attempts/1",
            "/api/v1/learning/dictation/attempts/1/audio",
            "/api/v1/learning/shop/extra",
            "/api/v1/learning/engagement/me",
            "/api/v1/learning/community/posts/1",
            "/api/v1/learning/community/posts/1/comments",
            "/api/v1/learning/pro/me",
            "/api/v1/payments/orders/abc"
        }) {
            assertUnauthenticated(MockServerHttpRequest.get(path).build());
        }
        assertUnauthenticated(MockServerHttpRequest.post("/api/v1/learning/toeic/exams").build());
        assertUnauthenticated(MockServerHttpRequest.post("/api/v1/learning/toeic/attempts/1/submit").build());
        assertUnauthenticated(
            MockServerHttpRequest.post("/api/v1/learning/dictation/exercises/sample/attempts").build()
        );
        assertUnauthenticated(MockServerHttpRequest.post("/api/v1/learning/shop/purchases").build());
        assertUnauthenticated(MockServerHttpRequest.post("/api/v1/learning/shop/equip").build());
        assertUnauthenticated(MockServerHttpRequest.post("/api/v1/learning/community/posts").build());
        assertUnauthenticated(MockServerHttpRequest.post("/api/v1/learning/pro/redeem").build());
        assertUnauthenticated(MockServerHttpRequest.post("/api/v1/payments/pro/checkout").build());
    }

    @Test
    void browsersCanReadToeicMediaWithoutJwtButCannotMutateIt() {
        String path = "/api/v1/learning/toeic/media/6bad05a0-4da8-47e8-8915-597bd372ebab";
        for (HttpMethod method : new HttpMethod[] { HttpMethod.GET, HttpMethod.HEAD }) {
            AtomicBoolean forwarded = new AtomicBoolean();
            filter.filter(MockServerWebExchange.from(MockServerHttpRequest.method(method, path)), exchange -> {
                forwarded.set(true);
                return Mono.empty();
            }).block();
            assertThat(forwarded).isTrue();
        }
        assertUnauthenticated(MockServerHttpRequest.delete(path).build());
    }

    private void assertUnauthenticated(MockServerHttpRequest request) {
        AtomicBoolean forwarded = new AtomicBoolean();
        assertThatThrownBy(() -> filter.filter(
                MockServerWebExchange.from(request),
                exchange -> {
                    forwarded.set(true);
                    return Mono.empty();
                }).block()).isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
        assertThat(forwarded).isFalse();
    }
}
