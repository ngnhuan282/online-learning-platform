package com.elearning.auth.config;

import jakarta.mail.internet.InternetAddress;
import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("security.password-reset")
public record PasswordResetProperties(
    boolean mailEnabled,
    String mailHost,
    int mailPort,
    String mailUsername,
    String mailPassword,
    String mailFrom,
    String frontendResetUrl,
    int tokenTtlMinutes
) {
    public boolean ready() {
        if (
            !mailEnabled ||
            blank(mailHost) ||
            mailPort < 1 ||
            mailPort > 65535 ||
            blank(mailUsername) ||
            blank(mailPassword) ||
            blank(mailFrom) ||
            tokenTtlMinutes < 1 ||
            tokenTtlMinutes > 60
        ) return false;
        try {
            var address = new InternetAddress(mailFrom, true);
            address.validate();
            var url = URI.create(frontendResetUrl);
            return (
                ("https".equals(url.getScheme()) || "http".equals(url.getScheme())) &&
                url.getHost() != null &&
                url.getUserInfo() == null &&
                url.getQuery() == null &&
                url.getFragment() == null &&
                url.getPath().endsWith("/reset-password")
            );
        } catch (Exception invalidConfiguration) {
            return false;
        }
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    @Override
    public String toString() {
        return "PasswordResetProperties[redacted]";
    }
}
