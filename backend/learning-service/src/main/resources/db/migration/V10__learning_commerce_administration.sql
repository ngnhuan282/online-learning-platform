ALTER TABLE shop_items ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE pro_memberships ADD COLUMN suspended BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pro_memberships ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE pro_grants ADD COLUMN actor_id BIGINT NULL;
ALTER TABLE pro_grants ADD COLUMN admin_reason VARCHAR(400) NULL;

CREATE TABLE engagement_settings (
    id INT PRIMARY KEY,
    lesson_xp INT NOT NULL,
    quiz_xp INT NOT NULL,
    daily_gems INT NOT NULL,
    xp_per_level INT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_engagement_settings CHECK (lesson_xp BETWEEN 1 AND 100000 AND quiz_xp BETWEEN 1 AND 100000 AND daily_gems BETWEEN 0 AND 100000 AND xp_per_level BETWEEN 1 AND 100000)
);
INSERT INTO engagement_settings(id, lesson_xp, quiz_xp, daily_gems, xp_per_level) VALUES (1,20,10,25,100);
CREATE TABLE engagement_reward_rules (
    code VARCHAR(32) PRIMARY KEY,
    gems INT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_reward_rule_gems CHECK (gems BETWEEN 0 AND 1000000)
);
INSERT INTO engagement_reward_rules(code,gems) VALUES ('FIRST_LESSON',20),('STREAK_3',30),('STREAK_7',70),('STREAK_30',300),('LEVEL_5',100);

CREATE TABLE learner_admin_adjustments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    actor_id BIGINT NOT NULL,
    request_id VARCHAR(64) NOT NULL,
    gems_delta INT NOT NULL,
    xp_delta BIGINT NOT NULL,
    target_level INT NULL,
    freezes_delta INT NOT NULL,
    restored_streak INT NULL,
    gems_before INT NOT NULL,
    gems_after INT NOT NULL,
    xp_before BIGINT NOT NULL,
    xp_after BIGINT NOT NULL,
    freezes_before INT NOT NULL,
    freezes_after INT NOT NULL,
    reason VARCHAR(400) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_admin_adjustment_request UNIQUE (actor_id, request_id),
    CONSTRAINT fk_admin_adjustment_profile FOREIGN KEY (user_id) REFERENCES learner_profiles(user_id)
);
CREATE INDEX idx_admin_adjustment_user ON learner_admin_adjustments(user_id,created_at);
CREATE TABLE learning_admin_actor_locks (actor_id BIGINT PRIMARY KEY);
CREATE TABLE learning_admin_audit (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    actor_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL
);
CREATE INDEX idx_learning_admin_audit_created ON learning_admin_audit(created_at);
