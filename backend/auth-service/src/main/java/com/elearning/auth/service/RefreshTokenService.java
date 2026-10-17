package com.elearning.auth.service;

import com.elearning.auth.dto.AuthResponse;
import com.elearning.auth.entity.RefreshToken;

public interface RefreshTokenService {
    String create(Long userId);
    RefreshToken validate(String rawToken);
    Rotation rotate(String rawToken);
    void revoke(String rawToken);
    String requireSession(Long userId, String rawToken);

    // Internal transport only. Controllers return auth(), never this record.
    record Rotation(String rawToken, AuthResponse auth) {
        @Override
        public String toString() {
            return "Rotation[redacted]";
        }
    }
}
