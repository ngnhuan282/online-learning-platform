-- Consolidated initial schema for auth-service (merged from V1..V13).

CREATE TABLE roles (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(64) NOT NULL,
    label VARCHAR(100) NOT NULL DEFAULT '',
    description VARCHAR(500) NULL,
    system_role BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_roles_name UNIQUE (name)
);

CREATE TABLE users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(60) NULL,
    full_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    last_login_at TIMESTAMP(6) NULL,
    deleted_at TIMESTAMP(6) NULL,
    credential_version BIGINT NOT NULL DEFAULT 0,
    avatar_url VARCHAR(500) NULL,
    phone VARCHAR(25) NULL,
    date_of_birth DATE NULL,
    biography VARCHAR(1000) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email)
);

CREATE INDEX idx_users_deleted_at ON users (deleted_at);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (id)
);

CREATE TABLE refresh_tokens (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    persistent BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP(6) NOT NULL,
    revoked_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_refresh_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expiry ON refresh_tokens (expires_at);
CREATE INDEX ix_refresh_session ON refresh_tokens (session_id);

CREATE TABLE permissions (
    code VARCHAR(64) PRIMARY KEY
);

CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL,
    permission_code VARCHAR(64) NOT NULL,
    PRIMARY KEY (role_id, permission_code),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles (id),
    CONSTRAINT fk_role_permissions_code FOREIGN KEY (permission_code) REFERENCES permissions (code)
);

CREATE TABLE admin_audit_logs (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE INDEX idx_admin_audit_created ON admin_audit_logs (created_at);

-- Binary comparison preserves the exact, case-sensitive OIDC subject on both MySQL and H2.
CREATE TABLE user_external_identities (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_subject VARBINARY(255) NOT NULL,
    email VARCHAR(254) NOT NULL,
    linked_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_external_identity_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT uk_external_provider_subject UNIQUE (provider, provider_subject),
    CONSTRAINT uk_external_user_provider UNIQUE (user_id, provider)
);

CREATE TABLE google_link_intents (
    intent_hash VARCHAR(64) NOT NULL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    browser_challenge VARCHAR(43) NOT NULL,
    credential_version BIGINT NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_google_link_intent_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX ix_google_link_session ON google_link_intents (session_id);
CREATE INDEX ix_google_link_expiry ON google_link_intents (expires_at);

-- Only the hash of the one-time code is stored. Google tokens are never persisted.
CREATE TABLE oauth_login_codes (
    code_hash VARCHAR(64) NOT NULL PRIMARY KEY,
    browser_challenge VARCHAR(43) NOT NULL,
    user_id BIGINT NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    purpose VARCHAR(10) NOT NULL DEFAULT 'LOGIN',
    link_intent_hash VARCHAR(64) NULL,
    provider_subject VARBINARY(255) NULL,
    provider_email VARCHAR(254) NULL,
    CONSTRAINT fk_oauth_login_codes_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_oauth_code_link_intent FOREIGN KEY (link_intent_hash) REFERENCES google_link_intents (intent_hash) ON DELETE CASCADE
);

CREATE INDEX ix_oauth_login_codes_expiry ON oauth_login_codes (expires_at);

CREATE TABLE password_reset_tokens (
    user_id BIGINT NOT NULL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL,
    credential_version BIGINT NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_password_reset_hash UNIQUE (token_hash),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX ix_password_reset_expiry ON password_reset_tokens (expires_at);

-- Keys are SHA-256 of normalized email; throttling does not disclose account existence.
CREATE TABLE password_reset_rate_limits (
    bucket_key VARCHAR(64) NOT NULL PRIMARY KEY,
    window_start TIMESTAMP(6) NOT NULL,
    last_requested_at TIMESTAMP(6) NULL,
    request_count INT NOT NULL DEFAULT 0
);

CREATE INDEX ix_password_reset_rate_window ON password_reset_rate_limits (window_start);

-- System roles and RBAC permissions baseline.
INSERT INTO roles (name, label, description, system_role) VALUES
    ('USER', 'Học viên', 'Học tập và quản lý tài khoản cá nhân', TRUE),
    ('ADMIN', 'Quản trị viên', 'Toàn quyền quản trị hệ thống', TRUE);

INSERT INTO permissions (code) VALUES
    ('ADMIN_ACCESS'),
    ('DASHBOARD_VIEW'),
    ('USER_VIEW'),
    ('USER_CREATE'),
    ('USER_UPDATE'),
    ('USER_STATUS_UPDATE'),
    ('USER_ROLES_ASSIGN'),
    ('USER_DELETE'),
    ('ROLE_VIEW'),
    ('ROLE_MANAGE'),
    ('AUDIT_VIEW'),
    ('COURSE_VIEW'),
    ('COURSE_CREATE'),
    ('COURSE_UPDATE'),
    ('COURSE_DELETE'),
    ('CATEGORY_VIEW'),
    ('CATEGORY_CREATE'),
    ('CATEGORY_UPDATE'),
    ('CATEGORY_DELETE'),
    ('LEARNING_REPORT_VIEW'),
    ('PAYMENT_REPORT_VIEW'),
    ('SHOP_VIEW'),
    ('SHOP_CREATE'),
    ('SHOP_UPDATE'),
    ('SHOP_DELETE'),
    ('INVENTORY_VIEW'),
    ('INVENTORY_MANAGE'),
    ('ENGAGEMENT_VIEW'),
    ('GEM_ADJUST'),
    ('XP_ADJUST'),
    ('STREAK_ADJUST'),
    ('ENGAGEMENT_CONFIG_VIEW'),
    ('ENGAGEMENT_CONFIG_UPDATE'),
    ('REWARD_CREATE'),
    ('REWARD_DELETE'),
    ('PRO_PLAN_VIEW'),
    ('PRO_PLAN_CREATE'),
    ('PRO_PLAN_UPDATE'),
    ('PRO_PLAN_DELETE'),
    ('PRO_MEMBER_VIEW'),
    ('PRO_MEMBER_MANAGE'),
    ('PRO_CODE_VIEW'),
    ('PRO_CODE_CREATE'),
    ('PRO_CODE_UPDATE'),
    ('PRO_CODE_REVOKE'),
    ('COMMUNITY_VIEW'),
    ('COMMUNITY_CREATE'),
    ('COMMUNITY_UPDATE'),
    ('COMMUNITY_DELETE'),
    ('COMMUNITY_MODERATE'),
    ('QUIZ_VIEW'),
    ('QUIZ_MANAGE'),
    ('NOTIFICATION_VIEW'),
    ('NOTIFICATION_MANAGE');

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ADMIN';
