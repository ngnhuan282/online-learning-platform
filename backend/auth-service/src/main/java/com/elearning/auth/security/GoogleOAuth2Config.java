package com.elearning.auth.security;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.service.GoogleIdentityService;
import com.elearning.auth.service.GoogleLinkService;
import com.elearning.auth.service.GoogleLoginCodeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseCookie;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizationRequestRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.NullSecurityContextRepository;

@Configuration
@EnableConfigurationProperties(GoogleLoginProperties.class)
public class GoogleOAuth2Config {

    private static final Logger log = LoggerFactory.getLogger(GoogleOAuth2Config.class);
    private static final String CHALLENGE = GoogleOAuth2Config.class.getName() + ".challenge";
    private static final String STARTED_AT = GoogleOAuth2Config.class.getName() + ".startedAt";
    private static final String PENDING_LINK = GoogleOAuth2Config.class.getName() + ".pendingLink";
    private static final String PENDING_CHALLENGE = GoogleOAuth2Config.class.getName() + ".pendingChallenge";
    private static final String ACTIVE_LINK = GoogleOAuth2Config.class.getName() + ".activeLink";

    public static void prepareLink(HttpServletRequest request, String intentHash, String challenge) {
        resetOAuthSession(request);
        var session = request.getSession();
        session.setMaxInactiveInterval(300);
        session.setAttribute(PENDING_LINK, intentHash);
        session.setAttribute(PENDING_CHALLENGE, challenge);
    }

    public static void resetOAuthSession(HttpServletRequest request) {
        var previous = request.getSession(false);
        if (previous != null) previous.invalidate();
    }

    @Bean
    @ConditionalOnProperty(name = "security.google.enabled", havingValue = "true")
    ClientRegistrationRepository googleRegistrations(GoogleLoginProperties properties) {
        var google = CommonOAuth2Provider.GOOGLE.getBuilder("google")
            .clientId(properties.clientId())
            .clientSecret(properties.clientSecret())
            .redirectUri(properties.redirectUri())
            .scope("openid", "email", "profile")
            .build();
        return new InMemoryClientRegistrationRepository(google);
    }

    @Bean
    @Order(1)
    @ConditionalOnProperty(name = "security.google.enabled", havingValue = "true")
    SecurityFilterChain googleSecurityFilterChain(
        HttpSecurity http,
        GoogleLoginProperties properties,
        ClientRegistrationRepository registrations,
        GoogleIdentityService identities,
        GoogleLoginCodeService codes,
        GoogleLinkService links
    ) throws Exception {
        return http
            .securityMatcher(GoogleLoginProperties.AUTHORIZE, GoogleLoginProperties.CALLBACK)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            // The temporary session holds only state/nonce/challenge, never API authentication.
            .securityContext(context ->
                context.securityContextRepository(new NullSecurityContextRepository())
            )
            .requestCache(cache -> cache.disable())
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .logout(logout -> logout.disable())
            .authorizeHttpRequests(auth ->
                auth
                    .requestMatchers(
                        HttpMethod.GET,
                        GoogleLoginProperties.AUTHORIZE,
                        GoogleLoginProperties.CALLBACK
                    )
                    .permitAll()
                    .anyRequest()
                    .denyAll()
            )
            .oauth2Login(oauth ->
                oauth
                    .clientRegistrationRepository(registrations)
                    .authorizedClientRepository(new DiscardAuthorizedClients())
                    .authorizationEndpoint(endpoint ->
                        endpoint
                            .baseUri("/api/v1/auth/google/authorize")
                            .authorizationRequestRepository(new BrowserAuthorizationRequests(links))
                    )
                    .redirectionEndpoint(endpoint -> endpoint.baseUri("/api/v1/auth/google/callback/*"))
                    .successHandler((request, response, authentication) -> {
                        String outcome;
                        try {
                            var session = request.getSession(false);
                            String challenge =
                                session == null ? null : (String) session.getAttribute(CHALLENGE);
                            String intent =
                                session == null ? null : (String) session.getAttribute(ACTIVE_LINK);
                            if (intent != null) {
                                outcome =
                                    "code=" +
                                    links.prepare(
                                        intent,
                                        (OidcUser) authentication.getPrincipal(),
                                        RefreshTokenCookie.read(request)
                                    );
                            } else {
                                Long userId = identities.resolve((OidcUser) authentication.getPrincipal());
                                outcome = "code=" + codes.issue(userId, challenge);
                            }
                        } catch (AppException failure) {
                            outcome = "error=" + failure.getErrorCode().name();
                        } catch (Exception failure) {
                            log.error("Google login failed type={}", failure.getClass().getSimpleName());
                            outcome = "error=GOOGLE_LOGIN_FAILED";
                        }
                        finish(request, response, properties, outcome);
                    })
                    .failureHandler((request, response, failure) -> {
                        boolean cancelled =
                            failure instanceof OAuth2AuthenticationException oauthFailure &&
                            "access_denied".equals(oauthFailure.getError().getErrorCode());
                        finish(
                            request,
                            response,
                            properties,
                            "error=" + (cancelled ? "GOOGLE_LOGIN_CANCELLED" : "GOOGLE_LOGIN_FAILED")
                        );
                    })
            )
            .build();
    }

    private static void finish(
        HttpServletRequest request,
        HttpServletResponse response,
        GoogleLoginProperties properties,
        String outcome
    ) throws IOException {
        var session = request.getSession(false);
        boolean linking = session != null && session.getAttribute(ACTIVE_LINK) != null;
        if (session != null) session.invalidate();
        response.addHeader(
            "Set-Cookie",
            ResponseCookie.from("GOOGLE_OAUTH_SESSION", "")
                .path("/api/v1/auth/google")
                .httpOnly(true)
                .sameSite("Lax")
                .secure(properties.redirectUri().startsWith("https://"))
                .maxAge(0)
                .build()
                .toString()
        );
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.sendRedirect(
            properties.frontendOrigin() +
                GoogleLoginProperties.FRONTEND_CALLBACK +
                "?" +
                outcome +
                (linking ? "&flow=link" : "")
        );
    }

    static class BrowserAuthorizationRequests
        implements AuthorizationRequestRepository<OAuth2AuthorizationRequest>
    {

        private final HttpSessionOAuth2AuthorizationRequestRepository delegate =
            new HttpSessionOAuth2AuthorizationRequestRepository();
        private final GoogleLinkService links;

        BrowserAuthorizationRequests() {
            this(null);
        }

        BrowserAuthorizationRequests(GoogleLinkService links) {
            this.links = links;
        }

        @Override
        public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
            return fresh(request) ? delegate.loadAuthorizationRequest(request) : null;
        }

        @Override
        public void saveAuthorizationRequest(
            OAuth2AuthorizationRequest authorizationRequest,
            HttpServletRequest request,
            HttpServletResponse response
        ) {
            if (authorizationRequest == null) {
                delegate.saveAuthorizationRequest(null, request, response);
                return;
            }
            String challenge = request.getParameter("challenge");
            if (challenge == null || !challenge.matches("[A-Za-z0-9_-]{43}")) {
                throw new OAuth2AuthenticationException("invalid_request");
            }
            var session = request.getSession();
            session.removeAttribute(ACTIVE_LINK);
            String pending = (String) session.getAttribute(PENDING_LINK);
            if (pending != null) {
                if (!challenge.equals(session.getAttribute(PENDING_CHALLENGE)) || links == null) {
                    throw new OAuth2AuthenticationException("invalid_request");
                }
                // Only protected link/start can put this server-owned intent in the temporary session.
                session.setAttribute(ACTIVE_LINK, pending);
                try {
                    links.authorize(pending, RefreshTokenCookie.read(request), challenge);
                } catch (AppException failure) {
                    throw new OAuth2AuthenticationException("invalid_request");
                }
            }
            session.removeAttribute(PENDING_LINK);
            session.removeAttribute(PENDING_CHALLENGE);
            session.setMaxInactiveInterval(300);
            session.setAttribute(CHALLENGE, challenge);
            session.setAttribute(STARTED_AT, Instant.now());
            delegate.saveAuthorizationRequest(authorizationRequest, request, response);
        }

        @Override
        public OAuth2AuthorizationRequest removeAuthorizationRequest(
            HttpServletRequest request,
            HttpServletResponse response
        ) {
            return fresh(request) ? delegate.removeAuthorizationRequest(request, response) : null;
        }

        private boolean fresh(HttpServletRequest request) {
            var session = request.getSession(false);
            return (
                session != null &&
                session.getAttribute(STARTED_AT) instanceof Instant started &&
                started.plusSeconds(300).isAfter(Instant.now())
            );
        }
    }

    // Login needs the verified identity only; do not retain Google's access/refresh tokens.
    private static class DiscardAuthorizedClients implements OAuth2AuthorizedClientRepository {

        @Override
        public <T extends OAuth2AuthorizedClient> T loadAuthorizedClient(
            String id,
            Authentication principal,
            HttpServletRequest request
        ) {
            return null;
        }

        @Override
        public void saveAuthorizedClient(
            OAuth2AuthorizedClient client,
            Authentication principal,
            HttpServletRequest request,
            HttpServletResponse response
        ) {}

        @Override
        public void removeAuthorizedClient(
            String id,
            Authentication principal,
            HttpServletRequest request,
            HttpServletResponse response
        ) {}
    }
}
