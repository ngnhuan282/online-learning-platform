-- Existing accounts retain LOCAL authentication and their current BCrypt hashes.
ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(60) NULL;
ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'LOCAL';
-- Binary comparison preserves the exact, case-sensitive OIDC subject on both MySQL and H2.
ALTER TABLE users ADD COLUMN provider_subject VARBINARY(255) NULL;
ALTER TABLE users ADD CONSTRAINT uk_users_provider_subject UNIQUE (auth_provider, provider_subject);

-- Only the hash of the one-time code is stored. Google tokens are never persisted.
CREATE TABLE oauth_login_codes (
    code_hash VARCHAR(64) NOT NULL PRIMARY KEY,
    browser_challenge VARCHAR(43) NOT NULL,
    user_id BIGINT NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_oauth_login_codes_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX ix_oauth_login_codes_expiry ON oauth_login_codes(expires_at);
