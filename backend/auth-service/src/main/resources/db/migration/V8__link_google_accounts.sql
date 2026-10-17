CREATE TABLE user_external_identities (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_subject VARBINARY(255) NOT NULL,
    email VARCHAR(254) NOT NULL,
    linked_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_external_identity_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT uk_external_provider_subject UNIQUE (provider, provider_subject),
    CONSTRAINT uk_external_user_provider UNIQUE (user_id, provider)
);

-- Preserve every V7 Google account and its internal userId. Passwords are untouched.
INSERT INTO user_external_identities (user_id, provider, provider_subject, email, linked_at)
SELECT id, 'GOOGLE', provider_subject, email, COALESCE(last_login_at, created_at)
FROM users WHERE auth_provider = 'GOOGLE' AND provider_subject IS NOT NULL;
ALTER TABLE users DROP CONSTRAINT uk_users_provider_subject;
ALTER TABLE users DROP COLUMN provider_subject;
ALTER TABLE users DROP COLUMN auth_provider;
ALTER TABLE users ADD COLUMN credential_version BIGINT NOT NULL DEFAULT 0;

-- Existing active cookies remain valid; future rotations preserve this stable session identifier.
ALTER TABLE refresh_tokens ADD COLUMN session_id VARCHAR(64) NULL;
UPDATE refresh_tokens SET session_id = token_hash;
ALTER TABLE refresh_tokens MODIFY COLUMN session_id VARCHAR(64) NOT NULL;
CREATE INDEX ix_refresh_session ON refresh_tokens(session_id);

CREATE TABLE google_link_intents (
    intent_hash VARCHAR(64) NOT NULL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    browser_challenge VARCHAR(43) NOT NULL,
    credential_version BIGINT NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_google_link_intent_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX ix_google_link_session ON google_link_intents(session_id);
CREATE INDEX ix_google_link_expiry ON google_link_intents(expires_at);

ALTER TABLE oauth_login_codes ADD COLUMN purpose VARCHAR(10) NOT NULL DEFAULT 'LOGIN';
ALTER TABLE oauth_login_codes ADD COLUMN link_intent_hash VARCHAR(64) NULL;
ALTER TABLE oauth_login_codes ADD COLUMN provider_subject VARBINARY(255) NULL;
ALTER TABLE oauth_login_codes ADD COLUMN provider_email VARCHAR(254) NULL;
ALTER TABLE oauth_login_codes ADD CONSTRAINT fk_oauth_code_link_intent
    FOREIGN KEY (link_intent_hash) REFERENCES google_link_intents(intent_hash) ON DELETE CASCADE;
