CREATE TABLE password_reset_tokens (
    user_id BIGINT NOT NULL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL,
    credential_version BIGINT NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_password_reset_hash UNIQUE (token_hash),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX ix_password_reset_expiry ON password_reset_tokens(expires_at);

-- Keys are SHA-256 of normalized email; throttling does not disclose account existence.
CREATE TABLE password_reset_rate_limits (
    bucket_key VARCHAR(64) NOT NULL PRIMARY KEY,
    window_start TIMESTAMP(6) NOT NULL,
    last_requested_at TIMESTAMP(6) NULL,
    request_count INT NOT NULL DEFAULT 0
);
CREATE INDEX ix_password_reset_rate_window ON password_reset_rate_limits(window_start);
