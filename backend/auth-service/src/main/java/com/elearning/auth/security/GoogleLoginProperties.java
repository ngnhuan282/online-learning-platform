package com.elearning.auth.security;

import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("security.google")
public record GoogleLoginProperties(
    boolean enabled,
    String clientId,
    String clientSecret,
    String redirectUri,
    String frontendOrigin
) {
    public static final String AUTHORIZE = "/api/v1/auth/google/authorize/google";
    public static final String CALLBACK = "/api/v1/auth/google/callback/google";
    public static final String FRONTEND_CALLBACK = "/auth/google/callback";

    public GoogleLoginProperties {
        if (enabled) {
            if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
                throw new IllegalArgumentException(
                    "Google login requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
                );
            }
            validateUrl(redirectUri, CALLBACK);
            validateUrl(frontendOrigin, "");
        }
    }

    private static void validateUrl(String value, String path) {
        URI uri = URI.create(value);
        boolean local = "localhost".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost());
        if (
            uri.getHost() == null ||
            uri.getRawUserInfo() != null ||
            uri.getRawQuery() != null ||
            uri.getRawFragment() != null ||
            !path.equals(uri.getRawPath()) ||
            !("https".equals(uri.getScheme()) || (local && "http".equals(uri.getScheme())))
        ) {
            throw new IllegalArgumentException("Invalid Google login URL configuration");
        }
    }

    @Override
    public String toString() {
        return "GoogleLoginProperties[redacted]";
    }
}
