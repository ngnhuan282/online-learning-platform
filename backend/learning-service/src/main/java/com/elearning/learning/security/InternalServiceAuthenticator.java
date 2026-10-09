package com.elearning.learning.security;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class InternalServiceAuthenticator {

    private final byte[] expectedToken;

    public InternalServiceAuthenticator(
        @Value("${integrations.internal-service-token}") String internalToken
    ) {
        if (internalToken == null || internalToken.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("INTERNAL_SERVICE_TOKEN must contain at least 32 UTF-8 bytes");
        }
        this.expectedToken = internalToken.getBytes(StandardCharsets.UTF_8);
    }

    public void requireValid(String providedToken) {
        byte[] provided = providedToken == null
            ? new byte[0]
            : providedToken.getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expectedToken, provided)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
    }
}
