package com.elearning.auth.dto;

import java.time.Instant;

public record LinkedAccountsResponse(boolean passwordEnabled, GoogleAccount google) {
    public record GoogleAccount(String email, Instant linkedAt) {}
}
