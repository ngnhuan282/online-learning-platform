ALTER TABLE enrollments ADD COLUMN access_source VARCHAR(16) NOT NULL DEFAULT 'COURSE';

CREATE TABLE pro_memberships (
    user_id BIGINT PRIMARY KEY,
    expires_at TIMESTAMP(6) NULL,
    plan_code VARCHAR(32) NULL
);

CREATE TABLE pro_grants (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    reference_code VARCHAR(64) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    source_type VARCHAR(16) NOT NULL,
    plan_code VARCHAR(32) NOT NULL,
    duration_months INT NOT NULL,
    granted_at TIMESTAMP(6) NOT NULL,
    revoked_at TIMESTAMP(6) NULL,
    CONSTRAINT fk_pro_grant_membership FOREIGN KEY (user_id) REFERENCES pro_memberships(user_id),
    CONSTRAINT chk_pro_grant_months CHECK (duration_months IN (1, 3, 12))
);
CREATE INDEX idx_pro_grants_user ON pro_grants(user_id, granted_at, id);

CREATE TABLE pro_activation_codes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code_hash VARCHAR(64) NOT NULL UNIQUE,
    code_suffix VARCHAR(4) NOT NULL,
    plan_code VARCHAR(32) NOT NULL,
    duration_months INT NOT NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    expires_at TIMESTAMP(6) NULL,
    redeemed_by BIGINT NULL,
    redeemed_at TIMESTAMP(6) NULL,
    revoked_at TIMESTAMP(6) NULL
);

CREATE TABLE pro_activation_attempts (
    user_id BIGINT PRIMARY KEY,
    window_start TIMESTAMP(6) NOT NULL,
    attempts INT NOT NULL DEFAULT 0
);
