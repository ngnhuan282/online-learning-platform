package com.elearning.course.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class MediaTickets {

    public static final String DOWNLOAD_PREFIX = "/api/v1/media/download/";
    private static final long TTL_SECONDS = 300;
    private final byte[] key;

    public MediaTickets(@Value("${security.jwt.secret}") String secret) {
        key = secret.getBytes(StandardCharsets.UTF_8);
    }

    public String signLocalUrl(String url) {
        if (url == null || !url.startsWith(DOWNLOAD_PREFIX)) return url;
        String path = url.split("\\?", 2)[0];
        String objectKey = path.substring(DOWNLOAD_PREFIX.length());
        long expires = Instant.now().getEpochSecond() + TTL_SECONDS;
        return path + "?expires=" + expires + "&signature=" + signature(objectKey, expires);
    }

    public boolean valid(String objectKey, String expiresValue, String supplied) {
        if (expiresValue == null || supplied == null) return false;
        try {
            long expires = Long.parseLong(expiresValue);
            long now = Instant.now().getEpochSecond();
            return expires > now && expires <= now + TTL_SECONDS
                    && MessageDigest.isEqual(signature(objectKey, expires).getBytes(StandardCharsets.UTF_8),
                            supplied.getBytes(StandardCharsets.UTF_8));
        } catch (NumberFormatException exception) {
            return false;
        }
    }

    private String signature(String objectKey, long expires) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            // Separate the media ticket domain from access JWT signatures.
            byte[] payload = ("media-download\n" + objectKey + "\n" + expires).getBytes(StandardCharsets.UTF_8);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload));
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("Media signing is unavailable", exception);
        }
    }
}
