package com.elearning.auth.security;

import static org.assertj.core.api.Assertions.*;

import java.time.Instant;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

class GoogleAuthorizationRequestTests {

    private final GoogleOAuth2Config.BrowserAuthorizationRequests repository =
        new GoogleOAuth2Config.BrowserAuthorizationRequests();
    private final MockHttpServletRequest request = new MockHttpServletRequest();
    private final MockHttpServletResponse response = new MockHttpServletResponse();
    private final OAuth2AuthorizationRequest authorization = OAuth2AuthorizationRequest.authorizationCode()
        .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
        .clientId("test-client")
        .redirectUri("http://localhost:8080" + GoogleLoginProperties.CALLBACK)
        .scopes(Set.of("openid", "email", "profile"))
        .state("expected-state")
        .build();

    @Test
    void authorizationStateRequiresChallengeAndExpiresAfterFiveMinutes() {
        assertThatThrownBy(() ->
            repository.saveAuthorizationRequest(authorization, request, response)
        ).isInstanceOf(OAuth2AuthenticationException.class);
        request.setParameter("challenge", "c".repeat(43));
        repository.saveAuthorizationRequest(authorization, request, response);
        request.setParameter("state", "expected-state");
        assertThat(repository.loadAuthorizationRequest(request)).isSameAs(authorization);
        assertThat(request.getSession().getMaxInactiveInterval()).isEqualTo(300);
        request
            .getSession()
            .setAttribute(GoogleOAuth2Config.class.getName() + ".startedAt", Instant.now().minusSeconds(301));
        assertThat(repository.loadAuthorizationRequest(request)).isNull();
        assertThat(repository.removeAuthorizationRequest(request, response)).isNull();
    }

    @Test
    void stateCannotBeSubstitutedOrConsumedTwice() {
        request.setParameter("challenge", "c".repeat(43));
        repository.saveAuthorizationRequest(authorization, request, response);
        request.setParameter("state", "attacker-state");
        assertThat(repository.removeAuthorizationRequest(request, response)).isNull();
        request.setParameter("state", "expected-state");
        assertThat(repository.removeAuthorizationRequest(request, response)).isSameAs(authorization);
        assertThat(repository.removeAuthorizationRequest(request, response)).isNull();
    }

    @Test
    void configurationRejectsMissingSecretsAndUnsafeOrIncorrectCallbackUrls() {
        assertThatThrownBy(() -> new GoogleLoginProperties(true, "", "", "", "")).isInstanceOf(
            IllegalArgumentException.class
        );
        for (String origin : new String[] {
            "https://app.test/",
            "http://app.test",
            "https://app.test?next=evil",
            "https://user@app.test",
        }) {
            assertThatThrownBy(() ->
                new GoogleLoginProperties(
                    true,
                    "id",
                    "secret",
                    "http://localhost:8080" + GoogleLoginProperties.CALLBACK,
                    origin
                )
            ).isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() ->
            new GoogleLoginProperties(
                true,
                "id",
                "secret",
                "http://localhost:5173/auth/google/callback",
                "http://localhost:5173"
            )
        ).isInstanceOf(IllegalArgumentException.class);
    }
}
