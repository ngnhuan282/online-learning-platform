-- ChitChatGo All-in-One Schema & Development Seed for MySQL 8.4 (File A).
-- Standalone usage: run THIS SINGLE FILE on a blank MySQL 8.4 server to create
-- all 5 databases, all 71 tables (exact union of every service V1 migration),
-- system baseline rows, and >= 15 realistic sample rows for every business table.
-- Post-Flyway usage: also safe to run after all 5 services complete Flyway V1
-- (CREATE TABLE IF NOT EXISTS is a no-op and flyway_schema_history is untouched).
-- Admin: admin@gmail.com / Admin123; learner: user@gmail.com / User123.
-- Other sample learners use User123!; pham.thi.d@elearning.com is intentionally LOCKED.
-- Users are resolved by email, roles by name. Existing user IDs and profile names are preserved.
-- All payment fixtures use MOCK; all token/reset fixtures are expired/revoked.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- PART 1: COMPLETE SCHEMA FOR ALL 5 DATABASES (71 TABLES)
-- Derived directly from each service consolidated V1__init_*_schema.sql.
-- Safe both on a blank MySQL 8.4 instance AND after Flyway V1 migrations.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS auth_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS course_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS learning_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS payment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS ai_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- auth_db (auth-service — 12 tables)
-- -----------------------------------------------------------------------------
USE auth_db;

CREATE TABLE IF NOT EXISTS roles (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(64) NOT NULL,
    label VARCHAR(100) NOT NULL DEFAULT '',
    description VARCHAR(500) NULL,
    system_role BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_roles_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
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
    CONSTRAINT uk_users_email UNIQUE (email),
    INDEX idx_users_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
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
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id),
    INDEX idx_refresh_tokens_user (user_id),
    INDEX idx_refresh_tokens_expiry (expires_at),
    INDEX ix_refresh_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
    code VARCHAR(64) PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT NOT NULL,
    permission_code VARCHAR(64) NOT NULL,
    PRIMARY KEY (role_id, permission_code),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles (id),
    CONSTRAINT fk_role_permissions_code FOREIGN KEY (permission_code) REFERENCES permissions (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_admin_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_external_identities (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_subject VARBINARY(255) NOT NULL,
    email VARCHAR(254) NOT NULL,
    linked_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_external_identity_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT uk_external_provider_subject UNIQUE (provider, provider_subject),
    CONSTRAINT uk_external_user_provider UNIQUE (user_id, provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS google_link_intents (
    intent_hash VARCHAR(64) NOT NULL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    browser_challenge VARCHAR(43) NOT NULL,
    credential_version BIGINT NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_google_link_intent_user FOREIGN KEY (user_id) REFERENCES users (id),
    INDEX ix_google_link_session (session_id),
    INDEX ix_google_link_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oauth_login_codes (
    code_hash VARCHAR(64) NOT NULL PRIMARY KEY,
    browser_challenge VARCHAR(43) NOT NULL,
    user_id BIGINT NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    purpose VARCHAR(10) NOT NULL DEFAULT 'LOGIN',
    link_intent_hash VARCHAR(64) NULL,
    provider_subject VARBINARY(255) NULL,
    provider_email VARCHAR(254) NULL,
    CONSTRAINT fk_oauth_login_codes_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_oauth_code_link_intent FOREIGN KEY (link_intent_hash) REFERENCES google_link_intents (intent_hash) ON DELETE CASCADE,
    INDEX ix_oauth_login_codes_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    user_id BIGINT NOT NULL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL,
    credential_version BIGINT NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_password_reset_hash UNIQUE (token_hash),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id),
    INDEX ix_password_reset_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_rate_limits (
    bucket_key VARCHAR(64) NOT NULL PRIMARY KEY,
    window_start TIMESTAMP(6) NOT NULL,
    last_requested_at TIMESTAMP(6) NULL,
    request_count INT NOT NULL DEFAULT 0,
    INDEX ix_password_reset_rate_window (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- course_db (course-service — 6 tables)
-- -----------------------------------------------------------------------------
USE course_db;

CREATE TABLE IF NOT EXISTS categories (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description VARCHAR(500) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_categories_name UNIQUE (name),
    CONSTRAINT uk_categories_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    description VARCHAR(2000) NULL,
    category_id BIGINT NOT NULL,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    original_price DECIMAL(12, 2) NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'BEGINNER',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    thumbnail_url VARCHAR(500) NULL,
    avg_rating DOUBLE NOT NULL DEFAULT 0,
    review_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_courses_slug UNIQUE (slug),
    CONSTRAINT fk_courses_category FOREIGN KEY (category_id) REFERENCES categories (id),
    INDEX idx_courses_category (category_id),
    INDEX idx_courses_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sections (
    id BIGINT NOT NULL AUTO_INCREMENT,
    course_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_sections_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
    INDEX idx_sections_course (course_id),
    INDEX idx_sections_course_order (course_id, order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lessons (
    id BIGINT NOT NULL AUTO_INCREMENT,
    section_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    lesson_type VARCHAR(20) NOT NULL,
    content TEXT NULL,
    video_url VARCHAR(500) NULL,
    duration INT NULL,
    order_index INT NOT NULL DEFAULT 0,
    is_preview BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_lessons_section FOREIGN KEY (section_id) REFERENCES sections (id) ON DELETE CASCADE,
    INDEX idx_lessons_section (section_id),
    INDEX idx_lessons_section_order (section_id, order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lesson_resources (
    id BIGINT NOT NULL AUTO_INCREMENT,
    lesson_id BIGINT NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    content_type VARCHAR(100),
    object_key VARCHAR(500) NOT NULL,
    download_url VARCHAR(1000),
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_resources_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
    INDEX idx_resources_lesson_id (lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    user_full_name VARCHAR(150),
    rating INT NOT NULL,
    comment TEXT,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6),
    CONSTRAINT fk_review_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
    CONSTRAINT uq_review_user_course UNIQUE (course_id, user_id),
    INDEX idx_reviews_course (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- learning_db (learning-service — 43 tables)
-- -----------------------------------------------------------------------------
USE learning_db;

CREATE TABLE IF NOT EXISTS enrollments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    source_order_code VARCHAR(40) NULL,
    access_source VARCHAR(16) NOT NULL DEFAULT 'COURSE',
    status VARCHAR(32) NOT NULL,
    enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    last_accessed_at TIMESTAMP NULL,
    CONSTRAINT uk_enrollments_user_course UNIQUE (user_id, course_id),
    CONSTRAINT chk_enrollments_status CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    UNIQUE INDEX uk_enrollments_source_order (source_order_code),
    INDEX idx_enrollments_user_status (user_id, status),
    INDEX idx_enrollments_course (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_enrollment_receipts (
    order_code VARCHAR(40) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lesson_progress (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    lesson_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    progress_percent INT NOT NULL DEFAULT 0,
    time_spent_seconds BIGINT NOT NULL DEFAULT 0,
    first_accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_lesson_progress_user_lesson UNIQUE (user_id, lesson_id),
    CONSTRAINT chk_lesson_progress_status CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
    CONSTRAINT chk_lesson_progress_percent CHECK (progress_percent BETWEEN 0 AND 100),
    INDEX idx_lesson_progress_user_course (user_id, course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quizzes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    course_id BIGINT NOT NULL,
    lesson_id BIGINT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(1000) NULL,
    passing_score INT NOT NULL DEFAULT 70,
    time_limit_minutes INT NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_quizzes_passing_score CHECK (passing_score BETWEEN 0 AND 100),
    INDEX idx_quizzes_course_published (course_id, published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_questions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    quiz_id BIGINT NOT NULL,
    question_text VARCHAR(1000) NOT NULL,
    question_type VARCHAR(32) NOT NULL,
    points INT NOT NULL DEFAULT 1,
    position INT NOT NULL,
    CONSTRAINT fk_quiz_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id),
    CONSTRAINT chk_quiz_questions_type CHECK (question_type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TEXT')),
    CONSTRAINT chk_quiz_questions_points CHECK (points > 0),
    INDEX idx_quiz_questions_quiz_position (quiz_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_options (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    question_id BIGINT NOT NULL,
    option_text VARCHAR(1000) NOT NULL,
    correct BOOLEAN NOT NULL DEFAULT FALSE,
    position INT NOT NULL,
    CONSTRAINT fk_quiz_options_question FOREIGN KEY (question_id) REFERENCES quiz_questions (id),
    INDEX idx_quiz_options_question_position (question_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    quiz_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    score INT NULL,
    passed BOOLEAN NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL,
    CONSTRAINT fk_quiz_attempts_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id),
    CONSTRAINT chk_quiz_attempts_status CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'GRADED')),
    CONSTRAINT chk_quiz_attempts_score CHECK (score IS NULL OR score BETWEEN 0 AND 100),
    INDEX idx_quiz_attempts_user_quiz (user_id, quiz_id),
    INDEX idx_quiz_attempts_user_course (user_id, course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_answers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    attempt_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    selected_option_id BIGINT NULL,
    answer_text VARCHAR(2000) NULL,
    correct BOOLEAN NULL,
    points_awarded INT NULL,
    CONSTRAINT fk_quiz_answers_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts (id),
    CONSTRAINT fk_quiz_answers_question FOREIGN KEY (question_id) REFERENCES quiz_questions (id),
    CONSTRAINT fk_quiz_answers_selected_option FOREIGN KEY (selected_option_id) REFERENCES quiz_options (id),
    INDEX idx_quiz_answers_attempt (attempt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body VARCHAR(1000) NOT NULL,
    action_url VARCHAR(500) NULL,
    event_key VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_notifications_user_event UNIQUE (user_id, event_key),
    CONSTRAINT chk_notifications_type CHECK (
        type IN (
            'ENROLLMENT', 'PROGRESS', 'QUIZ', 'SYSTEM', 'COURSE_ENROLLED',
            'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED', 'PAYMENT_REFUNDED',
            'LESSON_COMPLETED', 'QUIZ_RESULT_AVAILABLE'
        )
    ),
    INDEX idx_notifications_user_created (user_id, created_at),
    INDEX idx_notifications_user_read (user_id, read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learner_profiles (
    user_id BIGINT PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    total_xp BIGINT NOT NULL DEFAULT 0,
    gems INT NOT NULL DEFAULT 0,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    last_activity_date DATE NULL,
    active_frame VARCHAR(32) NULL,
    streak_freezes INT NOT NULL DEFAULT 0,
    streak_accounted_through DATE NULL,
    active_background VARCHAR(32) NULL,
    CONSTRAINT chk_learner_points CHECK (total_xp >= 0 AND gems >= 0),
    CONSTRAINT chk_streak_freezes CHECK (streak_freezes BETWEEN 0 AND 7)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_xp_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    source_type VARCHAR(16) NOT NULL,
    source_id BIGINT NOT NULL,
    xp INT NOT NULL,
    earned_at TIMESTAMP NOT NULL,
    CONSTRAINT uk_learning_xp_source UNIQUE (user_id, source_type, source_id),
    CONSTRAINT fk_learning_xp_profile FOREIGN KEY (user_id) REFERENCES learner_profiles (user_id),
    CONSTRAINT chk_learning_xp CHECK (xp > 0),
    INDEX idx_learning_xp_period (earned_at, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_activity_days (
    user_id BIGINT NOT NULL,
    activity_date DATE NOT NULL,
    activity_count INT NOT NULL DEFAULT 1,
    gems_awarded INT NULL,
    PRIMARY KEY (user_id, activity_date),
    CONSTRAINT fk_learning_activity_profile FOREIGN KEY (user_id) REFERENCES learner_profiles (user_id),
    INDEX idx_learning_activity_report (activity_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learner_rewards (
    user_id BIGINT NOT NULL,
    reward_code VARCHAR(32) NOT NULL,
    gems INT NOT NULL,
    claimed_at TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, reward_code),
    CONSTRAINT fk_learner_reward_profile FOREIGN KEY (user_id) REFERENCES learner_profiles (user_id),
    INDEX idx_learner_rewards_report (claimed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_topics (
    id BIGINT PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    position INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_posts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    author_id BIGINT NOT NULL,
    topic_id BIGINT NOT NULL,
    kind VARCHAR(16) NOT NULL,
    title VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_comment_id BIGINT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP NULL,
    CONSTRAINT fk_community_post_author FOREIGN KEY (author_id) REFERENCES learner_profiles (user_id),
    CONSTRAINT fk_community_post_topic FOREIGN KEY (topic_id) REFERENCES community_topics (id),
    CONSTRAINT chk_community_post_kind CHECK (kind IN ('DISCUSSION', 'QUESTION')),
    INDEX idx_community_posts_feed (deleted_at, topic_id, created_at, id),
    INDEX idx_community_posts_author (author_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_comments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    body VARCHAR(4000) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP NULL,
    CONSTRAINT fk_community_comment_post FOREIGN KEY (post_id) REFERENCES community_posts (id),
    CONSTRAINT fk_community_comment_author FOREIGN KEY (author_id) REFERENCES learner_profiles (user_id),
    INDEX idx_community_comments_post (post_id, deleted_at, created_at, id),
    INDEX idx_community_comments_author (author_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_items (
    code VARCHAR(32) PRIMARY KEY,
    name_key VARCHAR(120) NOT NULL,
    item_type VARCHAR(16) NOT NULL,
    rarity VARCHAR(16) NOT NULL,
    price INT NOT NULL,
    original_price INT NULL,
    asset_key VARCHAR(64) NOT NULL,
    position INT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP(6) NULL,
    CONSTRAINT chk_shop_item_type CHECK (item_type IN ('FRAME', 'BACKGROUND', 'FREEZE')),
    CONSTRAINT chk_shop_price CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_inventory (
    user_id BIGINT NOT NULL,
    item_code VARCHAR(32) NOT NULL,
    acquired_at TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, item_code),
    CONSTRAINT fk_inventory_profile FOREIGN KEY (user_id) REFERENCES learner_profiles (user_id),
    CONSTRAINT fk_inventory_item FOREIGN KEY (item_code) REFERENCES shop_items (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_purchases (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    request_id VARCHAR(64) NOT NULL,
    item_code VARCHAR(32) NOT NULL,
    gems_spent INT NOT NULL,
    item_granted BOOLEAN NULL,
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT uk_shop_purchase_request UNIQUE (user_id, request_id),
    CONSTRAINT fk_purchase_profile FOREIGN KEY (user_id) REFERENCES learner_profiles (user_id),
    CONSTRAINT fk_purchase_item FOREIGN KEY (item_code) REFERENCES shop_items (code),
    INDEX idx_shop_purchases_report (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_frozen_days (
    user_id BIGINT NOT NULL,
    frozen_date DATE NOT NULL,
    used_at TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, frozen_date),
    CONSTRAINT fk_frozen_day_profile FOREIGN KEY (user_id) REFERENCES learner_profiles (user_id),
    INDEX idx_frozen_days_report (used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pro_memberships (
    user_id BIGINT PRIMARY KEY,
    expires_at TIMESTAMP(6) NULL,
    plan_code VARCHAR(32) NULL,
    suspended BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pro_grants (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    reference_code VARCHAR(64) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    source_type VARCHAR(16) NOT NULL,
    plan_code VARCHAR(32) NOT NULL,
    duration_months INT NOT NULL,
    granted_at TIMESTAMP(6) NOT NULL,
    revoked_at TIMESTAMP(6) NULL,
    actor_id BIGINT NULL,
    admin_reason VARCHAR(400) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_pro_grant_membership FOREIGN KEY (user_id) REFERENCES pro_memberships (user_id),
    CONSTRAINT chk_pro_grant_months CHECK (duration_months IN (1, 3, 12)),
    INDEX idx_pro_grants_user (user_id, granted_at, id),
    INDEX idx_pro_grants_report (granted_at),
    INDEX idx_pro_revocations_report (revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pro_activation_codes (
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
    revoked_at TIMESTAMP(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    INDEX idx_pro_codes_report (created_at),
    INDEX idx_pro_codes_redeemed_report (redeemed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pro_activation_attempts (
    user_id BIGINT PRIMARY KEY,
    window_start TIMESTAMP(6) NOT NULL,
    attempts INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS engagement_settings (
    id INT PRIMARY KEY,
    lesson_xp INT NOT NULL,
    quiz_xp INT NOT NULL,
    daily_gems INT NOT NULL,
    xp_per_level INT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_engagement_settings CHECK (
        lesson_xp BETWEEN 1 AND 100000
        AND quiz_xp BETWEEN 1 AND 100000
        AND daily_gems BETWEEN 0 AND 100000
        AND xp_per_level BETWEEN 1 AND 100000
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS engagement_reward_rules (
    code VARCHAR(32) PRIMARY KEY,
    label VARCHAR(120) NOT NULL DEFAULT '',
    metric VARCHAR(20) NOT NULL DEFAULT 'STREAK',
    threshold INT NOT NULL DEFAULT 1,
    gems INT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP(6) NULL,
    CONSTRAINT chk_reward_rule_gems CHECK (gems BETWEEN 0 AND 1000000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learner_admin_adjustments (
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
    CONSTRAINT fk_admin_adjustment_profile FOREIGN KEY (user_id) REFERENCES learner_profiles (user_id),
    INDEX idx_admin_adjustment_user (user_id, created_at),
    INDEX idx_learner_adjustments_report (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_admin_actor_locks (
    actor_id BIGINT PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_admin_audit (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    actor_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    INDEX idx_learning_admin_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gem_topup_receipts (
    order_code VARCHAR(64) NOT NULL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    gems INT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT chk_gem_topup_positive CHECK (gems > 0),
    INDEX idx_gem_topup_user (user_id),
    INDEX idx_gem_topup_report (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS toeic_exams (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    slug VARCHAR(128) NOT NULL,
    seed_key VARCHAR(128) NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(2000) NULL,
    duration_minutes INT NOT NULL,
    source_label VARCHAR(1000) NULL,
    question_count INT NOT NULL DEFAULT 0,
    lesson_count INT NOT NULL DEFAULT 0,
    definition_json LONGTEXT NOT NULL,
    section VARCHAR(16) NOT NULL DEFAULT 'READING',
    published BOOLEAN NOT NULL DEFAULT FALSE,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_toeic_exams_slug UNIQUE (slug),
    CONSTRAINT uk_toeic_exams_seed UNIQUE (seed_key),
    CONSTRAINT chk_toeic_duration CHECK (duration_minutes BETWEEN 1 AND 180),
    INDEX idx_toeic_exams_catalog (deleted, published, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS toeic_attempts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    exam_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    mode VARCHAR(16) NOT NULL,
    part INT NULL,
    status VARCHAR(16) NOT NULL,
    snapshot_json LONGTEXT NOT NULL,
    answers_json LONGTEXT NOT NULL,
    total_questions INT NOT NULL,
    score INT NULL,
    correct_count INT NULL,
    started_at TIMESTAMP(6) NOT NULL,
    deadline_at TIMESTAMP(6) NULL,
    submitted_at TIMESTAMP(6) NULL,
    CONSTRAINT fk_toeic_attempt_exam FOREIGN KEY (exam_id) REFERENCES toeic_exams (id),
    CONSTRAINT chk_toeic_attempt_mode CHECK (mode IN ('PRACTICE', 'EXAM')),
    CONSTRAINT chk_toeic_attempt_part CHECK (part IS NULL OR part BETWEEN 1 AND 7),
    CONSTRAINT chk_toeic_attempt_status CHECK (status IN ('IN_PROGRESS', 'GRADED')),
    CONSTRAINT chk_toeic_attempt_total CHECK (total_questions > 0),
    CONSTRAINT chk_toeic_attempt_score CHECK (score IS NULL OR score BETWEEN 0 AND 100),
    INDEX idx_toeic_attempt_owner (user_id, exam_id, status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS toeic_lesson_progress (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    exam_id BIGINT NOT NULL,
    lesson_id VARCHAR(80) NOT NULL,
    exam_version BIGINT NOT NULL,
    completed_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_toeic_progress_exam FOREIGN KEY (exam_id) REFERENCES toeic_exams (id),
    CONSTRAINT uk_toeic_progress_owner UNIQUE (user_id, exam_id, lesson_id, exam_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS toeic_notes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    exam_id BIGINT NOT NULL,
    attempt_id BIGINT NULL,
    question_number INT NULL,
    part INT NULL,
    exam_title VARCHAR(255) NOT NULL,
    selected_text VARCHAR(500) NOT NULL,
    note_content VARCHAR(2000) NOT NULL,
    color VARCHAR(16) NOT NULL DEFAULT 'yellow',
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_toeic_notes_exam FOREIGN KEY (exam_id) REFERENCES toeic_exams (id),
    CONSTRAINT chk_toeic_notes_color CHECK (color IN ('yellow', 'blue', 'green', 'pink')),
    INDEX idx_toeic_notes_user (user_id, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS toeic_media (
    id VARCHAR(36) PRIMARY KEY,
    object_key VARCHAR(48) NOT NULL UNIQUE,
    original_name VARCHAR(180) NOT NULL,
    media_kind VARCHAR(8) NOT NULL,
    content_type VARCHAR(32) NOT NULL,
    size_bytes BIGINT NOT NULL,
    cloud_copy BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT chk_toeic_media_kind CHECK (media_kind IN ('AUDIO', 'IMAGE')),
    CONSTRAINT chk_toeic_media_size CHECK (size_bytes > 0),
    INDEX idx_toeic_media_created (created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dictation_audio (
    audio_key VARCHAR(80) PRIMARY KEY,
    original_name VARCHAR(180) NOT NULL,
    duration_seconds DOUBLE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dictation_exercises (
    id VARCHAR(36) PRIMARY KEY,
    current_version INT NOT NULL,
    published_version INT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dictation_revisions (
    exercise_id VARCHAR(36) NOT NULL,
    version INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    topic VARCHAR(60) NOT NULL,
    level VARCHAR(2) NOT NULL,
    duration_seconds DOUBLE NOT NULL,
    toeic_test INT NULL,
    definition MEDIUMTEXT NOT NULL,
    PRIMARY KEY (exercise_id, version),
    CONSTRAINT fk_dictation_revision_exercise FOREIGN KEY (exercise_id) REFERENCES dictation_exercises (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dictation_attempts (
    id VARCHAR(36) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    exercise_id VARCHAR(36) NOT NULL,
    version INT NOT NULL,
    current_index INT NOT NULL DEFAULT 0,
    scoring_mode VARCHAR(6) NOT NULL DEFAULT 'LIVE',
    request_id VARCHAR(80) NOT NULL,
    started_at TIMESTAMP(6) NOT NULL,
    completed_at TIMESTAMP(6) NULL,
    CONSTRAINT uk_dictation_start_request UNIQUE (user_id, request_id),
    CONSTRAINT fk_dictation_attempt_revision FOREIGN KEY (exercise_id, version) REFERENCES dictation_revisions (exercise_id, version),
    INDEX ix_dictation_user_history (user_id, started_at),
    INDEX ix_dictation_user_exercise (user_id, exercise_id, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dictation_responses (
    attempt_id VARCHAR(36) NOT NULL,
    sentence_index INT NOT NULL,
    answer_text TEXT NOT NULL,
    revealed BOOLEAN NOT NULL DEFAULT FALSE,
    skipped BOOLEAN NOT NULL DEFAULT FALSE,
    first_grade MEDIUMTEXT NULL,
    latest_grade MEDIUMTEXT NULL,
    hint_indices MEDIUMTEXT NULL,
    earned_indices MEDIUMTEXT NULL,
    PRIMARY KEY (attempt_id, sentence_index),
    CONSTRAINT fk_dictation_response_attempt FOREIGN KEY (attempt_id) REFERENCES dictation_attempts (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dictation_workbook_imports (
    content_sha256 CHAR(64) PRIMARY KEY,
    exercise_id VARCHAR(36) NOT NULL,
    CONSTRAINT fk_dictation_workbook_exercise
        FOREIGN KEY (exercise_id) REFERENCES dictation_exercises (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dictation_workbook_sync (
    exercise_id VARCHAR(36) PRIMARY KEY,
    version INT NULL,
    pending BOOLEAN NOT NULL,
    CONSTRAINT fk_dictation_workbook_sync_exercise
        FOREIGN KEY (exercise_id) REFERENCES dictation_exercises (id) ON DELETE CASCADE,
    INDEX ix_dictation_workbook_sync_pending (pending, exercise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dictation_workbook_sources (
    exercise_id VARCHAR(36) NOT NULL,
    storage VARCHAR(16) NOT NULL,
    object_key VARCHAR(512) NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    PRIMARY KEY (exercise_id, storage),
    CONSTRAINT uk_dictation_workbook_source_key UNIQUE (storage, object_key),
    CONSTRAINT fk_dictation_workbook_source_exercise
        FOREIGN KEY (exercise_id) REFERENCES dictation_exercises (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- payment_db (payment-service — 6 tables)
-- -----------------------------------------------------------------------------
USE payment_db;

CREATE TABLE IF NOT EXISTS pro_plans (
    code VARCHAR(32) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    duration_months INT NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP(6) NULL,
    CONSTRAINT chk_pro_plan_months CHECK (duration_months IN (1, 3, 12)),
    CONSTRAINT chk_pro_plan_price CHECK (price > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_code VARCHAR(40) NOT NULL,
    user_id BIGINT NOT NULL,
    idempotency_key VARCHAR(64) NULL,
    product_type VARCHAR(16) NOT NULL DEFAULT 'COURSE',
    plan_code VARCHAR(32) NULL,
    plan_duration_months INT NULL,
    gem_package_code VARCHAR(32) NULL,
    gem_amount INT NULL,
    status VARCHAR(30) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    expires_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_orders_order_code UNIQUE (order_code),
    UNIQUE INDEX uk_orders_user_idempotency (user_id, idempotency_key),
    INDEX idx_orders_user_created (user_id, created_at),
    INDEX idx_orders_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    course_id BIGINT NULL,
    course_title VARCHAR(255) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    final_price DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id),
    INDEX idx_order_items_course (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    checkout_url VARCHAR(1024) NULL,
    provider_transaction_code VARCHAR(100) NULL,
    failure_code VARCHAR(100) NULL,
    failure_message VARCHAR(500) NULL,
    paid_at TIMESTAMP(6) NULL,
    enrollment_activated_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id),
    INDEX idx_payments_order_created (order_id, created_at),
    INDEX idx_payments_status_created (status, created_at),
    INDEX idx_payments_provider_transaction (provider, provider_transaction_code),
    INDEX idx_payments_activation (provider, status, enrollment_activated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_transactions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    payment_id BIGINT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    provider_transaction_code VARCHAR(100) NULL,
    payload_checksum VARCHAR(128) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_payment_transactions_payment FOREIGN KEY (payment_id) REFERENCES payments (id),
    INDEX idx_payment_transactions_payment_created (payment_id, created_at),
    INDEX idx_payment_transactions_provider_code (provider, provider_transaction_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_admin_audit (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    actor_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- ai_db (ai-service — 4 tables)
-- -----------------------------------------------------------------------------
USE ai_db;

CREATE TABLE IF NOT EXISTS ai_conversations (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(100) NOT NULL,
    course_id BIGINT NULL,
    lesson_id BIGINT NULL,
    context_title VARCHAR(255) NULL,
    active_request_id VARCHAR(64) NULL,
    active_until DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    INDEX idx_ai_conversations_user_updated (user_id, updated_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_messages (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    sender VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    truncated BOOLEAN NOT NULL DEFAULT FALSE,
    request_id VARCHAR(64) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_ai_message_conversation FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id),
    CONSTRAINT uq_ai_message_request_sender UNIQUE (conversation_id, request_id, sender),
    INDEX idx_ai_messages_conversation_id (conversation_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    model VARCHAR(100) NOT NULL,
    outcome VARCHAR(40) NOT NULL,
    input_tokens INT NOT NULL,
    output_tokens INT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    INDEX idx_ai_usage_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_daily_usage (
    user_id BIGINT NOT NULL,
    usage_date DATE NOT NULL,
    request_count INT NOT NULL,
    PRIMARY KEY (user_id, usage_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- PART 2: TRANSACTIONAL BASELINE & SAMPLE DATA (>= 15 ROWS / BUSINESS TABLE)
-- =============================================================================
USE auth_db;

DROP PROCEDURE IF EXISTS seed_chitchatgo_data;
DELIMITER $$
CREATE PROCEDURE seed_chitchatgo_data()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Verify all 71 InnoDB tables exist across all 5 service databases.
    IF (SELECT COUNT(*) FROM information_schema.tables
        WHERE engine = 'InnoDB' AND (
            (table_schema = 'auth_db' AND table_name IN (
                'roles', 'users', 'user_roles', 'refresh_tokens', 'permissions', 'role_permissions',
                'admin_audit_logs', 'user_external_identities', 'google_link_intents',
                'oauth_login_codes', 'password_reset_tokens', 'password_reset_rate_limits'))
            OR (table_schema = 'course_db' AND table_name IN (
                'categories', 'courses', 'sections', 'lessons', 'lesson_resources', 'reviews'))
            OR (table_schema = 'learning_db' AND table_name IN (
                'enrollments', 'payment_enrollment_receipts', 'lesson_progress', 'quizzes',
                'quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_answers', 'notifications',
                'learner_profiles', 'learning_xp_events', 'learning_activity_days', 'learner_rewards',
                'community_topics', 'community_posts', 'community_comments', 'shop_items',
                'shop_inventory', 'shop_purchases', 'learning_frozen_days', 'pro_memberships',
                'pro_grants', 'pro_activation_codes', 'pro_activation_attempts', 'engagement_settings',
                'engagement_reward_rules', 'learner_admin_adjustments', 'learning_admin_actor_locks',
                'learning_admin_audit', 'gem_topup_receipts', 'toeic_exams', 'toeic_attempts',
                'toeic_lesson_progress', 'toeic_notes', 'toeic_media', 'dictation_audio',
                'dictation_exercises', 'dictation_revisions', 'dictation_attempts', 'dictation_responses',
                'dictation_workbook_imports', 'dictation_workbook_sync', 'dictation_workbook_sources'))
            OR (table_schema = 'payment_db' AND table_name IN (
                'pro_plans', 'orders', 'order_items', 'payments', 'payment_transactions', 'payment_admin_audit'))
            OR (table_schema = 'ai_db' AND table_name IN (
                'ai_conversations', 'ai_messages', 'ai_usage_logs', 'ai_daily_usage'))
        )) <> 71 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'All 71 InnoDB tables across 5 databases are required';
    END IF;

    -- Ensure required system baseline rows exist (idempotent for standalone & post-Flyway runs).
    INSERT IGNORE INTO auth_db.roles (name, label, description, system_role) VALUES
    ('USER', 'Học viên', 'Học tập và quản lý tài khoản cá nhân', TRUE),
    ('ADMIN', 'Quản trị viên', 'Toàn quyền quản trị hệ thống', TRUE);
    INSERT IGNORE INTO auth_db.permissions (code) VALUES
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
    INSERT IGNORE INTO auth_db.role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM auth_db.roles r
CROSS JOIN auth_db.permissions p
WHERE r.name = 'ADMIN';
    INSERT IGNORE INTO learning_db.community_topics (id, code, position) VALUES
    (1, 'learning', 1),
    (2, 'ielts-toeic', 2),
    (3, 'questions', 3),
    (4, 'sharing', 4);
    INSERT IGNORE INTO learning_db.shop_items (code, name_key, item_type, rarity, price, original_price, asset_key, position) VALUES
    ('STREAK_FREEZE', 'Streak freeze', 'FREEZE', 'RARE', 25, NULL, 'freeze', 0),
    ('BACKGROUND_SKY', 'Bầu trời khởi đầu', 'BACKGROUND', 'RARE', 0, 50, 'sky', 1),
    ('BACKGROUND_CAMPUS', 'Hẹn gặp ở giảng đường', 'BACKGROUND', 'EPIC', 100, NULL, 'campus-sunrise', 2),
    ('BACKGROUND_LIBRARY', 'Thư viện ánh trăng', 'BACKGROUND', 'EPIC', 120, NULL, 'moonlit-library', 3),
    ('FRAME_CLASSIC', 'Vòng sáng khởi đầu', 'FRAME', 'RARE', 0, 30, 'classic', 4),
    ('FRAME_KITTY', 'Mèo nhỏ chăm học', 'FRAME', 'EPIC', 150, NULL, 'kitty-scholar', 5),
    ('FRAME_KOALA', 'Koala vườn xanh', 'FRAME', 'EPIC', 180, NULL, 'koala-garden', 6),
    ('FRAME_OWL', 'Cú mèo phù thủy', 'FRAME', 'EPIC', 250, NULL, 'owl-wizard', 7),
    ('FRAME_BUNNY', 'Thỏ hoa anh đào', 'FRAME', 'EPIC', 180, NULL, 'bunny-bloom', 8);
    INSERT IGNORE INTO learning_db.engagement_settings (id, lesson_xp, quiz_xp, daily_gems, xp_per_level) VALUES
    (1, 20, 10, 25, 100);
    INSERT IGNORE INTO learning_db.engagement_reward_rules (code, label, metric, threshold, gems) VALUES
    ('FIRST_LESSON', 'Bài học đầu tiên', 'FIRST_LESSON', 1, 20),
    ('STREAK_3', 'Chuỗi 3 ngày', 'STREAK', 3, 30),
    ('STREAK_7', 'Chuỗi 7 ngày', 'STREAK', 7, 70),
    ('STREAK_30', 'Chuỗi 30 ngày', 'STREAK', 30, 300),
    ('LEVEL_5', 'Đạt cấp độ 5', 'LEVEL', 5, 100);
    INSERT IGNORE INTO payment_db.pro_plans (code, name, duration_months, price) VALUES
    ('PRO_MONTH', 'ChitChatGo Pro · 1 tháng', 1, 50000),
    ('PRO_QUARTER', 'ChitChatGo Pro · 3 tháng', 3, 120000),
    ('PRO_YEAR', 'ChitChatGo Pro · 1 năm', 12, 499000);

    IF (SELECT COUNT(*) FROM auth_db.roles WHERE name IN ('USER', 'ADMIN')) <> 2 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Auth migration must provide USER and ADMIN roles';
    END IF;
    IF EXISTS (SELECT 1 FROM auth_db.users WHERE email IN ('admin@gmail.com', 'user@gmail.com') AND deleted_at IS NOT NULL) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A requested seed account was deleted; restore it explicitly before seeding';
    END IF;

    -- =========================================================================
    -- 1. AUTH_DB
    -- =========================================================================
    SET @seed_admin_changed = EXISTS (SELECT 1 FROM auth_db.users WHERE email = 'admin@gmail.com' AND NOT (password_hash <=> '$2a$10$DNTIsYdZXkpNP96Im8d.CuGqysyIBjQ6Hyo1tkZIJEDuRZ/ApCDdS'));
    SET @seed_user_changed = EXISTS (SELECT 1 FROM auth_db.users WHERE email = 'user@gmail.com' AND NOT (password_hash <=> '$2a$10$cJZdoW.57vF4D7FmcHfat.e5fDZQ5FjIUFz0MjnR1RKtpwRHEiaM2'));

    INSERT INTO auth_db.users (email, password_hash, full_name, status, last_login_at, phone, date_of_birth, biography, created_at, updated_at) VALUES
    ('admin@gmail.com', '$2a$10$DNTIsYdZXkpNP96Im8d.CuGqysyIBjQ6Hyo1tkZIJEDuRZ/ApCDdS', 'System Administrator', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 1 HOUR), '0901000001', '1992-05-15', 'Quản trị viên nền tảng học tiếng Anh ChitChatGo.', NOW(6), NOW(6)),
    ('user@gmail.com', '$2a$10$cJZdoW.57vF4D7FmcHfat.e5fDZQ5FjIUFz0MjnR1RKtpwRHEiaM2', 'Nguyễn Văn A', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 2 HOUR), '0901000002', '1999-08-20', 'Học viên mục tiêu IELTS 7.5+ để du học thạc sĩ.', NOW(6), NOW(6)),
    ('tran.thi.b@elearning.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Trần Thị B', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 3 HOUR), '0901000003', '2000-03-11', 'Sinh viên năm cuối ôn thi TOEIC 850+ chuẩn bị ra trường.', NOW(6), NOW(6)),
    ('le.van.c@elearning.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Lê Văn C', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 4 HOUR), '0901000004', '1997-11-04', 'Nhân viên kinh doanh luyện giao tiếp phản xạ đi làm.', NOW(6), NOW(6)),
    ('pham.thi.d@elearning.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Phạm Thị D', 'LOCKED', NULL, '0901000005', '1998-06-29', 'Tài khoản mẫu trạng thái LOCKED phục vụ kiểm thử.', NOW(6), NOW(6)),
    ('hoang.van.e@elearning.com', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Hoàng Văn E', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 6 HOUR), '0901000006', '1996-01-19', 'Kỹ sư phần mềm backend luyện tiếng Anh công nghệ và họp Scrum.', NOW(6), NOW(6)),
    ('nguyen.minh.khoi@chitchatgo.vn', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Nguyễn Minh Khôi', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 7 HOUR), '0902110007', '2001-04-12', 'Đang chuẩn hóa phát âm 44 âm IPA và luyện nghe chép chính tả.', NOW(6), NOW(6)),
    ('vo.thao.vy@chitchatgo.vn', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Võ Thảo Vy', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 8 HOUR), '0902110008', '1999-09-25', 'Chuyên viên marketing nâng cao kỹ năng IELTS Writing & Email.', NOW(6), NOW(6)),
    ('dang.quoc.bao@chitchatgo.vn', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Đặng Quốc Bảo', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 9 HOUR), '0902110009', '1995-12-08', 'Quản lý dự án luyện thuyết trình thương mại và đàm phán.', NOW(6), NOW(6)),
    ('bui.ngoc.han@chitchatgo.vn', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Bùi Ngọc Hân', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 10 HOUR), '0902110010', '2002-02-14', 'Sinh viên kinh tế luyện đọc báo tài chính và TOEIC 4 kỹ năng.', NOW(6), NOW(6)),
    ('do.gia.huy@chitchatgo.vn', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Đỗ Gia Huy', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 11 HOUR), '0902110011', '1998-07-03', 'Frontend developer luyện phỏng vấn tiếng Anh và CV chuẩn ATS.', NOW(6), NOW(6)),
    ('ngo.khanh.linh@chitchatgo.vn', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Ngô Khánh Linh', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 12 HOUR), '0902110012', '2000-10-18', 'Ôn thi IELTS Speaking tự nhiên hướng tới Band 7.5.', NOW(6), NOW(6)),
    ('duong.tuan.kiet@chitchatgo.vn', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Dương Tuấn Kiệt', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 13 HOUR), '0902110013', '1997-05-27', 'Bắt đầu lấy lại gốc ngữ pháp và từ vựng tiếng Anh từ A1.', NOW(6), NOW(6)),
    ('ly.thanh.truc@chitchatgo.vn', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Lý Thanh Trúc', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 14 HOUR), '0902110014', '2001-11-30', 'Chuẩn bị hồ sơ du học châu Âu và viết Statement of Purpose.', NOW(6), NOW(6)),
    ('truong.hoang.nam@chitchatgo.vn', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Trương Hoàng Nam', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 15 HOUR), '0902110015', '1994-03-09', 'Chuyên gia phân tích dữ liệu luyện tiếng Anh công sở & du lịch.', NOW(6), NOW(6)),
    ('phan.my.duyen@chitchatgo.vn', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Phan Mỹ Duyên', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 16 HOUR), '0902110016', '2002-08-06', 'Luyện nghe Dictation mỗi tối và duy trì chuỗi học 20 ngày.', NOW(6), NOW(6)),
    ('vu.duc.thinh@chitchatgo.vn', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Vũ Đức Thịnh', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 17 HOUR), '0902110017', '1996-09-14', 'Kỹ sư DevOps học tiếng Anh kỹ thuật và đọc tài liệu cloud.', NOW(6), NOW(6)),
    ('dinh.lan.anh@chitchatgo.vn', '$2a$10$BmndrETEUE.tG5mpDTv/lu/aWzR6B9DeJV4dlJellCpgv3ITjyfMm', 'Đinh Lan Anh', 'ACTIVE', DATE_SUB('2026-10-20 09:00:00', INTERVAL 18 HOUR), '0902110018', '1999-01-22', 'Chuyên viên nhân sự luyện viết email và phỏng vấn quốc tế.', NOW(6), NOW(6))
    ON DUPLICATE KEY UPDATE
        credential_version = credential_version + IF(email IN ('admin@gmail.com', 'user@gmail.com') AND NOT (password_hash <=> VALUES(password_hash)), 1, 0),
        password_hash = IF(email IN ('admin@gmail.com', 'user@gmail.com'), VALUES(password_hash), password_hash),
        status = IF(email IN ('admin@gmail.com', 'user@gmail.com'), 'ACTIVE', status);

    SET @seed_u01 = (SELECT id FROM auth_db.users WHERE email = 'admin@gmail.com');
    SET @seed_u02 = (SELECT id FROM auth_db.users WHERE email = 'user@gmail.com');
    SET @seed_u03 = (SELECT id FROM auth_db.users WHERE email = 'tran.thi.b@elearning.com');
    SET @seed_u04 = (SELECT id FROM auth_db.users WHERE email = 'le.van.c@elearning.com');
    SET @seed_u05 = (SELECT id FROM auth_db.users WHERE email = 'pham.thi.d@elearning.com');
    SET @seed_u06 = (SELECT id FROM auth_db.users WHERE email = 'hoang.van.e@elearning.com');
    SET @seed_u07 = (SELECT id FROM auth_db.users WHERE email = 'nguyen.minh.khoi@chitchatgo.vn');
    SET @seed_u08 = (SELECT id FROM auth_db.users WHERE email = 'vo.thao.vy@chitchatgo.vn');
    SET @seed_u09 = (SELECT id FROM auth_db.users WHERE email = 'dang.quoc.bao@chitchatgo.vn');
    SET @seed_u10 = (SELECT id FROM auth_db.users WHERE email = 'bui.ngoc.han@chitchatgo.vn');
    SET @seed_u11 = (SELECT id FROM auth_db.users WHERE email = 'do.gia.huy@chitchatgo.vn');
    SET @seed_u12 = (SELECT id FROM auth_db.users WHERE email = 'ngo.khanh.linh@chitchatgo.vn');
    SET @seed_u13 = (SELECT id FROM auth_db.users WHERE email = 'duong.tuan.kiet@chitchatgo.vn');
    SET @seed_u14 = (SELECT id FROM auth_db.users WHERE email = 'ly.thanh.truc@chitchatgo.vn');
    SET @seed_u15 = (SELECT id FROM auth_db.users WHERE email = 'truong.hoang.nam@chitchatgo.vn');
    SET @seed_u16 = (SELECT id FROM auth_db.users WHERE email = 'phan.my.duyen@chitchatgo.vn');
    SET @seed_u17 = (SELECT id FROM auth_db.users WHERE email = 'vu.duc.thinh@chitchatgo.vn');
    SET @seed_u18 = (SELECT id FROM auth_db.users WHERE email = 'dinh.lan.anh@chitchatgo.vn');

    INSERT INTO auth_db.user_roles (user_id, role_id)
    SELECT u.id, r.id FROM auth_db.users u JOIN auth_db.roles r
        ON r.name = 'USER' OR (u.email = 'admin@gmail.com' AND r.name = 'ADMIN')
    WHERE u.id IN (@seed_u01, @seed_u02, @seed_u03, @seed_u04, @seed_u05, @seed_u06, @seed_u07, @seed_u08, @seed_u09, @seed_u10, @seed_u11, @seed_u12, @seed_u13, @seed_u14, @seed_u15, @seed_u16, @seed_u17, @seed_u18)
        AND NOT EXISTS (SELECT 1 FROM auth_db.user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id);

    UPDATE auth_db.refresh_tokens SET revoked_at = NOW(6)
    WHERE revoked_at IS NULL AND ((user_id = @seed_u01 AND @seed_admin_changed)
        OR (user_id = @seed_u02 AND @seed_user_changed));

    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u01, SHA2('chitchatgo-seed-refresh-1', 256), SHA2('chitchatgo-seed-refresh-1', 256), TRUE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-1', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u02, SHA2('chitchatgo-seed-refresh-2', 256), SHA2('chitchatgo-seed-refresh-2', 256), FALSE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-2', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u03, SHA2('chitchatgo-seed-refresh-3', 256), SHA2('chitchatgo-seed-refresh-3', 256), TRUE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-3', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u04, SHA2('chitchatgo-seed-refresh-4', 256), SHA2('chitchatgo-seed-refresh-4', 256), FALSE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-4', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u05, SHA2('chitchatgo-seed-refresh-5', 256), SHA2('chitchatgo-seed-refresh-5', 256), TRUE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-5', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u06, SHA2('chitchatgo-seed-refresh-6', 256), SHA2('chitchatgo-seed-refresh-6', 256), FALSE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-6', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u07, SHA2('chitchatgo-seed-refresh-7', 256), SHA2('chitchatgo-seed-refresh-7', 256), TRUE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-7', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u08, SHA2('chitchatgo-seed-refresh-8', 256), SHA2('chitchatgo-seed-refresh-8', 256), FALSE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-8', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u09, SHA2('chitchatgo-seed-refresh-9', 256), SHA2('chitchatgo-seed-refresh-9', 256), TRUE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-9', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u10, SHA2('chitchatgo-seed-refresh-10', 256), SHA2('chitchatgo-seed-refresh-10', 256), FALSE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-10', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u11, SHA2('chitchatgo-seed-refresh-11', 256), SHA2('chitchatgo-seed-refresh-11', 256), TRUE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-11', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u12, SHA2('chitchatgo-seed-refresh-12', 256), SHA2('chitchatgo-seed-refresh-12', 256), FALSE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-12', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u13, SHA2('chitchatgo-seed-refresh-13', 256), SHA2('chitchatgo-seed-refresh-13', 256), TRUE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-13', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u14, SHA2('chitchatgo-seed-refresh-14', 256), SHA2('chitchatgo-seed-refresh-14', 256), FALSE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-14', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u15, SHA2('chitchatgo-seed-refresh-15', 256), SHA2('chitchatgo-seed-refresh-15', 256), TRUE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-15', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u16, SHA2('chitchatgo-seed-refresh-16', 256), SHA2('chitchatgo-seed-refresh-16', 256), FALSE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-16', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u17, SHA2('chitchatgo-seed-refresh-17', 256), SHA2('chitchatgo-seed-refresh-17', 256), TRUE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-17', 256));
    INSERT INTO auth_db.refresh_tokens (user_id, token_hash, session_id, persistent, expires_at, revoked_at, created_at)
    SELECT @seed_u18, SHA2('chitchatgo-seed-refresh-18', 256), SHA2('chitchatgo-seed-refresh-18', 256), FALSE, '2025-01-02 08:00:00', '2025-01-01 08:00:00', '2025-01-01 08:00:00'
    WHERE NOT EXISTS (SELECT 1 FROM auth_db.refresh_tokens WHERE token_hash = SHA2('chitchatgo-seed-refresh-18', 256));

    INSERT INTO auth_db.admin_audit_logs (id, actor_id, action, target, description, created_at) VALUES
    (1, @seed_u01, 'USER_STATUS_UPDATE', 'user:pham.thi.d@elearning.com', 'Khóa tạm thời tài khoản mẫu phục vụ kiểm thử bảo mật.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (2, @seed_u01, 'ROLE_VIEW', 'role:ADMIN', 'Kiểm tra danh sách 54 quyền RBAC của vai trò quản trị viên.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (3, @seed_u01, 'COURSE_PUBLISH', 'course:1', 'Xuất bản khóa học IELTS Masterclass 7.5+ Toàn Diện.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (4, @seed_u01, 'COURSE_PUBLISH', 'course:2', 'Xuất bản khóa học TOEIC Đột Phá 850+ Cấp Tốc.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (5, @seed_u01, 'COURSE_PUBLISH', 'course:4', 'Xuất bản khóa học English for Software Engineers & IT.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (6, @seed_u01, 'COURSE_PUBLISH', 'course:6', 'Xuất bản khóa học Chuẩn Hóa Phát Âm 44 Âm IPA Trong 30 Ngày.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (7, @seed_u01, 'COURSE_PUBLISH', 'course:7', 'Xuất bản khóa học IELTS Writing Task 1 & 2 Band 7.0+.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (8, @seed_u01, 'COURSE_PUBLISH', 'course:8', 'Xuất bản khóa học IELTS Speaking Thực Chiến.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (9, @seed_u01, 'COURSE_PUBLISH', 'course:10', 'Xuất bản khóa học Viết Email & Thuyết Trình Thương Mại Quốc Tế.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (10, @seed_u01, 'COURSE_PUBLISH', 'course:13', 'Xuất bản khóa học Chinh Phục Phỏng Vấn Tiếng Anh & CV ATS.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (11, @seed_u01, 'CATEGORY_CREATE', 'category:6', 'Tạo danh mục Phát âm chuẩn IPA & Ngữ điệu.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (12, @seed_u01, 'CATEGORY_CREATE', 'category:12', 'Tạo danh mục Tiếng Anh Phỏng vấn & CV Quốc tế.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (13, @seed_u01, 'PRO_PLAN_UPDATE', 'plan:PRO_YEAR', 'Xác nhận giá niêm yết gói ChitChatGo Pro 1 năm (499.000 VND).', DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    (14, @seed_u01, 'SHOP_CREATE', 'item:FRAME_STAR_SCHOLAR', 'Bổ sung khung avatar Học giả ánh sao vào cửa hàng Gems.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (15, @seed_u01, 'COMMUNITY_MODERATE', 'post:18', 'Ghim bài viết lập nhóm tự học TOEIC 850+ cuối tuần.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY)),
    (16, @seed_u01, 'SYSTEM_AUDIT', 'system:auth', 'Rà soát phiên đăng nhập hết hạn và giới hạn đặt lại mật khẩu.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE description = VALUES(description);

    INSERT INTO auth_db.user_external_identities (id, user_id, provider, provider_subject, email, linked_at) VALUES
    (1, @seed_u04, 'GOOGLE', CAST('seed-google-oidc-sub-001' AS BINARY), 'le.van.c@elearning.com', DATE_SUB('2026-10-15 08:00:00', INTERVAL 15 DAY)),
    (2, @seed_u05, 'GOOGLE', CAST('seed-google-oidc-sub-002' AS BINARY), 'pham.thi.d@elearning.com', DATE_SUB('2026-10-15 08:00:00', INTERVAL 14 DAY)),
    (3, @seed_u06, 'GOOGLE', CAST('seed-google-oidc-sub-003' AS BINARY), 'hoang.van.e@elearning.com', DATE_SUB('2026-10-15 08:00:00', INTERVAL 13 DAY)),
    (4, @seed_u07, 'GOOGLE', CAST('seed-google-oidc-sub-004' AS BINARY), 'nguyen.minh.khoi@chitchatgo.vn', DATE_SUB('2026-10-15 08:00:00', INTERVAL 12 DAY)),
    (5, @seed_u08, 'GOOGLE', CAST('seed-google-oidc-sub-005' AS BINARY), 'vo.thao.vy@chitchatgo.vn', DATE_SUB('2026-10-15 08:00:00', INTERVAL 11 DAY)),
    (6, @seed_u09, 'GOOGLE', CAST('seed-google-oidc-sub-006' AS BINARY), 'dang.quoc.bao@chitchatgo.vn', DATE_SUB('2026-10-15 08:00:00', INTERVAL 10 DAY)),
    (7, @seed_u10, 'GOOGLE', CAST('seed-google-oidc-sub-007' AS BINARY), 'bui.ngoc.han@chitchatgo.vn', DATE_SUB('2026-10-15 08:00:00', INTERVAL 9 DAY)),
    (8, @seed_u11, 'GOOGLE', CAST('seed-google-oidc-sub-008' AS BINARY), 'do.gia.huy@chitchatgo.vn', DATE_SUB('2026-10-15 08:00:00', INTERVAL 8 DAY)),
    (9, @seed_u12, 'GOOGLE', CAST('seed-google-oidc-sub-009' AS BINARY), 'ngo.khanh.linh@chitchatgo.vn', DATE_SUB('2026-10-15 08:00:00', INTERVAL 7 DAY)),
    (10, @seed_u13, 'GOOGLE', CAST('seed-google-oidc-sub-010' AS BINARY), 'duong.tuan.kiet@chitchatgo.vn', DATE_SUB('2026-10-15 08:00:00', INTERVAL 6 DAY)),
    (11, @seed_u14, 'GOOGLE', CAST('seed-google-oidc-sub-011' AS BINARY), 'ly.thanh.truc@chitchatgo.vn', DATE_SUB('2026-10-15 08:00:00', INTERVAL 5 DAY)),
    (12, @seed_u15, 'GOOGLE', CAST('seed-google-oidc-sub-012' AS BINARY), 'truong.hoang.nam@chitchatgo.vn', DATE_SUB('2026-10-15 08:00:00', INTERVAL 4 DAY)),
    (13, @seed_u16, 'GOOGLE', CAST('seed-google-oidc-sub-013' AS BINARY), 'phan.my.duyen@chitchatgo.vn', DATE_SUB('2026-10-15 08:00:00', INTERVAL 3 DAY)),
    (14, @seed_u17, 'GOOGLE', CAST('seed-google-oidc-sub-014' AS BINARY), 'vu.duc.thinh@chitchatgo.vn', DATE_SUB('2026-10-15 08:00:00', INTERVAL 2 DAY)),
    (15, @seed_u18, 'GOOGLE', CAST('seed-google-oidc-sub-015' AS BINARY), 'dinh.lan.anh@chitchatgo.vn', DATE_SUB('2026-10-15 08:00:00', INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE email = VALUES(email);

    INSERT INTO auth_db.google_link_intents (intent_hash, user_id, session_id, browser_challenge, credential_version, expires_at) VALUES
    ('6303448d240e1483a49281cf345af44339bbf2d2fda4b17bb38ed71d28b6d7f7', @seed_u04, '52d75c10829660e6ee2ca5d95b5b5d416a1be1f6dac3b2d5b2bafb7facf3cca8', 'seedChallengeCode00000000000000000000000001', 0, '2025-01-02 08:00:00'),
    ('a5296783c2397059826e83e2a3efec6553937d3defcadf0c8e607069216c86be', @seed_u05, '78156fef269f247da97bc1f24a8e08725be6cf8a43eddf911be0ed58a0091856', 'seedChallengeCode00000000000000000000000002', 0, '2025-01-02 08:00:00'),
    ('2dbad8c04d2ef3ff39e682185a54c3a42341238de7dae38d5c354d425856866a', @seed_u06, 'd939c97af78f882def4ef2e7e893514e161321ba00749aa25637b621d8228f84', 'seedChallengeCode00000000000000000000000003', 0, '2025-01-02 08:00:00'),
    ('62f42e84a1463fdeca4d534dc0b93c2512cbd2195a9699698caf5b9789cf993c', @seed_u07, '68b5e7d699d18d9102da380c7af0842fa9214800bc1a7215e149aba198283223', 'seedChallengeCode00000000000000000000000004', 0, '2025-01-02 08:00:00'),
    ('605a2298270fa46077ffed0d445f8994f88d1f5b46447ada484cbda4978deb02', @seed_u08, 'a5484389cd456d197d4ecb5166600838eceb8bcf82b570d769edeaa845da7a9c', 'seedChallengeCode00000000000000000000000005', 0, '2025-01-02 08:00:00'),
    ('382fdf35ba95c3a345eed589115571fc6f717409582f152f9c9be0a26d33e910', @seed_u09, 'd5541ab32c81932185f75ff5ee1999c54e185b7c191451b680a89955b584a968', 'seedChallengeCode00000000000000000000000006', 0, '2025-01-02 08:00:00'),
    ('3d3fdbcc4cc10f49bb35d780467ac473a407e1cb3ab587d17720e6d6bfb66f68', @seed_u10, '9d8248942cad3d1868d09186897d74a7dea9c42aef5097ab9a60111ca6c91282', 'seedChallengeCode00000000000000000000000007', 0, '2025-01-02 08:00:00'),
    ('92f8806207312bd295b9ef7d251a8e81efc06fd0e1e64eaa2968bc713d5b908f', @seed_u11, 'ea2866a3a2846879c9510cca6366de349a09ece4e2483eec727b3ad38efe3180', 'seedChallengeCode00000000000000000000000008', 0, '2025-01-02 08:00:00'),
    ('1a6a747d78a21aa822801770f35f006de221e1b416434d0a8cdb061126f7ef65', @seed_u12, '1da047f7e32001ddf676249383d2a5744248c927fa56343f8323bf0e568592dc', 'seedChallengeCode00000000000000000000000009', 0, '2025-01-02 08:00:00'),
    ('6e3bda45e90278a9e7f86fc2225c1e85341fb93a12f0b3919aa6f96fd8e4e619', @seed_u13, 'b3346ac628adb9f2a86f71b41c568f6a78f931a21029183971eb978ae514c698', 'seedChallengeCode00000000000000000000000010', 0, '2025-01-02 08:00:00'),
    ('b3b1f4887276de63118fd50318bc8f58f33fcf2559880acce8f2b71e0c41d3af', @seed_u14, '0423dccf791935939e86fe2e8106b3ad54735f94618cdfd3f2cf607c3703b220', 'seedChallengeCode00000000000000000000000011', 0, '2025-01-02 08:00:00'),
    ('96791edf172eeaf18308ce97936013ee62efd1ff224147658985ffc119b51063', @seed_u15, '8088fefeb7d1e43725520aadd0fef85f7d376684737dab3662375c155c2809cd', 'seedChallengeCode00000000000000000000000012', 0, '2025-01-02 08:00:00'),
    ('e46b2c24600016dedd82b77c197f5ddb429d3c6df0658cd67ef62b41ed89069f', @seed_u16, '65ee6de0b710596940e3da5ad9f9340da2618975691a8e209ec3abf6c6cb795c', 'seedChallengeCode00000000000000000000000013', 0, '2025-01-02 08:00:00'),
    ('347733c9df8e8b261325b22db8589f841161fe3263325082699728a33c22109a', @seed_u17, 'f3cb7875eaa8beabd04be411c4bb2863aacc7fa57e48c335d7846cfb3ff17435', 'seedChallengeCode00000000000000000000000014', 0, '2025-01-02 08:00:00'),
    ('0cbfe5d2600933c480470bd57413c0d91bea8666292145fa0746f6c256a64366', @seed_u18, 'd9816f66171a023d4bc6db137f6a5f96e4962842f943b075ad64f8e9e4bfb88f', 'seedChallengeCode00000000000000000000000015', 0, '2025-01-02 08:00:00')
    ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at);

    INSERT INTO auth_db.oauth_login_codes (code_hash, browser_challenge, user_id, expires_at, purpose, link_intent_hash, provider_subject, provider_email) VALUES
    ('1cd0c02025365ddd5d7419a020fc56378dc4756935fd4978db31f934e3e98e66', 'seedOauthChallenge0000000000000000000000001', @seed_u04, '2025-01-02 08:00:00', 'LINK', '6303448d240e1483a49281cf345af44339bbf2d2fda4b17bb38ed71d28b6d7f7', CAST('seed-google-oidc-sub-001' AS BINARY), 'le.van.c@elearning.com'),
    ('838d02b095efac2aae1f653328524eb68453dcc520a83a0a037a9e0c9ef73bfa', 'seedOauthChallenge0000000000000000000000002', @seed_u05, '2025-01-02 08:00:00', 'LOGIN', NULL, NULL, NULL),
    ('fc36131d6ccf81eebd56d58c3089f3da113bbdc87223e2f7b378822d1a554fb5', 'seedOauthChallenge0000000000000000000000003', @seed_u06, '2025-01-02 08:00:00', 'LOGIN', NULL, NULL, NULL),
    ('785e784332bd14065108d9f1c35ebe61dc87e720e05b82848500c0461c89bae6', 'seedOauthChallenge0000000000000000000000004', @seed_u07, '2025-01-02 08:00:00', 'LINK', '62f42e84a1463fdeca4d534dc0b93c2512cbd2195a9699698caf5b9789cf993c', CAST('seed-google-oidc-sub-004' AS BINARY), 'nguyen.minh.khoi@chitchatgo.vn'),
    ('8674657f4ba208722e82ae319e43cae030d9fdd98dfebabbd4ee99e8c8fd8ac9', 'seedOauthChallenge0000000000000000000000005', @seed_u08, '2025-01-02 08:00:00', 'LOGIN', NULL, NULL, NULL),
    ('d21a214b9af798592496b7697f2f9033a756c56b16371cc9e06812f5bae1b0f4', 'seedOauthChallenge0000000000000000000000006', @seed_u09, '2025-01-02 08:00:00', 'LOGIN', NULL, NULL, NULL),
    ('968ec7b70d3062f5c0e05732ec86058b9ee2b284dec99172e3004e5ac00176aa', 'seedOauthChallenge0000000000000000000000007', @seed_u10, '2025-01-02 08:00:00', 'LINK', '3d3fdbcc4cc10f49bb35d780467ac473a407e1cb3ab587d17720e6d6bfb66f68', CAST('seed-google-oidc-sub-007' AS BINARY), 'bui.ngoc.han@chitchatgo.vn'),
    ('e6581f636e52a04f27b514b8665e34d4072c3ae19555d0c30d1997a7dce8af61', 'seedOauthChallenge0000000000000000000000008', @seed_u11, '2025-01-02 08:00:00', 'LOGIN', NULL, NULL, NULL),
    ('1e8d8fa3bf8e77149e11543351154fe2716eaf0e73b4c50f89c5f1d6ee06331d', 'seedOauthChallenge0000000000000000000000009', @seed_u12, '2025-01-02 08:00:00', 'LOGIN', NULL, NULL, NULL),
    ('55c689f6053d686778501ff5f386a4b3b662126e1a6eb0ccf3f22c3abeab7939', 'seedOauthChallenge0000000000000000000000010', @seed_u13, '2025-01-02 08:00:00', 'LINK', '6e3bda45e90278a9e7f86fc2225c1e85341fb93a12f0b3919aa6f96fd8e4e619', CAST('seed-google-oidc-sub-010' AS BINARY), 'duong.tuan.kiet@chitchatgo.vn'),
    ('cd8bcbdb6ac272e774eb9bd16d7796de5736b9f4bdccf0262ad80a61219d6838', 'seedOauthChallenge0000000000000000000000011', @seed_u14, '2025-01-02 08:00:00', 'LOGIN', NULL, NULL, NULL),
    ('60693b91fa73a967834e3347acd6dbb00c5118fdc065800bf877ce135ad74e38', 'seedOauthChallenge0000000000000000000000012', @seed_u15, '2025-01-02 08:00:00', 'LOGIN', NULL, NULL, NULL),
    ('4b92ac4a0a20637d4c630d60cc4244d94c10ecfcfc70201dceb9c6192a9ba43f', 'seedOauthChallenge0000000000000000000000013', @seed_u16, '2025-01-02 08:00:00', 'LINK', 'e46b2c24600016dedd82b77c197f5ddb429d3c6df0658cd67ef62b41ed89069f', CAST('seed-google-oidc-sub-013' AS BINARY), 'phan.my.duyen@chitchatgo.vn'),
    ('af5f29a0f7e43e4465e995f3b6d2a0f872ea90c0d54bb389d7b4e8349fde0245', 'seedOauthChallenge0000000000000000000000014', @seed_u17, '2025-01-02 08:00:00', 'LOGIN', NULL, NULL, NULL),
    ('d487335f97d73e34de1f476036640704f32ca5c6908709a6e4dc700fdda66d87', 'seedOauthChallenge0000000000000000000000015', @seed_u18, '2025-01-02 08:00:00', 'LOGIN', NULL, NULL, NULL)
    ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at);

    INSERT INTO auth_db.password_reset_tokens (user_id, token_hash, credential_version, expires_at) VALUES
    (@seed_u04, '5e2bddae1bb2b877a3156f47bcc4c5d1dc4192983558c1a35604ab1b53c82727', 0, '2025-01-02 08:00:00'),
    (@seed_u05, '15501b182ee1ba690c2d8fa343b1499e03e9e64a52cb4cdda6216f77b061d918', 0, '2025-01-02 08:00:00'),
    (@seed_u06, '8bd36e929564b6ff7a6f905aa990b4e26f1b9855a8954032a900e0279ac6765c', 0, '2025-01-02 08:00:00'),
    (@seed_u07, 'd6ba6cd29e7d39aa4499c727354510042afb4a881f0b4dceee716065e0f60ef2', 0, '2025-01-02 08:00:00'),
    (@seed_u08, '536635451afd9a1c2146a36fbd0ae191a29135a626e3915178d9df20a67593e0', 0, '2025-01-02 08:00:00'),
    (@seed_u09, 'c92b6752a127f5038c6941eb8a62975cde83cb231959faaceca358035c27a753', 0, '2025-01-02 08:00:00'),
    (@seed_u10, 'a8add597871cb78f2ff356dcc59c0014d780778b80e0752db258e75359228726', 0, '2025-01-02 08:00:00'),
    (@seed_u11, '4d4c2a4f40db3ed170d8fd637173925bd59816efadefd8ab3bbb9f4a908d4b14', 0, '2025-01-02 08:00:00'),
    (@seed_u12, '2f94ac69982397ce19953a609ad7c0b529b077a707210fb1719b9837d1f01055', 0, '2025-01-02 08:00:00'),
    (@seed_u13, '3a59088908ffd14ec65645dc83603097d65099239a3360224fbde20166f6f7ea', 0, '2025-01-02 08:00:00'),
    (@seed_u14, 'ac4cd6fd18f8f1fbcfab32cd2f5a48de2f8a94370f4ceb299b4e1157f291ef00', 0, '2025-01-02 08:00:00'),
    (@seed_u15, 'c6a46db3e3a846de46b98c67ab971ca9056e82bcff5fc74def998201d53df08a', 0, '2025-01-02 08:00:00'),
    (@seed_u16, '9cffc87a0c3c3184fbe7ac9b7bae35b92b5941ea5b7af44504de919d617d5d67', 0, '2025-01-02 08:00:00'),
    (@seed_u17, 'ff950fba3679d912c1d3af1bace7eafe4218c10bc5554c9f15c5e515d05b8a5c', 0, '2025-01-02 08:00:00'),
    (@seed_u18, '0529f6360a2f41d4be00dc435ba2d8331f9b2075d00a1d85fadbc923962cd3d0', 0, '2025-01-02 08:00:00')
    ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at);

    INSERT INTO auth_db.password_reset_rate_limits (bucket_key, window_start, last_requested_at, request_count) VALUES
    ('f11960c5ab3b0700269e62c130a040af32ad8040c6a1b9ccd873c647b8573243', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 1),
    ('2c3d98b9d92b3962f411260aa3156487efa1f9b08b96c7f1a74441e576feceee', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 2),
    ('98387fd4dce4b060c631635fbda348bfeb40976b54e18107a444a055223c70f5', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 3),
    ('593b10532c5a942897e236ed7924b50f81de6a2e1a3191a81b5891e23e1fe2cf', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 1),
    ('a055117770c13e0f70cbf227c127e3c6f73482474b7c05970af544ded57e4e53', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 2),
    ('6603475dfb7ffbb55a7b4fdc60aa69bea2fbc7086b367d737dcb96bd867a39e0', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 3),
    ('a9353f0c5416c5b6149baeec0f9d1b0ea7f021e411e5f92fb3de6a084d082b7b', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 1),
    ('2902b94ce772abe592c95292b619aa047e89f3ae33d265aa4e2b154277f09414', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 2),
    ('f02afa4e96f4a43997563d22afafb03e0fe008b3f624c933bd1b4d7d5c1b9704', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 3),
    ('d390ddd8e1beea39a0b037251eaad1d785184bce755a245aae2cc6151f81ef04', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 1),
    ('2d2f27d371a00a18b9c33f1b17afa8f0b86a37611766bd8ba750c13334fafc19', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 2),
    ('b7bddd5e23b7c5ef69b58c65c05ab3fe1947513191293d8aaeaa931d11120fae', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 3),
    ('faa7d0355896a61b7cb542ebd3726a98fe6b44ae670d294f8a20bc3c9727b3af', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 1),
    ('0770f0913d0eedc6def4dca1472b81a761ee30c640085cae96f91bd743de6e64', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 2),
    ('dfa81ac1b45efc2718d8975d51095b282a2952e58a1015d834c524fa6e1f1429', '2025-01-01 08:00:00', '2025-01-01 08:05:00', 3)
    ON DUPLICATE KEY UPDATE request_count = VALUES(request_count);

    -- =========================================================================
    -- 2. COURSE_DB
    -- =========================================================================
    IF EXISTS (SELECT 1 FROM course_db.categories
        WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)
            AND NOT ((id <=> 1 AND slug <=> 'luyen-thi-ielts')
                OR (id <=> 2 AND slug <=> 'luyen-thi-toeic')
                OR (id <=> 3 AND slug <=> 'tieng-anh-giao-tiep')
                OR (id <=> 4 AND slug <=> 'tieng-anh-it')
                OR (id <=> 5 AND slug <=> 'ngu-phap-tu-vung')
                OR (id <=> 6 AND slug <=> 'phat-am-ipa-ngu-dieu')
                OR (id <=> 7 AND slug <=> 'tieng-anh-thuong-mai')
                OR (id <=> 8 AND slug <=> 'ielts-writing-chuyen-sau')
                OR (id <=> 9 AND slug <=> 'ielts-speaking-phan-xa')
                OR (id <=> 10 AND slug <=> 'nghe-chep-chinh-ta')
                OR (id <=> 11 AND slug <=> 'doc-hieu-hoc-thuat')
                OR (id <=> 12 AND slug <=> 'tieng-anh-phong-van-cv')
                OR (id <=> 13 AND slug <=> 'tieng-anh-du-lich-doi-song')
                OR (id <=> 14 AND slug <=> 'tieng-anh-du-hoc-hoc-bong')
                OR (id <=> 15 AND slug <=> 'tieng-anh-nguoi-moi-bat-dau'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in course_db.categories; no data was changed';
    END IF;

    IF EXISTS (SELECT 1 FROM course_db.categories WHERE (name <=> 'Luyện thi IELTS' AND id <> 1)
        OR (name <=> 'Luyện thi TOEIC' AND id <> 2)
        OR (name <=> 'Tiếng Anh Giao tiếp' AND id <> 3)
        OR (name <=> 'Tiếng Anh Công nghệ (IT)' AND id <> 4)
        OR (name <=> 'Ngữ pháp & Từ vựng căn bản' AND id <> 5)
        OR (name <=> 'Phát âm chuẩn IPA & Ngữ điệu' AND id <> 6)
        OR (name <=> 'Tiếng Anh Thương mại & Công sở' AND id <> 7)
        OR (name <=> 'IELTS Writing Chuyên sâu' AND id <> 8)
        OR (name <=> 'IELTS Speaking Phản xạ' AND id <> 9)
        OR (name <=> 'Nghe chép chính tả & Nghe hiểu' AND id <> 10)
        OR (name <=> 'Đọc hiểu Học thuật & Báo chí' AND id <> 11)
        OR (name <=> 'Tiếng Anh Phỏng vấn & CV Quốc tế' AND id <> 12)
        OR (name <=> 'Tiếng Anh Du lịch & Đời sống' AND id <> 13)
        OR (name <=> 'Tiếng Anh Du học & Học bổng' AND id <> 14)
        OR (name <=> 'Tiếng Anh cho Người mới bắt đầu' AND id <> 15)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed natural key collision in course_db.categories; no data was changed';
    END IF;

    IF EXISTS (SELECT 1 FROM course_db.categories WHERE (slug <=> 'luyen-thi-ielts' AND id <> 1)
        OR (slug <=> 'luyen-thi-toeic' AND id <> 2)
        OR (slug <=> 'tieng-anh-giao-tiep' AND id <> 3)
        OR (slug <=> 'tieng-anh-it' AND id <> 4)
        OR (slug <=> 'ngu-phap-tu-vung' AND id <> 5)
        OR (slug <=> 'phat-am-ipa-ngu-dieu' AND id <> 6)
        OR (slug <=> 'tieng-anh-thuong-mai' AND id <> 7)
        OR (slug <=> 'ielts-writing-chuyen-sau' AND id <> 8)
        OR (slug <=> 'ielts-speaking-phan-xa' AND id <> 9)
        OR (slug <=> 'nghe-chep-chinh-ta' AND id <> 10)
        OR (slug <=> 'doc-hieu-hoc-thuat' AND id <> 11)
        OR (slug <=> 'tieng-anh-phong-van-cv' AND id <> 12)
        OR (slug <=> 'tieng-anh-du-lich-doi-song' AND id <> 13)
        OR (slug <=> 'tieng-anh-du-hoc-hoc-bong' AND id <> 14)
        OR (slug <=> 'tieng-anh-nguoi-moi-bat-dau' AND id <> 15)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed natural key collision in course_db.categories; no data was changed';
    END IF;

    INSERT INTO course_db.categories (id, name, slug, description, active, created_at, updated_at) VALUES
    (1, 'Luyện thi IELTS', 'luyen-thi-ielts', 'Các khóa học luyện thi IELTS toàn diện 4 kỹ năng từ nền tảng đến mục tiêu 7.5+.', TRUE, NOW(6), NOW(6)),
    (2, 'Luyện thi TOEIC', 'luyen-thi-toeic', 'Lộ trình bứt phá mục tiêu TOEIC 650+ đến 850+ cho sinh viên và người đi làm.', TRUE, NOW(6), NOW(6)),
    (3, 'Tiếng Anh Giao tiếp', 'tieng-anh-giao-tiep', 'Phản xạ tiếng Anh tự nhiên, giao tiếp tự tin trong đời sống và môi trường làm việc.', TRUE, NOW(6), NOW(6)),
    (4, 'Tiếng Anh Công nghệ (IT)', 'tieng-anh-it', 'Thuật ngữ kỹ thuật, đọc tài liệu API, họp Agile/Scrum và phỏng vấn kỹ sư phần mềm.', TRUE, NOW(6), NOW(6)),
    (5, 'Ngữ pháp & Từ vựng căn bản', 'ngu-phap-tu-vung', 'Hệ thống hóa ngữ pháp cốt lõi, collocations và từ vựng thông dụng xây gốc vững chắc.', TRUE, NOW(6), NOW(6)),
    (6, 'Phát âm chuẩn IPA & Ngữ điệu', 'phat-am-ipa-ngu-dieu', 'Làm chủ 44 âm IPA, trọng âm từ, nối âm và ngữ điệu nói tự nhiên như người bản xứ.', TRUE, NOW(6), NOW(6)),
    (7, 'Tiếng Anh Thương mại & Công sở', 'tieng-anh-thuong-mai', 'Viết email chuyên nghiệp, thuyết trình dự án, đàm phán và điều phối cuộc họp quốc tế.', TRUE, NOW(6), NOW(6)),
    (8, 'IELTS Writing Chuyên sâu', 'ielts-writing-chuyen-sau', 'Chiến lược lập dàn ý, phát triển lập luận chặt chẽ và nâng cấp từ vựng học thuật Task 1 & 2.', TRUE, NOW(6), NOW(6)),
    (9, 'IELTS Speaking Phản xạ', 'ielts-speaking-phan-xa', 'Rèn độ trôi chảy, mở rộng ý tưởng tự nhiên Part 1–3 và xử lý câu hỏi khó không học tủ.', TRUE, NOW(6), NOW(6)),
    (10, 'Nghe chép chính tả & Nghe hiểu', 'nghe-chep-chinh-ta', 'Tăng tốc độ bắt âm, nhận diện nối âm và giảm âm qua phương pháp Dictation & Shadowing.', TRUE, NOW(6), NOW(6)),
    (11, 'Đọc hiểu Học thuật & Báo chí', 'doc-hieu-hoc-thuat', 'Kỹ thuật Skimming, Scanning và phân tích cấu trúc câu phức qua báo kinh tế, khoa học.', TRUE, NOW(6), NOW(6)),
    (12, 'Tiếng Anh Phỏng vấn & CV Quốc tế', 'tieng-anh-phong-van-cv', 'Hoàn thiện CV chuẩn ATS, trả lời phỏng vấn theo mô hình STAR và thương lượng đãi ngộ.', TRUE, NOW(6), NOW(6)),
    (13, 'Tiếng Anh Du lịch & Đời sống', 'tieng-anh-du-lich-doi-song', 'Tình huống giao tiếp thực chiến tại sân bay, khách sạn, nhà hàng và đi công tác nước ngoài.', TRUE, NOW(6), NOW(6)),
    (14, 'Tiếng Anh Du học & Học bổng', 'tieng-anh-du-hoc-hoc-bong', 'Viết Statement of Purpose thuyết phục, thư giới thiệu và kỹ năng học đại học bằng tiếng Anh.', TRUE, NOW(6), NOW(6)),
    (15, 'Tiếng Anh cho Người mới bắt đầu', 'tieng-anh-nguoi-moi-bat-dau', 'Lộ trình từ mất gốc lên A2 bài bản, dễ hiểu, có ví dụ gần gũi và bài tập áp dụng mỗi ngày.', TRUE, NOW(6), NOW(6))
    ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), active = VALUES(active);

    IF EXISTS (SELECT 1 FROM course_db.courses
        WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18)
            AND NOT ((id <=> 1 AND slug <=> 'ielts-masterclass-75')
                OR (id <=> 2 AND slug <=> 'toeic-dot-pha-850')
                OR (id <=> 3 AND slug <=> 'tieng-anh-giao-tiep-di-lam')
                OR (id <=> 4 AND slug <=> 'english-for-software-engineers')
                OR (id <=> 5 AND slug <=> 'ngu-phap-tieng-anh-nen-tang')
                OR (id <=> 6 AND slug <=> 'chuan-hoa-phat-am-44-am-ipa')
                OR (id <=> 7 AND slug <=> 'ielts-writing-tu-duy-band-7')
                OR (id <=> 8 AND slug <=> 'ielts-speaking-thuc-chien')
                OR (id <=> 9 AND slug <=> 'toeic-4-ky-nang-650')
                OR (id <=> 10 AND slug <=> 'viet-email-thuyet-trinh-thuong-mai')
                OR (id <=> 11 AND slug <=> 'luyen-nghe-dictation-shadowing')
                OR (id <=> 12 AND slug <=> 'doc-hieu-bao-kinh-te-hoc-thuat')
                OR (id <=> 13 AND slug <=> 'chinh-phuc-phong-van-cv-ats')
                OR (id <=> 14 AND slug <=> 'tieng-anh-du-lich-cong-tac')
                OR (id <=> 15 AND slug <=> 'ho-so-du-hoc-essay-hoc-bong')
                OR (id <=> 16 AND slug <=> 'khoi-dong-tieng-anh-tu-so-0')
                OR (id <=> 17 AND slug <=> 'tieng-anh-cho-pm-ba')
                OR (id <=> 18 AND slug <=> 'on-tap-toeic-format-cu'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in course_db.courses; no data was changed';
    END IF;

    IF EXISTS (SELECT 1 FROM course_db.courses WHERE (slug <=> 'ielts-masterclass-75' AND id <> 1)
        OR (slug <=> 'toeic-dot-pha-850' AND id <> 2)
        OR (slug <=> 'tieng-anh-giao-tiep-di-lam' AND id <> 3)
        OR (slug <=> 'english-for-software-engineers' AND id <> 4)
        OR (slug <=> 'ngu-phap-tieng-anh-nen-tang' AND id <> 5)
        OR (slug <=> 'chuan-hoa-phat-am-44-am-ipa' AND id <> 6)
        OR (slug <=> 'ielts-writing-tu-duy-band-7' AND id <> 7)
        OR (slug <=> 'ielts-speaking-thuc-chien' AND id <> 8)
        OR (slug <=> 'toeic-4-ky-nang-650' AND id <> 9)
        OR (slug <=> 'viet-email-thuyet-trinh-thuong-mai' AND id <> 10)
        OR (slug <=> 'luyen-nghe-dictation-shadowing' AND id <> 11)
        OR (slug <=> 'doc-hieu-bao-kinh-te-hoc-thuat' AND id <> 12)
        OR (slug <=> 'chinh-phuc-phong-van-cv-ats' AND id <> 13)
        OR (slug <=> 'tieng-anh-du-lich-cong-tac' AND id <> 14)
        OR (slug <=> 'ho-so-du-hoc-essay-hoc-bong' AND id <> 15)
        OR (slug <=> 'khoi-dong-tieng-anh-tu-so-0' AND id <> 16)
        OR (slug <=> 'tieng-anh-cho-pm-ba' AND id <> 17)
        OR (slug <=> 'on-tap-toeic-format-cu' AND id <> 18)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed natural key collision in course_db.courses; no data was changed';
    END IF;

    INSERT INTO course_db.courses (id, title, slug, description, category_id, price, original_price, level, status, thumbnail_url, avg_rating, review_count, created_at, updated_at) VALUES
    (1, 'IELTS Masterclass 7.5+ Toàn Diện', 'ielts-masterclass-75', 'Lộ trình chiến thuật chuyên sâu cả 4 kỹ năng Listening, Reading, Writing và Speaking, giúp học viên tối ưu điểm số đạt IELTS 7.5+ trong 12 tuần với hệ thống đề chuẩn Cambridge.', 1, 1490000.00, 2490000.00, 'ADVANCED', 'PUBLISHED', '/images/english-ielts.jpg', 4.67, 3, NOW(6), NOW(6)),
    (2, 'TOEIC Đột Phá 850+ Cấp Tốc', 'toeic-dot-pha-850', 'Phương pháp luyện nghe hiểu phản xạ Part 1–4 và tối ưu tốc độ xử lý Part 5–7 theo bộ đề ETS mới nhất, giúp rút ngắn thời gian làm bài và chạm mốc 850+.', 2, 990000.00, 1690000.00, 'INTERMEDIATE', 'PUBLISHED', '/images/english-toeic.jpg', 4.67, 3, NOW(6), NOW(6)),
    (3, 'Tiếng Anh Giao Tiếp Phản Xạ Đi Làm', 'tieng-anh-giao-tiep-di-lam', 'Xây dựng phản xạ giao tiếp tự nhiên qua 30 tình huống công sở thực tế: họp nhóm, báo cáo tiến độ, trao đổi với sếp nước ngoài, tiếp khách và thuyết trình ngắn.', 3, 790000.00, 1290000.00, 'BEGINNER', 'PUBLISHED', '/images/english-speaking.jpg', 5, 2, NOW(6), NOW(6)),
    (4, 'English for Software Engineers & IT', 'english-for-software-engineers', 'Thiết kế riêng cho lập trình viên và kỹ sư công nghệ: đọc hiểu RFC/API docs, viết Pull Request description rõ ràng, Daily Stand-up, Code Review và phỏng vấn kỹ thuật.', 4, 890000.00, 1490000.00, 'INTERMEDIATE', 'PUBLISHED', '/images/english-workplace.jpg', 4.67, 3, NOW(6), NOW(6)),
    (5, 'Ngữ Pháp Tiếng Anh Nền Tảng & Ứng Dụng', 'ngu-phap-tieng-anh-nen-tang', 'Khóa học miễn phí chất lượng cao giúp hệ thống hóa toàn bộ 12 thì tiếng Anh, câu bị động, mệnh đề quan hệ và câu điều kiện thông qua ví dụ gần gũi và bài tập phản hồi tức thì.', 5, 0.00, 490000.00, 'BEGINNER', 'PUBLISHED', '/images/english-speaking.jpg', 5, 2, NOW(6), NOW(6)),
    (6, 'Chuẩn Hóa Phát Âm 44 Âm IPA Trong 30 Ngày', 'chuan-hoa-phat-am-44-am-ipa', 'Khắc phục tận gốc lỗi phát âm tiếng Anh của người Việt: phân biệt nguyên âm ngắn/dài, phụ âm cuối (ending sounds), trọng âm từ và ngữ điệu lên xuống tự nhiên.', 6, 490000.00, 890000.00, 'BEGINNER', 'PUBLISHED', '/images/english-speaking.jpg', 5, 2, NOW(6), NOW(6)),
    (7, 'IELTS Writing Task 1 & 2: Tư Duy Lập Luận Band 7.0+', 'ielts-writing-tu-duy-band-7', 'Phân tích chuyên sâu 4 tiêu chí chấm điểm IELTS Writing, cách mô tả biểu đồ sắc bén trong Task 1 và phát triển luận điểm thuyết phục cho 5 dạng bài Task 2.', 8, 1190000.00, 1890000.00, 'ADVANCED', 'PUBLISHED', '/images/english-ielts.jpg', 4.5, 2, NOW(6), NOW(6)),
    (8, 'IELTS Speaking Thực Chiến: Trôi Chảy & Tự Nhiên', 'ielts-speaking-thuc-chien', 'Thoát khỏi tình trạng học thuộc bài mẫu: luyện cách kéo dài câu trả lời Part 1, triển khai Cue Card 2 phút mạch lạc và thảo luận chiều sâu Part 3 đạt Band 7.0+.', 9, 1090000.00, 1690000.00, 'INTERMEDIATE', 'PUBLISHED', '/images/english-ielts.jpg', 5, 2, NOW(6), NOW(6)),
    (9, 'TOEIC 4 Kỹ Năng Cho Người Đi Làm (650+)', 'toeic-4-ky-nang-650', 'Kết hợp luyện Nghe – Đọc nền tảng vững chắc cùng thực hành TOEIC Speaking & Writing theo bối cảnh văn phòng, đáp ứng yêu cầu chuẩn đầu ra doanh nghiệp.', 2, 850000.00, 1390000.00, 'INTERMEDIATE', 'PUBLISHED', '/images/english-toeic.jpg', 4.5, 2, NOW(6), NOW(6)),
    (10, 'Viết Email & Thuyết Trình Thương Mại Quốc Tế', 'viet-email-thuyet-trinh-thuong-mai', 'Nâng tầm tác phong làm việc toàn cầu: soạn thảo email rõ ý, điều chỉnh sắc thái trang trọng, thiết kế mạch thuyết trình thuyết phục và xử lý phần hỏi đáp Q&A.', 7, 690000.00, 1190000.00, 'INTERMEDIATE', 'PUBLISHED', '/images/english-workplace.jpg', 5, 2, NOW(6), NOW(6)),
    (11, 'Luyện Nghe Chép Chính Tả & Shadowing Thực Chiến', 'luyen-nghe-dictation-shadowing', 'Khóa học miễn phí hướng dẫn phương pháp luyện nghe chủ động bằng Dictation và Shadowing, giúp đôi tai quen tốc độ nói tự nhiên của người bản xứ chỉ với 20 phút mỗi ngày.', 10, 0.00, 390000.00, 'BEGINNER', 'PUBLISHED', '/images/english-speaking.jpg', 5, 2, NOW(6), NOW(6)),
    (12, 'Đọc Hiểu Báo Kinh Tế & Tài Liệu Học Thuật', 'doc-hieu-bao-kinh-te-hoc-thuat', 'Rèn kỹ năng đọc nhanh, giải phẫu câu dài nhiều mệnh đề và tích lũy vốn từ vựng học thuật cao cấp qua các bài viết chọn lọc về công nghệ, kinh tế và khoa học.', 11, 590000.00, 990000.00, 'ADVANCED', 'PUBLISHED', '/images/java-book.jpg', 4.5, 2, NOW(6), NOW(6)),
    (13, 'Chinh Phục Phỏng Vấn Tiếng Anh & Viết CV Chuẩn ATS', 'chinh-phuc-phong-van-cv-ats', 'Hướng dẫn từng bước xây dựng CV tiếng Anh vượt qua hệ thống lọc ATS, trả lời 20 câu hỏi phỏng vấn hành vi theo mô hình STAR và đàm phán mức lương tự tin.', 12, 750000.00, 1250000.00, 'INTERMEDIATE', 'PUBLISHED', '/images/english-workplace.jpg', 5, 2, NOW(6), NOW(6)),
    (14, 'Tiếng Anh Giao Tiếp Du Lịch & Công Tác Nước Ngoài', 'tieng-anh-du-lich-cong-tac', 'Trang bị trọn bộ mẫu câu và tình huống thực tế giúp bạn tự tin xuất ngoại: làm thủ tục sân bay, nhận phòng khách sạn, gọi món, hỏi đường và xử lý sự cố hành lý.', 13, 390000.00, 690000.00, 'BEGINNER', 'PUBLISHED', '/images/english-speaking.jpg', 5, 1, NOW(6), NOW(6)),
    (15, 'Hồ Sơ Du Học: Viết Essay & Phỏng Vấn Học Bổng', 'ho-so-du-hoc-essay-hoc-bong', 'Hướng dẫn xây dựng câu chuyện cá nhân khác biệt trong Statement of Purpose (SOP), Personal Statement, email xin giáo sư hướng dẫn và trả lời phỏng vấn học bổng.', 14, 1290000.00, 1990000.00, 'ADVANCED', 'PUBLISHED', '/images/english-ielts.jpg', 5, 1, NOW(6), NOW(6)),
    (16, 'Khởi Động Tiếng Anh Từ Số 0 Lên A2', 'khoi-dong-tieng-anh-tu-so-0', 'Khóa học miễn phí dành cho người mới bắt đầu hoặc mất gốc lâu năm: học cách ghép câu đơn giản, 600 từ vựng thiết yếu nhất và hình thành thói quen học 15 phút mỗi ngày.', 15, 0.00, 450000.00, 'BEGINNER', 'PUBLISHED', '/images/english-speaking.jpg', 5, 1, NOW(6), NOW(6)),
    (17, 'Tiếng Anh Kỹ Thuật Cho Product Manager & BA', 'tieng-anh-cho-pm-ba', 'Khóa học chuyên sâu về viết PRD, User Stories, Acceptance Criteria, thuyết trình Roadmap và phỏng vấn khách hàng quốc tế cho Product Manager & Business Analyst.', 4, 890000.00, 1450000.00, 'INTERMEDIATE', 'DRAFT', '/images/frontend-workspace.jpg', 0, 0, NOW(6), NOW(6)),
    (18, 'Ôn Tập TOEIC Format Cũ (Lưu Trữ)', 'on-tap-toeic-format-cu', 'Bộ tài liệu ôn tập ngữ pháp và từ vựng TOEIC giai đoạn trước, hiện được lưu trữ làm nguồn tham khảo bổ trợ cho kho đề ETS mới.', 2, 490000.00, 790000.00, 'INTERMEDIATE', 'ARCHIVED', '/images/english-toeic.jpg', 0, 0, NOW(6), NOW(6))
    ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), price = VALUES(price), original_price = VALUES(original_price), level = VALUES(level), status = VALUES(status), thumbnail_url = VALUES(thumbnail_url), avg_rating = VALUES(avg_rating), review_count = VALUES(review_count);

    IF EXISTS (SELECT 1 FROM course_db.sections
        WHERE id IN (910001, 910019, 910002, 910020, 910003, 910021, 910004, 910022, 910005, 910023, 910006, 910024, 910007, 910025, 910008, 910026, 910009, 910027, 910010, 910028, 910011, 910029, 910012, 910030, 910013, 910031, 910014, 910032, 910015, 910033, 910016, 910034, 910017, 910035, 910018, 910036)
            AND NOT ((id <=> 910001 AND course_id <=> 1 AND order_index <=> 0)
                OR (id <=> 910019 AND course_id <=> 1 AND order_index <=> 1)
                OR (id <=> 910002 AND course_id <=> 2 AND order_index <=> 0)
                OR (id <=> 910020 AND course_id <=> 2 AND order_index <=> 1)
                OR (id <=> 910003 AND course_id <=> 3 AND order_index <=> 0)
                OR (id <=> 910021 AND course_id <=> 3 AND order_index <=> 1)
                OR (id <=> 910004 AND course_id <=> 4 AND order_index <=> 0)
                OR (id <=> 910022 AND course_id <=> 4 AND order_index <=> 1)
                OR (id <=> 910005 AND course_id <=> 5 AND order_index <=> 0)
                OR (id <=> 910023 AND course_id <=> 5 AND order_index <=> 1)
                OR (id <=> 910006 AND course_id <=> 6 AND order_index <=> 0)
                OR (id <=> 910024 AND course_id <=> 6 AND order_index <=> 1)
                OR (id <=> 910007 AND course_id <=> 7 AND order_index <=> 0)
                OR (id <=> 910025 AND course_id <=> 7 AND order_index <=> 1)
                OR (id <=> 910008 AND course_id <=> 8 AND order_index <=> 0)
                OR (id <=> 910026 AND course_id <=> 8 AND order_index <=> 1)
                OR (id <=> 910009 AND course_id <=> 9 AND order_index <=> 0)
                OR (id <=> 910027 AND course_id <=> 9 AND order_index <=> 1)
                OR (id <=> 910010 AND course_id <=> 10 AND order_index <=> 0)
                OR (id <=> 910028 AND course_id <=> 10 AND order_index <=> 1)
                OR (id <=> 910011 AND course_id <=> 11 AND order_index <=> 0)
                OR (id <=> 910029 AND course_id <=> 11 AND order_index <=> 1)
                OR (id <=> 910012 AND course_id <=> 12 AND order_index <=> 0)
                OR (id <=> 910030 AND course_id <=> 12 AND order_index <=> 1)
                OR (id <=> 910013 AND course_id <=> 13 AND order_index <=> 0)
                OR (id <=> 910031 AND course_id <=> 13 AND order_index <=> 1)
                OR (id <=> 910014 AND course_id <=> 14 AND order_index <=> 0)
                OR (id <=> 910032 AND course_id <=> 14 AND order_index <=> 1)
                OR (id <=> 910015 AND course_id <=> 15 AND order_index <=> 0)
                OR (id <=> 910033 AND course_id <=> 15 AND order_index <=> 1)
                OR (id <=> 910016 AND course_id <=> 16 AND order_index <=> 0)
                OR (id <=> 910034 AND course_id <=> 16 AND order_index <=> 1)
                OR (id <=> 910017 AND course_id <=> 17 AND order_index <=> 0)
                OR (id <=> 910035 AND course_id <=> 17 AND order_index <=> 1)
                OR (id <=> 910018 AND course_id <=> 18 AND order_index <=> 0)
                OR (id <=> 910036 AND course_id <=> 18 AND order_index <=> 1))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in course_db.sections; no data was changed';
    END IF;

    INSERT INTO course_db.sections (id, course_id, title, order_index, created_at, updated_at) VALUES
    (910001, 1, 'Chương 1: Chiến lược Listening & Reading Band 7.5+', 0, NOW(6), NOW(6)),
    (910019, 1, 'Chương 2: Kỹ thuật Writing Academic & Speaking nâng cao', 1, NOW(6), NOW(6)),
    (910002, 2, 'Chương 1: Tối ưu ngữ pháp Part 5–6 & tốc độ đọc Part 7', 0, NOW(6), NOW(6)),
    (910020, 2, 'Chương 2: Chiến thuật bứt tốc TOEIC Listening Part 1–4', 1, NOW(6), NOW(6)),
    (910003, 3, 'Chương 1: Giao tiếp công sở hằng ngày & xử lý lịch hẹn', 0, NOW(6), NOW(6)),
    (910021, 3, 'Chương 2: Họp nhóm, nêu quan điểm & phản hồi lịch sự', 1, NOW(6), NOW(6)),
    (910004, 4, 'Chương 1: Daily Stand-up, Code Review & Viết tài liệu kỹ thuật', 0, NOW(6), NOW(6)),
    (910022, 4, 'Chương 2: Thảo luận kiến trúc hệ thống & Phỏng vấn Technical', 1, NOW(6), NOW(6)),
    (910005, 5, 'Chương 1: Hệ thống 12 thì & Cấu trúc câu cốt lõi', 0, NOW(6), NOW(6)),
    (910023, 5, 'Chương 2: Câu bị động, Mệnh đề quan hệ & Câu điều kiện', 1, NOW(6), NOW(6)),
    (910006, 6, 'Chương 1: Hệ thống Nguyên âm đơn, Nguyên âm đôi & Khẩu hình', 0, NOW(6), NOW(6)),
    (910024, 6, 'Chương 2: Phụ âm cuối, Nối âm & Ngữ điệu tự nhiên', 1, NOW(6), NOW(6)),
    (910007, 7, 'Chương 1: IELTS Writing Task 1 – Biểu đồ, Bản đồ & Quy trình', 0, NOW(6), NOW(6)),
    (910025, 7, 'Chương 2: IELTS Writing Task 2 – Tư duy phản biện & Paraphrase', 1, NOW(6), NOW(6)),
    (910008, 8, 'Chương 1: Phản xạ Part 1 & Kể chuyện cuốn hút Part 2', 0, NOW(6), NOW(6)),
    (910026, 8, 'Chương 2: Tư duy phân tích xã hội trong IELTS Speaking Part 3', 1, NOW(6), NOW(6)),
    (910009, 9, 'Chương 1: Nền tảng TOEIC Listening & Reading 650+', 0, NOW(6), NOW(6)),
    (910027, 9, 'Chương 2: Thực chiến TOEIC Speaking & Writing công sở', 1, NOW(6), NOW(6)),
    (910010, 10, 'Chương 1: Chuẩn mực viết Email công việc & Phối hợp đa quốc gia', 0, NOW(6), NOW(6)),
    (910028, 10, 'Chương 2: Cấu trúc bài thuyết trình & Làm chủ phần Q&A', 1, NOW(6), NOW(6)),
    (910011, 11, 'Chương 1: Phương pháp Nghe chép chính tả 5 bước chuẩn khoa học', 0, NOW(6), NOW(6)),
    (910029, 11, 'Chương 2: Kỹ thuật Shadowing tăng tốc độ phản xạ nói', 1, NOW(6), NOW(6)),
    (910012, 12, 'Chương 1: Giải phẫu câu phức & Kỹ thuật đoán nghĩa theo ngữ cảnh', 0, NOW(6), NOW(6)),
    (910030, 12, 'Chương 2: Đọc phân tích bài báo Kinh tế & Khoa học', 1, NOW(6), NOW(6)),
    (910013, 13, 'Chương 1: Tối ưu CV tiếng Anh & Hồ sơ LinkedIn ấn tượng', 0, NOW(6), NOW(6)),
    (910031, 13, 'Chương 2: Thực chiến phỏng vấn Behavioral theo mô hình STAR', 1, NOW(6), NOW(6)),
    (910014, 14, 'Chương 1: Sân bay, Hải quan & Di chuyển quốc tế', 0, NOW(6), NOW(6)),
    (910032, 14, 'Chương 2: Khách sạn, Ẩm thực & Xử lý tình huống khẩn cấp', 1, NOW(6), NOW(6)),
    (910015, 15, 'Chương 1: Xây dựng Statement of Purpose & Personal Statement', 0, NOW(6), NOW(6)),
    (910033, 15, 'Chương 2: Thư giới thiệu & Phỏng vấn hội đồng học bổng', 1, NOW(6), NOW(6)),
    (910016, 16, 'Chương 1: Làm quen cấu trúc câu đơn & Giới thiệu bản thân', 0, NOW(6), NOW(6)),
    (910034, 16, 'Chương 2: Giao tiếp sinh hoạt hằng ngày trình độ A2', 1, NOW(6), NOW(6)),
    (910017, 17, 'Chương 1: Viết User Stories & Tài liệu PRD rõ ràng', 0, NOW(6), NOW(6)),
    (910035, 17, 'Chương 2: Thuyết trình Product Roadmap & Stakeholder Alignment', 1, NOW(6), NOW(6)),
    (910018, 18, 'Chương 1: Tổng hợp ngữ pháp TOEIC trọng điểm (Lưu trữ)', 0, NOW(6), NOW(6)),
    (910036, 18, 'Chương 2: Bộ đề đọc hiểu tham khảo (Lưu trữ)', 1, NOW(6), NOW(6))
    ON DUPLICATE KEY UPDATE title = VALUES(title);

    IF EXISTS (SELECT 1 FROM course_db.lessons
        WHERE id IN (910101, 910102, 910103, 910201, 910202, 910203, 910301, 910302, 910303, 910401, 910402, 910403, 910501, 910502, 910503, 910601, 910602, 910603, 910701, 910702, 910703, 910801, 910802, 910803, 910901, 910902, 910903, 911001, 911002, 911003, 911101, 911102, 911103, 911201, 911202, 911203, 911301, 911302, 911303, 911401, 911402, 911403, 911501, 911502, 911503, 911601, 911602, 911603, 911701, 911702, 911703, 911801, 911802, 911803)
            AND NOT ((id <=> 910101 AND section_id <=> 910001 AND order_index <=> 0)
                OR (id <=> 910102 AND section_id <=> 910001 AND order_index <=> 1)
                OR (id <=> 910103 AND section_id <=> 910019 AND order_index <=> 0)
                OR (id <=> 910201 AND section_id <=> 910002 AND order_index <=> 0)
                OR (id <=> 910202 AND section_id <=> 910002 AND order_index <=> 1)
                OR (id <=> 910203 AND section_id <=> 910020 AND order_index <=> 0)
                OR (id <=> 910301 AND section_id <=> 910003 AND order_index <=> 0)
                OR (id <=> 910302 AND section_id <=> 910003 AND order_index <=> 1)
                OR (id <=> 910303 AND section_id <=> 910021 AND order_index <=> 0)
                OR (id <=> 910401 AND section_id <=> 910004 AND order_index <=> 0)
                OR (id <=> 910402 AND section_id <=> 910004 AND order_index <=> 1)
                OR (id <=> 910403 AND section_id <=> 910022 AND order_index <=> 0)
                OR (id <=> 910501 AND section_id <=> 910005 AND order_index <=> 0)
                OR (id <=> 910502 AND section_id <=> 910005 AND order_index <=> 1)
                OR (id <=> 910503 AND section_id <=> 910023 AND order_index <=> 0)
                OR (id <=> 910601 AND section_id <=> 910006 AND order_index <=> 0)
                OR (id <=> 910602 AND section_id <=> 910006 AND order_index <=> 1)
                OR (id <=> 910603 AND section_id <=> 910024 AND order_index <=> 0)
                OR (id <=> 910701 AND section_id <=> 910007 AND order_index <=> 0)
                OR (id <=> 910702 AND section_id <=> 910007 AND order_index <=> 1)
                OR (id <=> 910703 AND section_id <=> 910025 AND order_index <=> 0)
                OR (id <=> 910801 AND section_id <=> 910008 AND order_index <=> 0)
                OR (id <=> 910802 AND section_id <=> 910008 AND order_index <=> 1)
                OR (id <=> 910803 AND section_id <=> 910026 AND order_index <=> 0)
                OR (id <=> 910901 AND section_id <=> 910009 AND order_index <=> 0)
                OR (id <=> 910902 AND section_id <=> 910009 AND order_index <=> 1)
                OR (id <=> 910903 AND section_id <=> 910027 AND order_index <=> 0)
                OR (id <=> 911001 AND section_id <=> 910010 AND order_index <=> 0)
                OR (id <=> 911002 AND section_id <=> 910010 AND order_index <=> 1)
                OR (id <=> 911003 AND section_id <=> 910028 AND order_index <=> 0)
                OR (id <=> 911101 AND section_id <=> 910011 AND order_index <=> 0)
                OR (id <=> 911102 AND section_id <=> 910011 AND order_index <=> 1)
                OR (id <=> 911103 AND section_id <=> 910029 AND order_index <=> 0)
                OR (id <=> 911201 AND section_id <=> 910012 AND order_index <=> 0)
                OR (id <=> 911202 AND section_id <=> 910012 AND order_index <=> 1)
                OR (id <=> 911203 AND section_id <=> 910030 AND order_index <=> 0)
                OR (id <=> 911301 AND section_id <=> 910013 AND order_index <=> 0)
                OR (id <=> 911302 AND section_id <=> 910031 AND order_index <=> 0)
                OR (id <=> 911303 AND section_id <=> 910031 AND order_index <=> 1)
                OR (id <=> 911401 AND section_id <=> 910014 AND order_index <=> 0)
                OR (id <=> 911402 AND section_id <=> 910032 AND order_index <=> 0)
                OR (id <=> 911403 AND section_id <=> 910032 AND order_index <=> 1)
                OR (id <=> 911501 AND section_id <=> 910015 AND order_index <=> 0)
                OR (id <=> 911502 AND section_id <=> 910015 AND order_index <=> 1)
                OR (id <=> 911503 AND section_id <=> 910033 AND order_index <=> 0)
                OR (id <=> 911601 AND section_id <=> 910016 AND order_index <=> 0)
                OR (id <=> 911602 AND section_id <=> 910016 AND order_index <=> 1)
                OR (id <=> 911603 AND section_id <=> 910034 AND order_index <=> 0)
                OR (id <=> 911701 AND section_id <=> 910017 AND order_index <=> 0)
                OR (id <=> 911702 AND section_id <=> 910017 AND order_index <=> 1)
                OR (id <=> 911703 AND section_id <=> 910035 AND order_index <=> 0)
                OR (id <=> 911801 AND section_id <=> 910018 AND order_index <=> 0)
                OR (id <=> 911802 AND section_id <=> 910018 AND order_index <=> 1)
                OR (id <=> 911803 AND section_id <=> 910036 AND order_index <=> 0))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in course_db.lessons; no data was changed';
    END IF;

    INSERT INTO course_db.lessons (id, section_id, title, lesson_type, content, video_url, duration, order_index, is_preview, created_at, updated_at) VALUES
    (910101, 910001, 'IELTS Listening: Nhận diện bẫy Paraphrase & Signposting', 'TEXT', 'MỤC TIÊU BÀI HỌC\nLàm chủ kỹ năng dự đoán loại từ cần điền trước khi băng chạy và nhận diện các tín hiệu chuyển hướng thông tin (Signposting) như "actually", "on second thought", "originally".\n\nKIẾN THỨC TRỌNG TÂM\n1. Gạch chân từ khóa cố định (tên riêng, ngày tháng, con số) và từ khóa có thể bị paraphrase.\n2. Cảnh giác bẫy tự sửa lỗi (Self-correction): người nói thường đưa đáp án nhiễu trước rồi đính chính bằng "Wait, sorry..." hoặc "Let me double-check".\n3. Kiểm tra chính tả, số ít/số nhiều và giới hạn từ (NO MORE THAN TWO WORDS).\n\nVÍ DỤ THỰC HÀNH\nCâu hỏi: "The seminar room has been moved to the _____ floor."\nAudio: "We booked the second floor originally, though because of renovations we had to relocate upstairs to the fourth floor."\n→ Đáp án chính xác: fourth (không chọn second).', NULL, 900, 0, TRUE, NOW(6), NOW(6)),
    (910102, 910001, 'IELTS Reading: Xử lý dạng True / False / Not Given không mất điểm', 'TEXT', 'MỤC TIÊU BÀI HỌC\nPhân biệt dứt điểm giữa FALSE (thông tin trái ngược hoàn toàn với bài đọc) và NOT GIVEN (bài đọc không đủ cơ sở khẳng định hay phủ định).\n\nQUY TRÌNH 4 BƯỚC\n1. Tách mệnh đề câu hỏi thành chủ ngữ, hành động chính và từ giới hạn (only, always, majority, first).\n2. Quét từ khóa (Scanning) để khoanh vùng đúng 2–3 câu chứa bằng chứng.\n3. Đối chiếu ngữ nghĩa, đặc biệt chú ý các cấu trúc so sánh và phủ định ngầm (rarely, fail to, lack of).\n4. Tuyệt đối không dùng kiến thức nền bên ngoài để suy đoán.\n\nBÀI TẬP TỰ LUYỆN\nĐọc lại đoạn trích về năng lượng tái tạo ở tài liệu đính kèm và giải thích rõ bằng chứng dòng nào quyết định câu trả lời.', NULL, 1080, 1, FALSE, NOW(6), NOW(6)),
    (910103, 910019, 'IELTS Writing Task 2: Khung lập luận PEEL cho đoạn thân bài Band 7.5', 'DOCUMENT', 'MỤC TIÊU BÀI HỌC\nXây dựng đoạn văn thân bài mạch lạc theo công thức PEEL (Point – Explanation – Example – Link) nhằm tối ưu tiêu chí Coherence & Cohesion và Task Response.\n\nCẤU TRÚC MẪU\n- Point: Nêu luận điểm trực diện trả lời câu hỏi đề bài.\n- Explanation: Giải thích cơ chế nguyên nhân – kết quả bằng ngôn ngữ học thuật.\n- Example: Minh họa bằng ví dụ cụ thể, thực tế, tránh bịa số liệu thiếu thuyết phục.\n- Link: Chốt lại mối liên hệ trực tiếp với quan điểm tổng thể của bài viết.', NULL, 1200, 0, FALSE, NOW(6), NOW(6)),
    (910201, 910002, 'TOEIC Part 5: Phân tích từ loại, rút gọn mệnh đề & cấu trúc bẫy', 'TEXT', 'MỤC TIÊU BÀI HỌC\nGiải quyết 30 câu TOEIC Part 5 trong vòng 10 phút với độ chính xác trên 90% bằng kỹ thuật phân tích khung câu nhanh.\n\nKIẾN THỨC CỐT LÕI\n1. Nhóm câu từ loại (Word Form): nhìn từ ngay trước và sau chỗ trống trước khi dịch nghĩa.\n2. Nhóm câu liên từ vs giới từ: phân biệt Although/Because (cộng mệnh đề) với Despite/Because of (cộng cụm danh từ).\n3. Cấu trúc giả định (Subjunctive): request/suggest/recommend + that + S + V-nguyên mẫu.\n\nVÍ DỤ\n"The regional director requested that every branch manager _____ the quarterly audit report by Friday." → submit.', NULL, 840, 0, TRUE, NOW(6), NOW(6)),
    (910202, 910002, 'TOEIC Part 7: Kỹ thuật đối chiếu thông tin đoạn kép & đoạn ba', 'TEXT', 'MỤC TIÊU BÀI HỌC\nXử lý câu hỏi liên kết (Cross-reference questions) trong Double & Triple Passages mà không phải đọc lại toàn bộ văn bản.\n\nCHIẾN THUẬT\n- Xác định loại văn bản: Email + Bảng giá + Thông báo cập nhật.\n- Tìm điểm giao nhau giữa các văn bản: mã đơn hàng, ngày đặt lịch, tên sản phẩm hoặc mức chiết khấu.\n- Ghi chú nhanh các chi tiết thay đổi ở văn bản sau (thường là bẫy câu hỏi suy luận).', NULL, 1140, 1, FALSE, NOW(6), NOW(6)),
    (910203, 910020, 'TOEIC Listening Part 3–4: Đọc trước câu hỏi & bắt ý chính theo cụm', 'VIDEO', 'MỤC TIÊU BÀI HỌC\nSử dụng hiệu quả 8 giây giữa các đoạn hội thoại để đọc lướt 3 câu hỏi kế tiếp và định vị đúng câu trả lời ngay khi nghe.\n\nMẸO THỰC CHIẾN\n- Tập trung vào câu hỏi Who, Where, What problem và What does the speaker ask the listener to do.\n- Với câu hỏi kèm biểu đồ/lịch trình (Graphic questions), nhìn tiêu đề cột trước để biết thông tin nào cần đối chiếu bằng tai.', 'https://cdn.chitchatgo.vn/lessons/course-2/lesson-910203.mp4', 960, 0, FALSE, NOW(6), NOW(6)),
    (910301, 910003, 'Chào hỏi chuyên nghiệp, đề xuất và từ chối lịch hẹn tinh tế', 'TEXT', 'MỤC TIÊU BÀI HỌC\nSử dụng ngôn ngữ lịch sự, tự nhiên khi mở đầu cuộc trò chuyện công sở, đề nghị hỗ trợ và từ chối lịch họp trùng mà vẫn giữ thiện cảm.\n\nMẪU CÂU ỨNG DỤNG\n- Đề xuất lịch: "Would Thursday at 2 PM work for your team?"\n- Từ chối lịch sự: "I appreciate the invite, though I have a prior commitment at that slot. Could we move it to Friday morning?"\n- Chốt lại hành động: "Just to make sure we are on the same page, I will send the summary by 5 PM."', NULL, 780, 0, TRUE, NOW(6), NOW(6)),
    (910302, 910003, 'Small Talk tự nhiên với đồng nghiệp và đối tác quốc tế', 'TEXT', 'MỤC TIÊU BÀI HỌC\nPhá băng trong 2 phút đầu cuộc họp trực tuyến hoặc giờ nghỉ trưa bằng các chủ đề an toàn, thân thiện.\n\nCÔNG THỨC A.R.E\n- Anchor (Điểm chung): bình luận về buổi họp, thời tiết hoặc sự kiện chung.\n- Reveal (Chia sẻ ngắn): nói 1 câu ngắn về trải nghiệm cá nhân.\n- Encourage (Hỏi mở): đặt câu hỏi mở để đối phương tiếp lời tự nhiên.', NULL, 720, 1, FALSE, NOW(6), NOW(6)),
    (910303, 910021, 'Đưa ra ý kiến trái chiều và đề xuất giải pháp trong cuộc họp', 'VIDEO', 'MỤC TIÊU BÀI HỌC\nBiết cách góp ý mang tính xây dựng mà không gây cảm giác đối đầu trong môi trường đa văn hóa.\n\nCỤM TỪ CHUYÊN NGHIỆP\n- "That is a solid point. Another angle we might consider is..."\n- "I see where you are coming from, however we should also weigh the timeline risk."', 'https://cdn.chitchatgo.vn/lessons/course-3/lesson-910303.mp4', 900, 0, FALSE, NOW(6), NOW(6)),
    (910401, 910004, 'Báo cáo Daily Stand-up & Mô tả Blocker ngắn gọn, đúng trọng tâm', 'TEXT', 'MỤC TIÊU BÀI HỌC\nTrình bày cập nhật tiến độ trong Daily Stand-up dưới 90 giây bằng ngôn ngữ kỹ thuật chính xác.\n\nKHUNG BÁO CÁO 3 PHẦN\n1. Completed: "Yesterday I wrapped up the JWT refresh rotation endpoint and added integration tests."\n2. Today: "Today I am working on database index optimization for the course catalog query."\n3. Blocker: "I am currently blocked on staging S3 credentials; could someone from DevOps grant access after stand-up?"', NULL, 840, 0, TRUE, NOW(6), NOW(6)),
    (910402, 910004, 'Viết nhận xét Code Review lịch sự, rõ ràng và mang tính xây dựng', 'DOCUMENT', 'MỤC TIÊU BÀI HỌC\nPhân biệt giữa nhận xét bắt buộc (blocking) và góp ý nhỏ (nitpick) trong Pull Request bằng tiếng Anh chuyên nghiệp.\n\nMẪU CÂU CODE REVIEW\n- "Nit: could we extract this validation into a helper method for readability?"\n- "Good catch on the null check! One edge case to consider is concurrent retries."', NULL, 900, 1, FALSE, NOW(6), NOW(6)),
    (910403, 910022, 'Trình bày Trade-offs trong buổi phỏng vấn System Design', 'TEXT', 'MỤC TIÊU BÀI HỌC\nGiải thích lý do chọn kiến trúc (caching, pagination, idempotency, microservices) một cách mạch lạc trước hội đồng kỹ thuật.\n\nTỪ VỰNG TRỌNG TÂM\nThroughput, latency, eventual consistency, bottleneck, horizontal scaling, fault tolerance, single point of failure.', NULL, 1200, 0, FALSE, NOW(6), NOW(6)),
    (910501, 910005, 'Làm chủ 6 thì thông dụng nhất trong giao tiếp và bài thi', 'TEXT', 'MỤC TIÊU BÀI HỌC\nHiểu bản chất trục thời gian thay vì học thuộc máy móc dấu hiệu nhận biết cho 6 thì dùng nhiều nhất: Hiện tại đơn, Hiện tại tiếp diễn, Hiện tại hoàn thành, Quá khứ đơn, Quá khứ tiếp diễn và Tương lai đơn.\n\nPHÂN BIỆT NHANH\n- Past Simple: sự việc đã kết thúc hẳn tại mốc thời gian xác định trong quá khứ ("I finished the report yesterday").\n- Present Perfect: sự việc bắt đầu trong quá khứ và còn liên quan/kết quả đến hiện tại ("I have finished the report, so you can review it now").', NULL, 780, 0, TRUE, NOW(6), NOW(6)),
    (910502, 910005, 'Cấu trúc câu bị động (Passive Voice) trong báo cáo & học thuật', 'TEXT', 'MỤC TIÊU BÀI HỌC\nBiết khi nào nên dùng câu bị động để nhấn mạnh đối tượng chịu tác động và tránh dịch từng từ từ tiếng Việt.\n\nCÔNG THỨC CHUNG\nS + be (chia theo thì) + V3/ed (+ by agent khi cần thiết).\nVí dụ: "This bridge was built in 2020." / "All exam results are reviewed twice before publication."', NULL, 720, 1, FALSE, NOW(6), NOW(6)),
    (910503, 910023, 'Mệnh đề quan hệ & 3 loại câu điều kiện ứng dụng thực tế', 'TEXT', 'MỤC TIÊU BÀI HỌC\nKết nối ý mượt mà hơn bằng who, which, that, whose và diễn đạt giả thuyết chuẩn xác với Conditional Types 1, 2, 3.\n\nVÍ DỤ ỨNG DỤNG\n- Type 1 (có thật): "If you practice 20 minutes daily, your listening will improve noticeably."\n- Type 2 (giả định hiện tại): "If I had more time, I would join the evening speaking club."', NULL, 840, 0, FALSE, NOW(6), NOW(6)),
    (910601, 910006, 'Cặp nguyên âm dễ nhầm: /iː/ vs /ɪ/ và /uː/ vs /ʊ/', 'VIDEO', 'MỤC TIÊU BÀI HỌC\nChỉnh khẩu hình môi và độ căng lưỡi để phát âm rõ sự khác biệt giữa "sheep/ship", "leave/live", "fool/full".\n\nBÀI TẬP LUYỆN KHẨU HÌNH\nĐọc chậm các cặp tối thiểu (minimal pairs) trước gương và ghi âm so sánh với giọng mẫu.', 'https://cdn.chitchatgo.vn/lessons/course-6/lesson-910601.mp4', 720, 0, TRUE, NOW(6), NOW(6)),
    (910602, 910006, 'Phụ âm vô thanh – hữu thanh và Ending Sounds chuẩn xác', 'TEXT', 'MỤC TIÊU BÀI HỌC\nKhông còn nuốt âm cuối /t/, /d/, /s/, /z/, /k/, /p/ giúp người nghe hiểu ngay lập tức từ bạn nói.\n\nQUY TẮC PHÁT ÂM ĐUÔI -ED & -S\nPhân biệt 3 cách đọc đuôi -ed (/ɪd/, /t/, /d/) dựa vào âm kết thúc thực tế trong phiên âm IPA.', NULL, 780, 1, FALSE, NOW(6), NOW(6)),
    (910603, 910024, 'Kỹ thuật Nối âm (Linking) và Nuốt âm trong tốc độ nói tự nhiên', 'VIDEO', 'MỤC TIÊU BÀI HỌC\nHiểu tại sao người bản xứ nói "check it out" nghe như "che-ki-dout" và tập nối phụ âm cuối sang nguyên âm đầu để câu nói mượt mà hơn.', 'https://cdn.chitchatgo.vn/lessons/course-6/lesson-910603.mp4', 840, 0, FALSE, NOW(6), NOW(6)),
    (910701, 910007, 'Viết Overview sắc nét cho biểu đồ đường & biểu đồ cột', 'TEXT', 'MỤC TIÊU BÀI HỌC\nXác định 2–3 xu hướng nổi bật nhất (xu hướng tổng thể, đối tượng cao nhất/thấp nhất, sự thay đổi mạnh nhất) mà không liệt kê số liệu chi tiết trong đoạn Overview.', NULL, 960, 0, TRUE, NOW(6), NOW(6)),
    (910702, 910007, 'Ngôn ngữ so sánh số liệu và tránh lặp cấu trúc câu', 'DOCUMENT', 'MỤC TIÊU BÀI HỌC\nChuyển đổi linh hoạt giữa cấu trúc động từ + trạng từ ("rose sharply") và tính từ + danh từ ("experienced a sharp rise") để nâng điểm Grammatical Range.', NULL, 900, 1, FALSE, NOW(6), NOW(6)),
    (910703, 910025, 'Xử lý dạng bài Discuss Both Views & Opinion rõ ràng quan điểm', 'TEXT', 'MỤC TIÊU BÀI HỌC\nLập dàn ý 5 phút trước khi viết, giữ nhất quán lập trường xuyên suốt từ Introduction đến Conclusion.', NULL, 1140, 0, FALSE, NOW(6), NOW(6)),
    (910801, 910008, 'Công thức mở rộng câu trả lời Part 1 tự nhiên trong 3–4 câu', 'VIDEO', 'MỤC TIÊU BÀI HỌC\nÁp dụng mô hình Direct Answer + Reason + Mini Example để câu trả lời Part 1 vừa tự nhiên vừa khoe được collocation đắt giá.', 'https://cdn.chitchatgo.vn/lessons/course-8/lesson-910801.mp4', 780, 0, TRUE, NOW(6), NOW(6)),
    (910802, 910008, 'Kỹ thuật ghi chú 1 phút cho Cue Card Part 2 không bị bí ý', 'TEXT', 'MỤC TIÊU BÀI HỌC\nChia mốc thời gian Quá khứ – Hiện tại – Cảm xúc cá nhân để nói liền mạch đủ 2 phút cho mọi chủ đề tả người, nơi chốn hay sự kiện.', NULL, 900, 1, FALSE, NOW(6), NOW(6)),
    (910803, 910026, 'Trả lời câu hỏi so sánh và dự đoán xu hướng ở Part 3', 'TEXT', 'MỤC TIÊU BÀI HỌC\nSử dụng các cấu trúc giảm nhẹ lập luận (Hedging) như "It largely depends on...", "From an economic perspective..." để đạt điểm Lexical Resource cao.', NULL, 960, 0, FALSE, NOW(6), NOW(6)),
    (910901, 910009, 'Từ vựng cốt lõi chủ đề Hợp đồng, Nhân sự và Logistics', 'TEXT', 'MỤC TIÊU BÀI HỌC\nNắm vững 120 cụm từ xuất hiện lặp lại thường xuyên nhất trong đề thi TOEIC doanh nghiệp kèm ngữ cảnh đặt câu chuẩn.', NULL, 840, 0, TRUE, NOW(6), NOW(6)),
    (910902, 910009, 'Mô tả tranh Part 1 & Phản xạ câu hỏi Wh- trong Part 2', 'TEXT', 'MỤC TIÊU BÀI HỌC\nNhận diện trạng thái vật thể vs hành động con người trong Part 1 và loại bỏ đáp án đồng âm gây nhiễu trong Part 2.', NULL, 780, 1, FALSE, NOW(6), NOW(6)),
    (910903, 910027, 'TOEIC Writing: Viết email phản hồi yêu cầu khách hàng trong 10 phút', 'DOCUMENT', 'MỤC TIÊU BÀI HỌC\nĐáp ứng đủ 3 nhiệm vụ đề bài (ví dụ: xác nhận lịch, đề nghị cung cấp thông tin, cảm ơn) với văn phong trang trọng, ngắn gọn.', NULL, 900, 0, FALSE, NOW(6), NOW(6)),
    (911001, 910010, 'Cấu trúc Email chuẩn BLUF: Tiêu đề rõ ràng & Call-to-Action sắc nét', 'TEXT', 'MỤC TIÊU BÀI HỌC\nÁp dụng nguyên tắc Bottom Line Up Front (BLUF) giúp người nhận nắm ngay mục đích email và hành động cần làm trong 15 giây đầu tiên.', NULL, 720, 0, TRUE, NOW(6), NOW(6)),
    (911002, 910010, 'Email nhắc tiến độ (Follow-up) và xử lý sự cố với khách hàng', 'DOCUMENT', 'MỤC TIÊU BÀI HỌC\nViết lời nhắc deadline lịch sự mà vẫn rõ ràng, đồng thời biết cách xin lỗi chuyên nghiệp và đưa phương án khắc phục cụ thể.', NULL, 840, 1, FALSE, NOW(6), NOW(6)),
    (911003, 910028, 'Ngôn ngữ chuyển ý (Signposting) và chốt hạ ấn tượng khi thuyết trình', 'VIDEO', 'MỤC TIÊU BÀI HỌC\nDẫn dắt khán giả mượt mà qua từng slide biểu đồ và xử lý bình tĩnh những câu hỏi khó trong phiên Q&A.', 'https://cdn.chitchatgo.vn/lessons/course-10/lesson-911003.mp4', 960, 0, FALSE, NOW(6), NOW(6)),
    (911101, 910011, 'Vì sao bạn nghe không ra dù biết mặt chữ? Giải mã Weak Forms', 'TEXT', 'MỤC TIÊU BÀI HỌC\nNhận diện các dạng đọc lướt (Weak Forms) của "to", "for", "can", "have", "and" trong lời nói thực tế thay vì mong chờ từng từ đọc rõ như từ điển.', NULL, 660, 0, TRUE, NOW(6), NOW(6)),
    (911102, 910011, 'Quy trình 5 bước học Dictation hiệu quả trên ChitChatGo', 'TEXT', 'MỤC TIÊU BÀI HỌC\nKết hợp nghe tổng quan, chép từng câu, đối chiếu từ sai màu đỏ, nghe lại không nhìn chữ và đọc nhại theo tốc độ gốc.', NULL, 720, 1, FALSE, NOW(6), NOW(6)),
    (911103, 910029, 'Thực hành Shadowing đoạn hội thoại công sở 60 giây', 'VIDEO', 'MỤC TIÊU BÀI HỌC\nBắt chước nhịp điệu, ngắt nghỉ theo cụm nghĩa (Thought Groups) và ngữ điệu câu hỏi đuôi.', 'https://cdn.chitchatgo.vn/lessons/course-11/lesson-911103.mp4', 780, 0, FALSE, NOW(6), NOW(6)),
    (911201, 910012, 'Tách mệnh đề chính – phụ để đọc hiểu câu dài 40 từ trong 10 giây', 'TEXT', 'MỤC TIÊU BÀI HỌC\nXác định nhanh chủ ngữ thật và động từ chính khi câu bị chèn mệnh đề phân từ, đồng vị ngữ hoặc mệnh đề quan hệ lồng nhau.', NULL, 900, 0, TRUE, NOW(6), NOW(6)),
    (911202, 910012, 'Kỹ thuật đoán nghĩa từ mới qua gốc từ Latin/Hy Lạp và tín hiệu ngữ cảnh', 'DOCUMENT', 'MỤC TIÊU BÀI HỌC\nGiảm phụ thuộc vào từ điển bằng cách nhận biết tiền tố, hậu tố và các dấu hiệu định nghĩa, tương phản ngay trong đoạn văn.', NULL, 840, 1, FALSE, NOW(6), NOW(6)),
    (911203, 910030, 'Tóm tắt luận điểm chính từ bài phân tích xu hướng trí tuệ nhân tạo', 'TEXT', 'MỤC TIÊU BÀI HỌC\nLọc ra câu chủ đề (Topic Sentence), nhận diện thái độ tác giả (neutral, skeptical, optimistic) và tổng hợp bản tóm tắt 5 dòng.', NULL, 1020, 0, FALSE, NOW(6), NOW(6)),
    (911301, 910013, 'Viết Bullet Point thành tích bằng động từ hành động & con số định lượng', 'DOCUMENT', 'MỤC TIÊU BÀI HỌC\nBiến câu mô tả chung chung thành thành tích thuyết phục theo công thức: Action Verb + Task + Measurable Impact.\nVí dụ: "Optimized checkout API queries, reducing average response latency by 38% during peak campaigns."', NULL, 840, 0, TRUE, NOW(6), NOW(6)),
    (911302, 910031, 'Trả lời câu "Tell me about yourself" ấn tượng trong 90 giây', 'TEXT', 'MỤC TIÊU BÀI HỌC\nÁp dụng khung Present – Past – Future để kết nối trực tiếp kinh nghiệm bản thân với nhu cầu của vị trí ứng tuyển.', NULL, 780, 0, FALSE, NOW(6), NOW(6)),
    (911303, 910031, 'Kể câu chuyện giải quyết xung đột theo mô hình STAR & Đặt câu hỏi ngược', 'VIDEO', 'MỤC TIÊU BÀI HỌC\nTrình bày mạch lạc Situation – Task – Action – Result và chuẩn bị 3 câu hỏi thông minh dành cho nhà tuyển dụng.', 'https://cdn.chitchatgo.vn/lessons/course-13/lesson-911303.mp4', 960, 1, FALSE, NOW(6), NOW(6)),
    (911401, 910014, 'Check-in sân bay, qua cổng an ninh và trả lời hải quan tự tin', 'TEXT', 'MỤC TIÊU BÀI HỌC\nNghe hiểu câu hỏi phổ biến của nhân viên xuất nhập cảnh về mục đích chuyến đi, thời gian lưu trú và nơi ở.', NULL, 660, 0, TRUE, NOW(6), NOW(6)),
    (911402, 910032, 'Nhận phòng khách sạn, yêu cầu dịch vụ và đổi phòng lịch sự', 'TEXT', 'MỤC TIÊU BÀI HỌC\nYêu cầu check-in sớm, gửi hành lý, hỏi mật khẩu Wi-Fi và phản ánh sự cố phòng ốc một cách lịch thiệp.', NULL, 720, 0, FALSE, NOW(6), NOW(6)),
    (911403, 910032, 'Gọi món ăn, hỏi thành phần dị ứng và mua sắm hoàn thuế', 'VIDEO', 'MỤC TIÊU BÀI HỌC\nSử dụng thành thạo mẫu câu đặt bàn, hỏi món đặc sản địa phương và yêu cầu hóa đơn hoàn thuế VAT.', 'https://cdn.chitchatgo.vn/lessons/course-14/lesson-911403.mp4', 660, 1, FALSE, NOW(6), NOW(6)),
    (911501, 910015, 'Tìm sợi chỉ đỏ kết nối học thuật, dự án và mục tiêu nghề nghiệp trong SOP', 'DOCUMENT', 'MỤC TIÊU BÀI HỌC\nTránh biến bài luận thành bản kể lại CV; tập trung thể hiện động lực nghiên cứu và sự phù hợp với chương trình đào tạo.', NULL, 1080, 0, TRUE, NOW(6), NOW(6)),
    (911502, 910015, 'Viết Cold Email chuyên nghiệp liên hệ Giáo sư hướng dẫn', 'TEXT', 'MỤC TIÊU BÀI HỌC\nCấu trúc email ngắn 200 từ thể hiện bạn đã đọc công trình của giáo sư và đính kèm hồ sơ gọn gàng.', NULL, 840, 1, FALSE, NOW(6), NOW(6)),
    (911503, 910033, 'Chuẩn bị câu trả lời thuyết phục về kế hoạch đóng góp sau tốt nghiệp', 'TEXT', 'MỤC TIÊU BÀI HỌC\nTrình bày lộ trình ngắn hạn 2 năm và dài hạn 5 năm mang tính thực tế cao trước hội đồng học bổng.', NULL, 960, 0, FALSE, NOW(6), NOW(6)),
    (911601, 910016, 'Trật tự câu S–V–O và cách dùng động từ To Be không bao giờ nhầm', 'TEXT', 'MỤC TIÊU BÀI HỌC\nNắm chắc khung câu khẳng định, phủ định và câu hỏi Yes/No với am/is/are và động từ thường ở thì hiện tại đơn.', NULL, 600, 0, TRUE, NOW(6), NOW(6)),
    (911602, 910016, 'Giới thiệu bản thân, gia đình và thói quen hằng ngày bằng 10 câu chuẩn', 'TEXT', 'MỤC TIÊU BÀI HỌC\nTự viết và đọc to đoạn giới thiệu 1 phút về tên, công việc/ngành học, sở thích và mục tiêu học tiếng Anh.', NULL, 660, 1, FALSE, NOW(6), NOW(6)),
    (911603, 910034, 'Hỏi giá, mua sắm và hẹn gặp bạn bè cuối tuần', 'VIDEO', 'MỤC TIÊU BÀI HỌC\nLuyện phản xạ hỏi giờ, ngày tháng, giá cả và lời mời đơn giản qua hội thoại có phụ đề song ngữ.', 'https://cdn.chitchatgo.vn/lessons/course-16/lesson-911603.mp4', 720, 0, FALSE, NOW(6), NOW(6)),
    (911701, 910017, 'Viết User Story theo chuẩn INVEST và Acceptance Criteria Given–When–Then', 'DOCUMENT', 'MỤC TIÊU BÀI HỌC\nSoạn thảo yêu cầu sản phẩm không mơ hồ để đội ngũ Engineering và QA hiểu chính xác cùng một kỳ vọng.', NULL, 900, 0, TRUE, NOW(6), NOW(6)),
    (911702, 910017, 'Đặt câu hỏi mở trong buổi User Discovery Interview', 'TEXT', 'MỤC TIÊU BÀI HỌC\nTránh câu hỏi dẫn dắt (leading questions) để thu thập phản hồi chân thực từ người dùng cuối.', NULL, 840, 1, FALSE, NOW(6), NOW(6)),
    (911703, 910035, 'Trình bày độ ưu tiên tính năng và xử lý kỳ vọng của Stakeholder', 'TEXT', 'MỤC TIÊU BÀI HỌC\nGiải thích quyết định ưu tiên dựa trên dữ liệu và tác động kinh doanh một cách thuyết phục.', NULL, 900, 0, FALSE, NOW(6), NOW(6)),
    (911801, 910018, 'Hệ thống cụm giới từ thường gặp trong đề TOEIC', 'TEXT', 'Tài liệu tổng hợp 80 cụm giới từ kinh điển như "in accordance with", "prior to", "subject to", "on behalf of".', NULL, 720, 0, TRUE, NOW(6), NOW(6)),
    (911802, 910018, 'Phân biệt danh từ đếm được và không đếm được dễ nhầm', 'TEXT', 'Ôn tập các danh từ dễ sai trong bài thi như equipment, information, feedback, luggage, staff.', NULL, 660, 1, FALSE, NOW(6), NOW(6)),
    (911803, 910036, 'Phân tích bài đọc thông báo nội bộ doanh nghiệp', 'DOCUMENT', 'Thực hành tìm thông tin ngày hiệu lực, đối tượng áp dụng và đầu mối liên hệ trong memo công ty.', NULL, 780, 0, FALSE, NOW(6), NOW(6))
    ON DUPLICATE KEY UPDATE title = VALUES(title), lesson_type = VALUES(lesson_type), content = VALUES(content), video_url = VALUES(video_url), duration = VALUES(duration), is_preview = VALUES(is_preview);

    INSERT INTO course_db.lesson_resources (id, lesson_id, resource_type, title, file_name, file_size, content_type, object_key, download_url, created_at, updated_at) VALUES
    (1, 910101, 'PDF', 'Bảng tổng hợp 100 cặp Paraphrase IELTS Listening', 'ielts-listening-paraphrase-100.pdf', 1248500, 'application/pdf', 'seed/resources/ielts-listening-paraphrase-100.pdf', '/uploads/seed/resources/ielts-listening-paraphrase-100.pdf', NOW(6), NOW(6)),
    (2, 910102, 'PDF', 'Checklist phân biệt False vs Not Given kèm ví dụ Cambridge', 'ielts-reading-tfng-checklist.pdf', 985200, 'application/pdf', 'seed/resources/ielts-reading-tfng-checklist.pdf', '/uploads/seed/resources/ielts-reading-tfng-checklist.pdf', NOW(6), NOW(6)),
    (3, 910103, 'DOCUMENT', 'Khung mẫu 15 đoạn thân bài PEEL Band 7.5+', 'ielts-writing-peel-templates.docx', 412800, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'seed/resources/ielts-writing-peel-templates.docx', '/uploads/seed/resources/ielts-writing-peel-templates.docx', NOW(6), NOW(6)),
    (4, 910201, 'PDF', 'Sổ tay công thức Word Form & Subjunctive TOEIC Part 5', 'toeic-part5-grammar-handbook.pdf', 1560000, 'application/pdf', 'seed/resources/toeic-part5-grammar-handbook.pdf', '/uploads/seed/resources/toeic-part5-grammar-handbook.pdf', NOW(6), NOW(6)),
    (5, 910202, 'PDF', 'Bộ bài tập luyện đối chiếu đoạn kép Part 7 có giải thích', 'toeic-part7-double-passages.pdf', 2150400, 'application/pdf', 'seed/resources/toeic-part7-double-passages.pdf', '/uploads/seed/resources/toeic-part7-double-passages.pdf', NOW(6), NOW(6)),
    (6, 910203, 'PDF', 'Bản đồ từ khóa nghe nhanh TOEIC Part 3 & Part 4', 'toeic-part34-keyword-map.pdf', 874300, 'application/pdf', 'seed/resources/toeic-part34-keyword-map.pdf', '/uploads/seed/resources/toeic-part34-keyword-map.pdf', NOW(6), NOW(6)),
    (7, 910301, 'PDF', '50 mẫu câu giao tiếp lịch hẹn & phản hồi chuyên nghiệp', 'workplace-scheduling-phrases.pdf', 652100, 'application/pdf', 'seed/resources/workplace-scheduling-phrases.pdf', '/uploads/seed/resources/workplace-scheduling-phrases.pdf', NOW(6), NOW(6)),
    (8, 910302, 'DOCUMENT', 'Bộ câu hỏi Small Talk an toàn trong môi trường quốc tế', 'international-small-talk-guide.docx', 318900, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'seed/resources/international-small-talk-guide.docx', '/uploads/seed/resources/international-small-talk-guide.docx', NOW(6), NOW(6)),
    (9, 910401, 'PDF', 'Template báo cáo Daily Stand-up & Sprint Demo cho Dev', 'dev-daily-standup-cheatsheet.pdf', 540200, 'application/pdf', 'seed/resources/dev-daily-standup-cheatsheet.pdf', '/uploads/seed/resources/dev-daily-standup-cheatsheet.pdf', NOW(6), NOW(6)),
    (10, 910402, 'DOCUMENT', 'Bộ mẫu bình luận Code Review chuyên nghiệp trên GitHub', 'code-review-english-phrases.md', 42600, 'text/markdown', 'seed/resources/code-review-english-phrases.md', '/uploads/seed/resources/code-review-english-phrases.md', NOW(6), NOW(6)),
    (11, 910403, 'PDF', 'Bảng thuật ngữ System Design & Cloud Architecture', 'system-design-glossary.pdf', 1120500, 'application/pdf', 'seed/resources/system-design-glossary.pdf', '/uploads/seed/resources/system-design-glossary.pdf', NOW(6), NOW(6)),
    (12, 910501, 'IMAGE', 'Sơ đồ trục thời gian 12 thì tiếng Anh trực quan', 'english-12-tenses-timeline.png', 785400, 'image/png', 'seed/resources/english-12-tenses-timeline.png', '/uploads/seed/resources/english-12-tenses-timeline.png', NOW(6), NOW(6)),
    (13, 910502, 'PDF', 'Bài tập chuyển đổi chủ động – bị động có đáp án chi tiết', 'passive-voice-practice-sheet.pdf', 486200, 'application/pdf', 'seed/resources/passive-voice-practice-sheet.pdf', '/uploads/seed/resources/passive-voice-practice-sheet.pdf', NOW(6), NOW(6)),
    (14, 910601, 'IMAGE', 'Bảng phiên âm 44 âm IPA kèm minh họa vị trí đặt lưỡi', 'ipa-44-sounds-chart.png', 1340000, 'image/png', 'seed/resources/ipa-44-sounds-chart.png', '/uploads/seed/resources/ipa-44-sounds-chart.png', NOW(6), NOW(6)),
    (15, 910602, 'PDF', 'Danh sách 150 cặp từ Minimal Pairs luyện phát âm mỗi ngày', 'minimal-pairs-150-drill.pdf', 615800, 'application/pdf', 'seed/resources/minimal-pairs-150-drill.pdf', '/uploads/seed/resources/minimal-pairs-150-drill.pdf', NOW(6), NOW(6)),
    (16, 910701, 'PDF', 'Bộ từ vựng mô tả xu hướng & số liệu IELTS Writing Task 1', 'ielts-task1-trend-vocab.pdf', 932100, 'application/pdf', 'seed/resources/ielts-task1-trend-vocab.pdf', '/uploads/seed/resources/ielts-task1-trend-vocab.pdf', NOW(6), NOW(6)),
    (17, 910801, 'PDF', 'Bộ 40 chủ đề IELTS Speaking Part 1–2 kèm Collocations tự nhiên', 'ielts-speaking-collocations-40.pdf', 1420000, 'application/pdf', 'seed/resources/ielts-speaking-collocations-40.pdf', '/uploads/seed/resources/ielts-speaking-collocations-40.pdf', NOW(6), NOW(6)),
    (18, 910901, 'PDF', '600 từ vựng TOEIC theo 12 chủ đề doanh nghiệp', 'toeic-business-vocab-600.pdf', 1890400, 'application/pdf', 'seed/resources/toeic-business-vocab-600.pdf', '/uploads/seed/resources/toeic-business-vocab-600.pdf', NOW(6), NOW(6)),
    (19, 911001, 'DOCUMENT', '25 mẫu Email thương mại chuẩn BLUF (xin lỗi, báo giá, chốt lịch)', 'business-email-templates-25.docx', 520100, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'seed/resources/business-email-templates-25.docx', '/uploads/seed/resources/business-email-templates-25.docx', NOW(6), NOW(6)),
    (20, 911101, 'PDF', 'Hướng dẫn nhận diện Weak Forms & Connected Speech', 'weak-forms-listening-guide.pdf', 734000, 'application/pdf', 'seed/resources/weak-forms-listening-guide.pdf', '/uploads/seed/resources/weak-forms-listening-guide.pdf', NOW(6), NOW(6)),
    (21, 911201, 'PDF', 'Tuyển tập 10 bài báo kinh tế có chú giải cấu trúc câu phức', 'academic-reading-annotated-10.pdf', 1645000, 'application/pdf', 'seed/resources/academic-reading-annotated-10.pdf', '/uploads/seed/resources/academic-reading-annotated-10.pdf', NOW(6), NOW(6)),
    (22, 911301, 'DOCUMENT', 'Mẫu CV chuẩn ATS dành cho Fresher & Experienced', 'ats-friendly-resume-template.docx', 289000, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'seed/resources/ats-friendly-resume-template.docx', '/uploads/seed/resources/ats-friendly-resume-template.docx', NOW(6), NOW(6)),
    (23, 911401, 'PDF', 'Sổ tay bỏ túi tiếng Anh sân bay, khách sạn và nhà hàng', 'travel-english-pocket-guide.pdf', 842500, 'application/pdf', 'seed/resources/travel-english-pocket-guide.pdf', '/uploads/seed/resources/travel-english-pocket-guide.pdf', NOW(6), NOW(6)),
    (24, 911501, 'PDF', 'Cẩm nang cấu trúc Statement of Purpose đạt học bổng châu Âu', 'scholarship-sop-playbook.pdf', 1185000, 'application/pdf', 'seed/resources/scholarship-sop-playbook.pdf', '/uploads/seed/resources/scholarship-sop-playbook.pdf', NOW(6), NOW(6))
    ON DUPLICATE KEY UPDATE title = VALUES(title), file_name = VALUES(file_name), file_size = VALUES(file_size);

    INSERT INTO course_db.reviews (id, course_id, user_id, user_full_name, rating, comment, is_hidden, created_at, updated_at) VALUES
    (1, 1, @seed_u02, 'Nguyễn Văn A', 5, 'Phần chiến lược phân biệt False/Not Given và bẫy paraphrase cực kỳ sát đề Cambridge. Sau 6 tuần mình tăng Listening từ 6.5 lên 8.0.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 34 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 34 DAY)),
    (2, 1, @seed_u08, 'Võ Thảo Vy', 5, 'Khung lập luận PEEL ở chương 2 giúp mình viết Task 2 mạch lạc hẳn, không còn bị lan man như trước.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 33 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 33 DAY)),
    (3, 1, @seed_u12, 'Ngô Khánh Linh', 4, 'Nội dung chuyên sâu và nhiều tài liệu PDF hay. Mong khóa bổ sung thêm bài chữa Speaking Part 3 nữa.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 32 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 32 DAY)),
    (4, 2, @seed_u03, 'Trần Thị B', 5, 'Nhờ mẹo phân tích nhanh Part 5 và đối chiếu đoạn kép Part 7, mình thi thật đạt 875 điểm vượt mục tiêu 850+!', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 31 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 31 DAY)),
    (5, 2, @seed_u10, 'Bùi Ngọc Hân', 5, 'Bài giảng đi thẳng vào trọng tâm, ví dụ lấy sát cấu trúc ETS 2024 nên luyện đề rất tự tin.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 30 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 30 DAY)),
    (6, 2, @seed_u16, 'Phan Mỹ Duyên', 4, 'Lộ trình gọn gàng dễ theo kịp với người vừa đi học vừa đi làm. Rất đáng học.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 29 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 29 DAY)),
    (7, 3, @seed_u04, 'Lê Văn C', 5, 'Các mẫu câu họp nhóm và từ chối lịch hẹn tinh tế áp dụng ngay được ở công ty. Sếp người Úc khen giao tiếp tự nhiên hơn hẳn.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 28 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 28 DAY)),
    (8, 3, @seed_u09, 'Đặng Quốc Bảo', 5, 'Phần Small Talk theo công thức A.R.E siêu thực tế, không còn lúng túng 2 phút đầu cuộc gọi Zoom.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 27 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 27 DAY)),
    (9, 4, @seed_u06, 'Hoàng Văn E', 5, 'Hiếm có khóa tiếng Anh nào hiểu đúng ngữ cảnh lập trình viên như vậy: Daily Stand-up, PR comment đến System Design đều rất thực chiến.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 26 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 26 DAY)),
    (10, 4, @seed_u11, 'Đỗ Gia Huy', 5, 'Nhờ bài luyện phỏng vấn kỹ thuật và từ vựng trade-offs mà mình vừa vượt qua vòng Technical Interview công ty product Singapore.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY)),
    (11, 4, @seed_u17, 'Vũ Đức Thịnh', 4, 'Tài liệu Code Review phrases rất hữu ích cho team làm việc remote với khách hàng nước ngoài.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 24 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 24 DAY)),
    (12, 5, @seed_u02, 'Nguyễn Văn A', 5, 'Khóa miễn phí mà biên soạn cực kỳ chỉn chu! Sơ đồ trục thời gian 12 thì giúp mình hiểu bản chất chứ không phải học vẹt.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 23 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 23 DAY)),
    (13, 5, @seed_u13, 'Dương Tuấn Kiệt', 5, 'Mình bị mất gốc ngữ pháp khá lâu nhưng học hết chương 1–2 đã tự tin ghép câu đúng thì và viết đoạn ngắn chuẩn chỉnh.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY)),
    (14, 6, @seed_u07, 'Nguyễn Minh Khôi', 5, 'Trước đây mình hay nuốt ending sounds và nhầm /iː/ với /ɪ/. Luyện theo bảng khẩu hình IPA 3 tuần thấy phát âm rõ ràng hơn nhiều.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 21 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 21 DAY)),
    (15, 6, @seed_u16, 'Phan Mỹ Duyên', 5, 'Phần giải thích nối âm và âm yếu giúp mình không chỉ nói chuẩn hơn mà nghe cũng bắt từ nhanh hơn.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY)),
    (16, 7, @seed_u08, 'Võ Thảo Vy', 5, 'Cách hướng dẫn viết Overview cho Task 1 cực kỳ dễ hiểu, biết cách gom nhóm số liệu thay vì kể lể rời rạc.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 19 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 19 DAY)),
    (17, 7, @seed_u14, 'Lý Thanh Trúc', 4, 'Rất thích phần phân tích bài mẫu Band 7.5+ và chỉ ra lỗi diễn đạt người Việt hay mắc.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY)),
    (18, 8, @seed_u12, 'Ngô Khánh Linh', 5, 'Mình hết hẳn thói quen học thuộc văn mẫu. Kỹ thuật ghi chú 1 phút cho Cue Card Part 2 cứu mình ở phòng thi thật.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY)),
    (19, 8, @seed_u02, 'Nguyễn Văn A', 5, 'Các cụm Hedging cho Part 3 rất tự nhiên, nói nghe học thuật mà không bị gượng.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (20, 9, @seed_u10, 'Bùi Ngọc Hân', 5, 'Kết hợp cả 4 kỹ năng rất phù hợp với yêu cầu tuyển dụng hiện nay. Phần viết email TOEIC Writing hướng dẫn cực chi tiết.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (21, 9, @seed_u18, 'Đinh Lan Anh', 4, 'Từ vựng chủ đề nhân sự và hợp đồng rất gần với công việc thực tế của mình.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (22, 10, @seed_u09, 'Đặng Quốc Bảo', 5, 'Nguyên tắc viết email BLUF làm thay đổi hoàn toàn cách mình trao đổi với đối tác. Đồng nghiệp phản hồi nhanh hơn hẳn.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (23, 10, @seed_u15, 'Trương Hoàng Nam', 5, 'Bộ 25 mẫu email và cụm từ chuyển ý khi thuyết trình quá giá trị cho người đi làm.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (24, 11, @seed_u07, 'Nguyễn Minh Khôi', 5, 'Kết hợp khóa này với phòng luyện Dictation trên ChitChatGo mỗi tối 20 phút, trình độ nghe cải thiện rõ rệt sau 1 tháng.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (25, 11, @seed_u16, 'Phan Mỹ Duyên', 5, 'Bài giải mã Weak Forms thực sự mở mang, giờ mình hiểu vì sao trước kia đọc transcript biết hết mà nghe không ra.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (26, 12, @seed_u10, 'Bùi Ngọc Hân', 5, 'Kỹ thuật giải phẫu câu dài giúp mình đọc báo The Economist và tài liệu chuyên ngành đỡ nản hơn rất nhiều.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (27, 12, @seed_u14, 'Lý Thanh Trúc', 4, 'Chủ đề bài đọc chọn lọc hiện đại, có chú giải ngữ pháp rất kỹ.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (28, 13, @seed_u11, 'Đỗ Gia Huy', 5, 'Sửa lại CV theo mẫu ATS và luyện trả lời theo STAR giúp mình nhận được 2 offer từ công ty nước ngoài!', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (29, 13, @seed_u18, 'Đinh Lan Anh', 5, 'Cách kể chuyện xử lý xung đột theo STAR rất thuyết phục, mình dùng cả khi phỏng vấn vị trí HRBP.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (30, 14, @seed_u15, 'Trương Hoàng Nam', 5, 'Vừa dùng ngay các mẫu câu hải quan và khách sạn trong chuyến công tác Singapore tuần rồi, cực kỳ hữu ích!', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (31, 15, @seed_u14, 'Lý Thanh Trúc', 5, 'Bài học về tìm sợi chỉ đỏ trong SOP và viết cold email cho giáo sư quá xuất sắc, giúp mình hoàn thiện hồ sơ học bổng đúng hạn.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    (32, 16, @seed_u13, 'Dương Tuấn Kiệt', 3, 'Đánh giá kiểm thử trạng thái ẩn (is_hidden = TRUE) cho màn hình kiểm duyệt admin.', TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (33, 16, @seed_u07, 'Nguyễn Minh Khôi', 5, 'Khóa nhập môn dễ hiểu, tốc độ giảng vừa phải và có ví dụ thực tế nên người mới bắt đầu không bị ngợp.', FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY))
    ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), is_hidden = VALUES(is_hidden), user_full_name = VALUES(user_full_name);

    -- =========================================================================
    -- 3. LEARNING_DB
    -- =========================================================================
    IF EXISTS (SELECT 1 FROM learning_db.enrollments
        WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20)
            AND NOT ((id <=> 1 AND user_id <=> @seed_u02 AND course_id <=> 1)
                OR (id <=> 2 AND user_id <=> @seed_u02 AND course_id <=> 5)
                OR (id <=> 3 AND user_id <=> @seed_u03 AND course_id <=> 2)
                OR (id <=> 4 AND user_id <=> @seed_u04 AND course_id <=> 3)
                OR (id <=> 5 AND user_id <=> @seed_u06 AND course_id <=> 4)
                OR (id <=> 6 AND user_id <=> @seed_u07 AND course_id <=> 6)
                OR (id <=> 7 AND user_id <=> @seed_u08 AND course_id <=> 7)
                OR (id <=> 8 AND user_id <=> @seed_u09 AND course_id <=> 10)
                OR (id <=> 9 AND user_id <=> @seed_u10 AND course_id <=> 9)
                OR (id <=> 10 AND user_id <=> @seed_u11 AND course_id <=> 13)
                OR (id <=> 11 AND user_id <=> @seed_u12 AND course_id <=> 8)
                OR (id <=> 12 AND user_id <=> @seed_u14 AND course_id <=> 15)
                OR (id <=> 13 AND user_id <=> @seed_u15 AND course_id <=> 14)
                OR (id <=> 14 AND user_id <=> @seed_u17 AND course_id <=> 4)
                OR (id <=> 15 AND user_id <=> @seed_u18 AND course_id <=> 13)
                OR (id <=> 16 AND user_id <=> @seed_u10 AND course_id <=> 12)
                OR (id <=> 17 AND user_id <=> @seed_u08 AND course_id <=> 1)
                OR (id <=> 18 AND user_id <=> @seed_u13 AND course_id <=> 16)
                OR (id <=> 19 AND user_id <=> @seed_u16 AND course_id <=> 11)
                OR (id <=> 20 AND user_id <=> @seed_u02 AND course_id <=> 8))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.enrollments; no data was changed';
    END IF;

    IF EXISTS (SELECT 1 FROM learning_db.enrollments WHERE (user_id <=> @seed_u02 AND course_id <=> 1 AND id <> 1)
        OR (user_id <=> @seed_u02 AND course_id <=> 5 AND id <> 2)
        OR (user_id <=> @seed_u03 AND course_id <=> 2 AND id <> 3)
        OR (user_id <=> @seed_u04 AND course_id <=> 3 AND id <> 4)
        OR (user_id <=> @seed_u06 AND course_id <=> 4 AND id <> 5)
        OR (user_id <=> @seed_u07 AND course_id <=> 6 AND id <> 6)
        OR (user_id <=> @seed_u08 AND course_id <=> 7 AND id <> 7)
        OR (user_id <=> @seed_u09 AND course_id <=> 10 AND id <> 8)
        OR (user_id <=> @seed_u10 AND course_id <=> 9 AND id <> 9)
        OR (user_id <=> @seed_u11 AND course_id <=> 13 AND id <> 10)
        OR (user_id <=> @seed_u12 AND course_id <=> 8 AND id <> 11)
        OR (user_id <=> @seed_u14 AND course_id <=> 15 AND id <> 12)
        OR (user_id <=> @seed_u15 AND course_id <=> 14 AND id <> 13)
        OR (user_id <=> @seed_u17 AND course_id <=> 4 AND id <> 14)
        OR (user_id <=> @seed_u18 AND course_id <=> 13 AND id <> 15)
        OR (user_id <=> @seed_u10 AND course_id <=> 12 AND id <> 16)
        OR (user_id <=> @seed_u08 AND course_id <=> 1 AND id <> 17)
        OR (user_id <=> @seed_u13 AND course_id <=> 16 AND id <> 18)
        OR (user_id <=> @seed_u16 AND course_id <=> 11 AND id <> 19)
        OR (user_id <=> @seed_u02 AND course_id <=> 8 AND id <> 20)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed natural key collision in learning_db.enrollments; no data was changed';
    END IF;

    INSERT INTO learning_db.enrollments (id, user_id, course_id, source_order_code, access_source, status, enrolled_at, completed_at, last_accessed_at) VALUES
    (1, @seed_u02, 1, 'ORD-2026-0001', 'COURSE', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY), NULL, '2026-10-20 08:00:00'),
    (2, @seed_u02, 5, NULL, 'COURSE', 'COMPLETED', DATE_SUB('2026-10-20 08:00:00', INTERVAL 30 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), '2026-10-20 08:00:00'),
    (3, @seed_u03, 2, 'ORD-2026-0002', 'COURSE', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY), NULL, '2026-10-20 08:00:00'),
    (4, @seed_u04, 3, 'ORD-2026-0003', 'COURSE', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY), NULL, '2026-10-20 08:00:00'),
    (5, @seed_u06, 4, 'ORD-2026-0004', 'COURSE', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY), NULL, '2026-10-20 08:00:00'),
    (6, @seed_u07, 6, 'ORD-2026-0006', 'COURSE', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY), NULL, '2026-10-20 08:00:00'),
    (7, @seed_u08, 7, 'ORD-2026-0007', 'COURSE', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), NULL, '2026-10-20 08:00:00'),
    (8, @seed_u09, 10, 'ORD-2026-0008', 'COURSE', 'COMPLETED', DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY), '2026-10-20 08:00:00'),
    (9, @seed_u10, 9, 'ORD-2026-0009', 'COURSE', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), NULL, '2026-10-20 08:00:00'),
    (10, @seed_u11, 13, 'ORD-2026-0010', 'COURSE', 'COMPLETED', DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY), '2026-10-20 08:00:00'),
    (11, @seed_u12, 8, 'ORD-2026-0011', 'COURSE', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), NULL, '2026-10-20 08:00:00'),
    (12, @seed_u14, 15, 'ORD-2026-0012', 'COURSE', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), NULL, '2026-10-20 08:00:00'),
    (13, @seed_u15, 14, 'ORD-2026-0013', 'COURSE', 'COMPLETED', DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), '2026-10-20 08:00:00'),
    (14, @seed_u17, 4, 'ORD-2026-0014', 'COURSE', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), NULL, '2026-10-20 08:00:00'),
    (15, @seed_u18, 13, 'ORD-2026-0015', 'COURSE', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), NULL, '2026-10-20 08:00:00'),
    (16, @seed_u10, 12, 'ORD-2026-0016', 'COURSE', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), NULL, '2026-10-20 08:00:00'),
    (17, @seed_u08, 1, 'ORD-2026-0017', 'COURSE', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), NULL, '2026-10-20 08:00:00'),
    (18, @seed_u13, 16, NULL, 'COURSE', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), NULL, '2026-10-20 08:00:00'),
    (19, @seed_u16, 11, NULL, 'COURSE', 'COMPLETED', DATE_SUB('2026-10-20 08:00:00', INTERVAL 19 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), '2026-10-20 08:00:00'),
    (20, @seed_u02, 8, NULL, 'PRO', 'ACTIVE', DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), NULL, '2026-10-20 08:00:00')
    ON DUPLICATE KEY UPDATE status = VALUES(status), source_order_code = VALUES(source_order_code), access_source = VALUES(access_source);

    INSERT INTO learning_db.payment_enrollment_receipts (order_code, user_id, course_id, created_at) VALUES
    ('ORD-2026-0001', @seed_u02, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY)),
    ('ORD-2026-0002', @seed_u03, 2, DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY)),
    ('ORD-2026-0003', @seed_u04, 3, DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY)),
    ('ORD-2026-0004', @seed_u06, 4, DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY)),
    ('ORD-2026-0006', @seed_u07, 6, DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY)),
    ('ORD-2026-0007', @seed_u08, 7, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    ('ORD-2026-0008', @seed_u09, 10, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    ('ORD-2026-0009', @seed_u10, 9, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    ('ORD-2026-0010', @seed_u11, 13, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    ('ORD-2026-0011', @seed_u12, 8, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    ('ORD-2026-0012', @seed_u14, 15, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    ('ORD-2026-0013', @seed_u15, 14, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    ('ORD-2026-0014', @seed_u17, 4, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    ('ORD-2026-0015', @seed_u18, 13, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    ('ORD-2026-0016', @seed_u10, 12, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    ('ORD-2026-0017', @seed_u08, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY))
    ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), course_id = VALUES(course_id);

    IF EXISTS (SELECT 1 FROM learning_db.lesson_progress
        WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26)
            AND NOT ((id <=> 1 AND user_id <=> @seed_u02 AND course_id <=> 1 AND lesson_id <=> 910101)
                OR (id <=> 2 AND user_id <=> @seed_u02 AND course_id <=> 1 AND lesson_id <=> 910102)
                OR (id <=> 3 AND user_id <=> @seed_u03 AND course_id <=> 2 AND lesson_id <=> 910201)
                OR (id <=> 4 AND user_id <=> @seed_u04 AND course_id <=> 3 AND lesson_id <=> 910301)
                OR (id <=> 5 AND user_id <=> @seed_u06 AND course_id <=> 4 AND lesson_id <=> 910401)
                OR (id <=> 6 AND user_id <=> @seed_u02 AND course_id <=> 5 AND lesson_id <=> 910501)
                OR (id <=> 7 AND user_id <=> @seed_u02 AND course_id <=> 5 AND lesson_id <=> 910502)
                OR (id <=> 8 AND user_id <=> @seed_u02 AND course_id <=> 5 AND lesson_id <=> 910503)
                OR (id <=> 9 AND user_id <=> @seed_u03 AND course_id <=> 2 AND lesson_id <=> 910202)
                OR (id <=> 10 AND user_id <=> @seed_u06 AND course_id <=> 4 AND lesson_id <=> 910402)
                OR (id <=> 11 AND user_id <=> @seed_u07 AND course_id <=> 6 AND lesson_id <=> 910601)
                OR (id <=> 12 AND user_id <=> @seed_u07 AND course_id <=> 6 AND lesson_id <=> 910602)
                OR (id <=> 13 AND user_id <=> @seed_u08 AND course_id <=> 7 AND lesson_id <=> 910701)
                OR (id <=> 14 AND user_id <=> @seed_u08 AND course_id <=> 1 AND lesson_id <=> 910101)
                OR (id <=> 15 AND user_id <=> @seed_u09 AND course_id <=> 10 AND lesson_id <=> 911001)
                OR (id <=> 16 AND user_id <=> @seed_u09 AND course_id <=> 10 AND lesson_id <=> 911002)
                OR (id <=> 17 AND user_id <=> @seed_u10 AND course_id <=> 9 AND lesson_id <=> 910901)
                OR (id <=> 18 AND user_id <=> @seed_u10 AND course_id <=> 12 AND lesson_id <=> 911201)
                OR (id <=> 19 AND user_id <=> @seed_u11 AND course_id <=> 13 AND lesson_id <=> 911301)
                OR (id <=> 20 AND user_id <=> @seed_u12 AND course_id <=> 8 AND lesson_id <=> 910801)
                OR (id <=> 21 AND user_id <=> @seed_u13 AND course_id <=> 16 AND lesson_id <=> 911601)
                OR (id <=> 22 AND user_id <=> @seed_u14 AND course_id <=> 15 AND lesson_id <=> 911501)
                OR (id <=> 23 AND user_id <=> @seed_u15 AND course_id <=> 14 AND lesson_id <=> 911401)
                OR (id <=> 24 AND user_id <=> @seed_u16 AND course_id <=> 11 AND lesson_id <=> 911101)
                OR (id <=> 25 AND user_id <=> @seed_u17 AND course_id <=> 4 AND lesson_id <=> 910401)
                OR (id <=> 26 AND user_id <=> @seed_u18 AND course_id <=> 13 AND lesson_id <=> 911301))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.lesson_progress; no data was changed';
    END IF;

    IF EXISTS (SELECT 1 FROM learning_db.lesson_progress WHERE (user_id <=> @seed_u02 AND lesson_id <=> 910101 AND id <> 1)
        OR (user_id <=> @seed_u02 AND lesson_id <=> 910102 AND id <> 2)
        OR (user_id <=> @seed_u03 AND lesson_id <=> 910201 AND id <> 3)
        OR (user_id <=> @seed_u04 AND lesson_id <=> 910301 AND id <> 4)
        OR (user_id <=> @seed_u06 AND lesson_id <=> 910401 AND id <> 5)
        OR (user_id <=> @seed_u02 AND lesson_id <=> 910501 AND id <> 6)
        OR (user_id <=> @seed_u02 AND lesson_id <=> 910502 AND id <> 7)
        OR (user_id <=> @seed_u02 AND lesson_id <=> 910503 AND id <> 8)
        OR (user_id <=> @seed_u03 AND lesson_id <=> 910202 AND id <> 9)
        OR (user_id <=> @seed_u06 AND lesson_id <=> 910402 AND id <> 10)
        OR (user_id <=> @seed_u07 AND lesson_id <=> 910601 AND id <> 11)
        OR (user_id <=> @seed_u07 AND lesson_id <=> 910602 AND id <> 12)
        OR (user_id <=> @seed_u08 AND lesson_id <=> 910701 AND id <> 13)
        OR (user_id <=> @seed_u08 AND lesson_id <=> 910101 AND id <> 14)
        OR (user_id <=> @seed_u09 AND lesson_id <=> 911001 AND id <> 15)
        OR (user_id <=> @seed_u09 AND lesson_id <=> 911002 AND id <> 16)
        OR (user_id <=> @seed_u10 AND lesson_id <=> 910901 AND id <> 17)
        OR (user_id <=> @seed_u10 AND lesson_id <=> 911201 AND id <> 18)
        OR (user_id <=> @seed_u11 AND lesson_id <=> 911301 AND id <> 19)
        OR (user_id <=> @seed_u12 AND lesson_id <=> 910801 AND id <> 20)
        OR (user_id <=> @seed_u13 AND lesson_id <=> 911601 AND id <> 21)
        OR (user_id <=> @seed_u14 AND lesson_id <=> 911501 AND id <> 22)
        OR (user_id <=> @seed_u15 AND lesson_id <=> 911401 AND id <> 23)
        OR (user_id <=> @seed_u16 AND lesson_id <=> 911101 AND id <> 24)
        OR (user_id <=> @seed_u17 AND lesson_id <=> 910401 AND id <> 25)
        OR (user_id <=> @seed_u18 AND lesson_id <=> 911301 AND id <> 26)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed natural key collision in learning_db.lesson_progress; no data was changed';
    END IF;

    INSERT INTO learning_db.lesson_progress (id, user_id, course_id, lesson_id, status, progress_percent, time_spent_seconds, first_accessed_at, completed_at) VALUES
    (1, @seed_u02, 1, 910101, 'COMPLETED', 100, 1800, DATE_SUB('2026-10-20 08:00:00', INTERVAL 24 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 23 DAY)),
    (2, @seed_u02, 1, 910102, 'IN_PROGRESS', 65, 1200, DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY), NULL),
    (3, @seed_u03, 2, 910201, 'COMPLETED', 100, 2400, DATE_SUB('2026-10-20 08:00:00', INTERVAL 21 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY)),
    (4, @seed_u04, 3, 910301, 'IN_PROGRESS', 40, 800, DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY), NULL),
    (5, @seed_u06, 4, 910401, 'COMPLETED', 100, 2100, DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (6, @seed_u02, 5, 910501, 'COMPLETED', 100, 1500, DATE_SUB('2026-10-20 08:00:00', INTERVAL 28 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 27 DAY)),
    (7, @seed_u02, 5, 910502, 'COMPLETED', 100, 1320, DATE_SUB('2026-10-20 08:00:00', INTERVAL 26 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY)),
    (8, @seed_u02, 5, 910503, 'COMPLETED', 100, 1440, DATE_SUB('2026-10-20 08:00:00', INTERVAL 24 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 23 DAY)),
    (9, @seed_u03, 2, 910202, 'IN_PROGRESS', 55, 980, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), NULL),
    (10, @seed_u06, 4, 910402, 'IN_PROGRESS', 70, 1100, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), NULL),
    (11, @seed_u07, 6, 910601, 'COMPLETED', 100, 1200, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (12, @seed_u07, 6, 910602, 'IN_PROGRESS', 50, 640, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), NULL),
    (13, @seed_u08, 7, 910701, 'COMPLETED', 100, 1860, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (14, @seed_u08, 1, 910101, 'COMPLETED', 100, 1620, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (15, @seed_u09, 10, 911001, 'COMPLETED', 100, 1300, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (16, @seed_u09, 10, 911002, 'COMPLETED', 100, 1450, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (17, @seed_u10, 9, 910901, 'COMPLETED', 100, 1680, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (18, @seed_u10, 12, 911201, 'IN_PROGRESS', 45, 720, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), NULL),
    (19, @seed_u11, 13, 911301, 'COMPLETED', 100, 1500, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (20, @seed_u12, 8, 910801, 'COMPLETED', 100, 1400, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (21, @seed_u13, 16, 911601, 'COMPLETED', 100, 1050, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (22, @seed_u14, 15, 911501, 'IN_PROGRESS', 60, 1240, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), NULL),
    (23, @seed_u15, 14, 911401, 'COMPLETED', 100, 1120, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (24, @seed_u16, 11, 911101, 'COMPLETED', 100, 1380, DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY)),
    (25, @seed_u17, 4, 910401, 'IN_PROGRESS', 35, 540, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), NULL),
    (26, @seed_u18, 13, 911301, 'NOT_STARTED', 0, 0, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), NULL)
    ON DUPLICATE KEY UPDATE status = VALUES(status), progress_percent = VALUES(progress_percent);

    IF EXISTS (SELECT 1 FROM learning_db.quizzes
        WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16)
            AND NOT ((id <=> 1 AND course_id <=> 1 AND title <=> 'IELTS Listening & Reading Mini-Test 1')
                OR (id <=> 2 AND course_id <=> 2 AND title <=> 'TOEIC Part 5 Grammar & Vocab Check')
                OR (id <=> 3 AND course_id <=> 3 AND title <=> 'Business Communication Fluency Quiz')
                OR (id <=> 4 AND course_id <=> 4 AND title <=> 'Technical Terms for Software Engineering')
                OR (id <=> 5 AND course_id <=> 5 AND title <=> 'Tenses & Basic Sentence Structure Review')
                OR (id <=> 6 AND course_id <=> 6 AND title <=> 'Kiểm tra nhận diện 44 âm IPA & Trọng âm')
                OR (id <=> 7 AND course_id <=> 7 AND title <=> 'IELTS Writing Task 1 & 2 Cohesion Check')
                OR (id <=> 8 AND course_id <=> 8 AND title <=> 'IELTS Speaking Idioms & Hedging Practice')
                OR (id <=> 9 AND course_id <=> 9 AND title <=> 'TOEIC 4 Kỹ năng – Từ vựng Doanh nghiệp')
                OR (id <=> 10 AND course_id <=> 10 AND title <=> 'Business Email & Presentation Etiquette')
                OR (id <=> 11 AND course_id <=> 11 AND title <=> 'Weak Forms & Connected Speech Check')
                OR (id <=> 12 AND course_id <=> 12 AND title <=> 'Academic Reading Inference & Clause Analysis')
                OR (id <=> 13 AND course_id <=> 13 AND title <=> 'STAR Behavioral Interview Mastery Quiz')
                OR (id <=> 14 AND course_id <=> 14 AND title <=> 'Travel & Business Trip Situations Quiz')
                OR (id <=> 15 AND course_id <=> 15 AND title <=> 'Scholarship SOP & Academic Correspondence')
                OR (id <=> 16 AND course_id <=> 16 AND title <=> 'Kiểm tra đầu ra Tiếng Anh A2 Nền tảng'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quizzes; no data was changed';
    END IF;

    INSERT INTO learning_db.quizzes (id, course_id, lesson_id, title, description, passing_score, time_limit_minutes, published, created_at) VALUES
    (1, 1, 910102, 'IELTS Listening & Reading Mini-Test 1', 'Kiểm tra kỹ năng nghe nhận diện bẫy từ vựng và đọc lướt tìm ý chính.', 70, 30, TRUE, '2026-10-01 08:00:00'),
    (2, 2, 910201, 'TOEIC Part 5 Grammar & Vocab Check', 'Đánh giá khả năng chọn dạng từ, liên từ và cấu trúc mệnh đề.', 75, 20, TRUE, '2026-10-01 08:00:00'),
    (3, 3, 910301, 'Business Communication Fluency Quiz', 'Thực hành các tình huống hội thoại thường gặp nơi công sở.', 80, 15, TRUE, '2026-10-01 08:00:00'),
    (4, 4, 910401, 'Technical Terms for Software Engineering', 'Kiểm tra nghĩa và cách dùng thuật ngữ Agile, DevOps, Microservices.', 70, 25, TRUE, '2026-10-01 08:00:00'),
    (5, 5, 910501, 'Tenses & Basic Sentence Structure Review', 'Ôn tập 12 thì tiếng Anh và cấu trúc câu chủ động / bị động.', 70, 20, TRUE, '2026-10-01 08:00:00'),
    (6, 6, 910601, 'Kiểm tra nhận diện 44 âm IPA & Trọng âm', 'Phân biệt các cặp nguyên âm dễ nhầm và quy tắc đọc đuôi -ed, -s.', 75, 15, TRUE, '2026-10-01 08:00:00'),
    (7, 7, 910701, 'IELTS Writing Task 1 & 2 Cohesion Check', 'Đánh giá cách viết Overview và sử dụng từ nối học thuật chuẩn xác.', 70, 25, TRUE, '2026-10-01 08:00:00'),
    (8, 8, 910801, 'IELTS Speaking Idioms & Hedging Practice', 'Chọn diễn đạt tự nhiên phù hợp ngữ cảnh Speaking Part 1–3.', 75, 15, TRUE, '2026-10-01 08:00:00'),
    (9, 9, 910901, 'TOEIC 4 Kỹ năng – Từ vựng Doanh nghiệp', 'Kiểm tra từ vựng hợp đồng, nhân sự và văn phong viết email TOEIC.', 70, 20, TRUE, '2026-10-01 08:00:00'),
    (10, 10, 911001, 'Business Email & Presentation Etiquette', 'Áp dụng nguyên tắc BLUF và ngôn ngữ chuyển ý trong thuyết trình.', 80, 20, TRUE, '2026-10-01 08:00:00'),
    (11, 11, 911101, 'Weak Forms & Connected Speech Check', 'Nhận diện hiện tượng nối âm và đọc lướt trong hội thoại bản xứ.', 70, 15, TRUE, '2026-10-01 08:00:00'),
    (12, 12, 911201, 'Academic Reading Inference & Clause Analysis', 'Phân tích mệnh đề chính – phụ và suy luận thái độ tác giả.', 75, 25, TRUE, '2026-10-01 08:00:00'),
    (13, 13, 911301, 'STAR Behavioral Interview Mastery Quiz', 'Đánh giá cách viết CV định lượng và trả lời câu hỏi phỏng vấn hành vi.', 75, 20, TRUE, '2026-10-01 08:00:00'),
    (14, 14, 911401, 'Travel & Business Trip Situations Quiz', 'Xử lý các tình huống thực tế tại sân bay, hải quan và khách sạn.', 70, 15, TRUE, '2026-10-01 08:00:00'),
    (15, 15, 911501, 'Scholarship SOP & Academic Correspondence', 'Kiểm tra nguyên tắc viết Statement of Purpose và email cho giáo sư.', 75, 25, TRUE, '2026-10-01 08:00:00'),
    (16, 16, 911601, 'Kiểm tra đầu ra Tiếng Anh A2 Nền tảng', 'Tổng hợp động từ To Be, hiện tại đơn và mẫu câu giao tiếp cơ bản.', 70, 15, TRUE, '2026-10-01 08:00:00')
    ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), passing_score = VALUES(passing_score);

    IF EXISTS (SELECT 1 FROM learning_db.quiz_questions
        WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32)
            AND NOT ((id <=> 1 AND quiz_id <=> 1 AND position <=> 1)
                OR (id <=> 2 AND quiz_id <=> 2 AND position <=> 1)
                OR (id <=> 3 AND quiz_id <=> 3 AND position <=> 1)
                OR (id <=> 4 AND quiz_id <=> 4 AND position <=> 1)
                OR (id <=> 5 AND quiz_id <=> 5 AND position <=> 1)
                OR (id <=> 6 AND quiz_id <=> 6 AND position <=> 1)
                OR (id <=> 7 AND quiz_id <=> 7 AND position <=> 1)
                OR (id <=> 8 AND quiz_id <=> 8 AND position <=> 1)
                OR (id <=> 9 AND quiz_id <=> 9 AND position <=> 1)
                OR (id <=> 10 AND quiz_id <=> 10 AND position <=> 1)
                OR (id <=> 11 AND quiz_id <=> 11 AND position <=> 1)
                OR (id <=> 12 AND quiz_id <=> 12 AND position <=> 1)
                OR (id <=> 13 AND quiz_id <=> 13 AND position <=> 1)
                OR (id <=> 14 AND quiz_id <=> 14 AND position <=> 1)
                OR (id <=> 15 AND quiz_id <=> 15 AND position <=> 1)
                OR (id <=> 16 AND quiz_id <=> 16 AND position <=> 1)
                OR (id <=> 17 AND quiz_id <=> 1 AND position <=> 2)
                OR (id <=> 18 AND quiz_id <=> 2 AND position <=> 2)
                OR (id <=> 19 AND quiz_id <=> 3 AND position <=> 2)
                OR (id <=> 20 AND quiz_id <=> 4 AND position <=> 2)
                OR (id <=> 21 AND quiz_id <=> 5 AND position <=> 2)
                OR (id <=> 22 AND quiz_id <=> 6 AND position <=> 2)
                OR (id <=> 23 AND quiz_id <=> 7 AND position <=> 2)
                OR (id <=> 24 AND quiz_id <=> 8 AND position <=> 2)
                OR (id <=> 25 AND quiz_id <=> 9 AND position <=> 2)
                OR (id <=> 26 AND quiz_id <=> 10 AND position <=> 2)
                OR (id <=> 27 AND quiz_id <=> 11 AND position <=> 2)
                OR (id <=> 28 AND quiz_id <=> 12 AND position <=> 2)
                OR (id <=> 29 AND quiz_id <=> 13 AND position <=> 2)
                OR (id <=> 30 AND quiz_id <=> 14 AND position <=> 2)
                OR (id <=> 31 AND quiz_id <=> 15 AND position <=> 2)
                OR (id <=> 32 AND quiz_id <=> 16 AND position <=> 2))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quiz_questions; no data was changed';
    END IF;

    INSERT INTO learning_db.quiz_questions (id, quiz_id, question_text, question_type, points, position) VALUES
    (1, 1, 'Which word is the synonym of "crucial" in IELTS Academic reading?', 'SINGLE_CHOICE', 1, 1),
    (2, 2, 'The manager requested that all employees _____ the training session.', 'SINGLE_CHOICE', 1, 1),
    (3, 3, 'How should you professionally decline a meeting due to a schedule conflict?', 'SINGLE_CHOICE', 1, 1),
    (4, 4, 'What does "CI/CD" stand for in software engineering?', 'SINGLE_CHOICE', 1, 1),
    (5, 5, 'Identify the correct passive sentence: "They built this bridge in 2020."', 'SINGLE_CHOICE', 1, 1),
    (6, 6, 'Which word ends with the /ɪd/ pronunciation for "-ed"?', 'SINGLE_CHOICE', 1, 1),
    (7, 7, 'What should be avoided in an IELTS Writing Task 1 Overview paragraph?', 'SINGLE_CHOICE', 1, 1),
    (8, 8, 'Which phrase is an example of natural hedging in IELTS Speaking Part 3?', 'SINGLE_CHOICE', 1, 1),
    (9, 9, 'All shipment invoices must be submitted _____ to the accounting department.', 'SINGLE_CHOICE', 1, 1),
    (10, 10, 'What does the "BLUF" principle stand for in professional email writing?', 'SINGLE_CHOICE', 1, 1),
    (11, 11, 'In natural connected speech, how is "check it out" typically linked?', 'SINGLE_CHOICE', 1, 1),
    (12, 12, 'Which signal word usually introduces a contrasting viewpoint in academic articles?', 'SINGLE_CHOICE', 1, 1),
    (13, 13, 'In the STAR interview framework, what does the letter "R" stand for?', 'SINGLE_CHOICE', 1, 1),
    (14, 14, 'What is the most polite way to ask for a different hotel room?', 'SINGLE_CHOICE', 1, 1),
    (15, 15, 'What is the primary purpose of a Statement of Purpose (SOP)?', 'SINGLE_CHOICE', 1, 1),
    (16, 16, 'Choose the correct Present Simple sentence for a daily routine:', 'SINGLE_CHOICE', 1, 1),
    (17, 1, 'In IELTS Reading, when should you choose "NOT GIVEN"?', 'SINGLE_CHOICE', 1, 2),
    (18, 2, '_____ the heavy rain, the outdoor product launch proceeded on schedule.', 'SINGLE_CHOICE', 1, 2),
    (19, 3, 'Which phrase smoothly checks alignment at the end of a team meeting?', 'SINGLE_CHOICE', 1, 2),
    (20, 4, 'In a code review, what does the prefix "Nit:" usually mean?', 'SINGLE_CHOICE', 1, 2),
    (21, 5, 'Which sentence correctly uses the Present Perfect tense?', 'SINGLE_CHOICE', 1, 2),
    (22, 6, 'Which pair of words illustrates the /iː/ vs /ɪ/ vowel contrast?', 'SINGLE_CHOICE', 1, 2),
    (23, 7, 'What does the "E" in the PEEL body paragraph structure stand for?', 'SINGLE_CHOICE', 1, 2),
    (24, 8, 'How long are you given to prepare notes for IELTS Speaking Part 2?', 'SINGLE_CHOICE', 1, 2),
    (25, 9, 'Please find the updated service agreement _____ to this email.', 'SINGLE_CHOICE', 1, 2),
    (26, 10, 'Which signposting phrase transitions cleanly to the next slide?', 'SINGLE_CHOICE', 1, 2),
    (27, 11, 'Which shadowing habit builds natural rhythm fastest?', 'SINGLE_CHOICE', 1, 2),
    (28, 12, 'What is the best first step when reading a complex 40-word academic sentence?', 'SINGLE_CHOICE', 1, 2),
    (29, 13, 'Which CV bullet point is strongest for ATS and hiring managers?', 'SINGLE_CHOICE', 1, 2),
    (30, 14, 'What does an immigration officer mean by "What is the purpose of your visit?"', 'SINGLE_CHOICE', 1, 2),
    (31, 15, 'How long should a cold email to a prospective thesis supervisor ideally be?', 'SINGLE_CHOICE', 1, 2),
    (32, 16, 'Choose the correct question form in Present Simple:', 'SINGLE_CHOICE', 1, 2)
    ON DUPLICATE KEY UPDATE question_text = VALUES(question_text);

    IF EXISTS (SELECT 1 FROM learning_db.quiz_options
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND question_id <=> 1 AND position <=> 1)
                OR (id <=> 2 AND question_id <=> 2 AND position <=> 1)
                OR (id <=> 3 AND question_id <=> 3 AND position <=> 1)
                OR (id <=> 4 AND question_id <=> 4 AND position <=> 1)
                OR (id <=> 5 AND question_id <=> 5 AND position <=> 1))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quiz_options; no data was changed';
    END IF;

    INSERT INTO learning_db.quiz_options (id, question_id, option_text, correct, position) VALUES
    (1, 1, 'Vital / Essential', TRUE, 1),
    (2, 2, 'attend', TRUE, 1),
    (3, 3, 'I apologize, but I have a prior commitment at that time. Could we reschedule?', TRUE, 1),
    (4, 4, 'Continuous Integration and Continuous Deployment', TRUE, 1),
    (5, 5, 'This bridge was built in 2020.', TRUE, 1),
    (6, 1, 'Optional / Minor', FALSE, 2),
    (7, 1, 'Temporary / Brief', FALSE, 3),
    (8, 1, 'Uncertain / Vague', FALSE, 4),
    (9, 2, 'attended', FALSE, 2),
    (10, 2, 'attending', FALSE, 3),
    (11, 2, 'to attend', FALSE, 4),
    (12, 3, 'I cannot come, find someone else.', FALSE, 2),
    (13, 3, 'No, I am too busy this week.', FALSE, 3),
    (14, 3, 'Just send me the notes later without asking.', FALSE, 4),
    (15, 4, 'Centralized Infrastructure and Code Debugging', FALSE, 2),
    (16, 4, 'Cloud Interface and Container Distribution', FALSE, 3),
    (17, 4, 'Code Inspection and Component Design', FALSE, 4),
    (18, 5, 'This bridge is built in 2020.', FALSE, 2),
    (19, 5, 'This bridge built in 2020.', FALSE, 3),
    (20, 5, 'This bridge has built in 2020.', FALSE, 4),
    (21, 6, 'decided', TRUE, 1),
    (22, 6, 'worked', FALSE, 2),
    (23, 6, 'played', FALSE, 3),
    (24, 6, 'watched', FALSE, 4),
    (25, 7, 'Listing specific minor numbers and exact percentages', TRUE, 1),
    (26, 7, 'Summarizing the main overall trends', FALSE, 2),
    (27, 7, 'Highlighting the highest and lowest categories', FALSE, 3),
    (28, 7, 'Comparing key changes between start and end years', FALSE, 4),
    (29, 8, 'It largely depends on the economic context of each country.', TRUE, 1),
    (30, 8, 'Every single person in the world definitely agrees with this.', FALSE, 2),
    (31, 8, 'There is zero chance that anything else could happen.', FALSE, 3),
    (32, 8, 'I memorized this exact paragraph from a book.', FALSE, 4),
    (33, 9, 'promptly', TRUE, 1),
    (34, 9, 'prompt', FALSE, 2),
    (35, 9, 'promptness', FALSE, 3),
    (36, 9, 'prompted', FALSE, 4),
    (37, 10, 'Bottom Line Up Front', TRUE, 1),
    (38, 10, 'Brief Letters Under Five lines', FALSE, 2),
    (39, 10, 'Business Language Using Formalities', FALSE, 3),
    (40, 10, 'Best Layout For Updates', FALSE, 4),
    (41, 11, 'che-ki-dout', TRUE, 1),
    (42, 11, 'check ... it ... out (with full glottal stops)', FALSE, 2),
    (43, 11, 'che-kit-tout', FALSE, 3),
    (44, 11, 'che-it-out', FALSE, 4),
    (45, 12, 'Nevertheless', TRUE, 1),
    (46, 12, 'Furthermore', FALSE, 2),
    (47, 12, 'Consequently', FALSE, 3),
    (48, 12, 'Likewise', FALSE, 4),
    (49, 13, 'Result', TRUE, 1),
    (50, 13, 'Responsibility', FALSE, 2),
    (51, 13, 'Requirement', FALSE, 3),
    (52, 13, 'Review', FALSE, 4),
    (53, 14, 'Excuse me, would it be possible to switch to a quieter room?', TRUE, 1),
    (54, 14, 'Give me another room right now.', FALSE, 2),
    (55, 14, 'This room is terrible, move my bags.', FALSE, 3),
    (56, 14, 'Why did you give me this bad room?', FALSE, 4),
    (57, 15, 'To explain your academic motivation, research fit, and future goals', TRUE, 1),
    (58, 15, 'To repeat every line of your CV word for word', FALSE, 2),
    (59, 15, 'To list your high school grades in a table', FALSE, 3),
    (60, 15, 'To request tuition fee discounts directly in paragraph one', FALSE, 4),
    (61, 16, 'She practices English for twenty minutes every evening.', TRUE, 1),
    (62, 16, 'She practice English for twenty minutes every evening.', FALSE, 2),
    (63, 16, 'She is practice English every evening.', FALSE, 3),
    (64, 16, 'She practicing English every evening.', FALSE, 4),
    (65, 17, 'When the passage provides no evidence to confirm or contradict the statement', TRUE, 1),
    (66, 17, 'When the statement directly contradicts a sentence in the passage', FALSE, 2),
    (67, 17, 'When a single word from the question is paraphrased', FALSE, 3),
    (68, 17, 'When the answer appears in the final paragraph', FALSE, 4),
    (69, 18, 'Despite', TRUE, 1),
    (70, 18, 'Although', FALSE, 2),
    (71, 18, 'Even though', FALSE, 3),
    (72, 18, 'Because', FALSE, 4),
    (73, 19, 'Just to make sure we are on the same page, let us recap the action items.', TRUE, 1),
    (74, 19, 'Okay, bye everyone.', FALSE, 2),
    (75, 19, 'I hope you remembered what I said.', FALSE, 3),
    (76, 19, 'Do whatever you think is fine.', FALSE, 4),
    (77, 20, 'A minor, non-blocking suggestion for style or readability', TRUE, 1),
    (78, 20, 'A critical security vulnerability blocking release', FALSE, 2),
    (79, 20, 'A database migration rollback command', FALSE, 3),
    (80, 20, 'A build failure in the CI pipeline', FALSE, 4),
    (81, 21, 'I have already completed three grammar modules this week.', TRUE, 1),
    (82, 21, 'I have completed three grammar modules yesterday.', FALSE, 2),
    (83, 21, 'I already completed since Monday.', FALSE, 3),
    (84, 21, 'I am completing three modules since last week.', FALSE, 4),
    (85, 22, 'leave / live', TRUE, 1),
    (86, 22, 'cat / car', FALSE, 2),
    (87, 22, 'book / boot', FALSE, 3),
    (88, 22, 'pen / pan', FALSE, 4),
    (89, 23, 'Explanation and Example', TRUE, 1),
    (90, 23, 'Ending and Editing', FALSE, 2),
    (91, 23, 'Emotion and Emphasis', FALSE, 3),
    (92, 23, 'Estimate and Equation', FALSE, 4),
    (93, 24, '1 minute', TRUE, 1),
    (94, 24, '30 seconds', FALSE, 2),
    (95, 24, '2 minutes', FALSE, 3),
    (96, 24, '3 minutes', FALSE, 4),
    (97, 25, 'attached', TRUE, 1),
    (98, 25, 'attaching', FALSE, 2),
    (99, 25, 'attachment', FALSE, 3),
    (100, 25, 'attach', FALSE, 4),
    (101, 26, 'Moving on to our Q3 revenue breakdown...', TRUE, 1),
    (102, 26, 'Next slide please, nothing else.', FALSE, 2),
    (103, 26, 'Let us stop talking about this.', FALSE, 3),
    (104, 26, 'I forgot what comes after this.', FALSE, 4),
    (105, 27, 'Imitating thought-group pauses and sentence stress alongside the speaker', TRUE, 1),
    (106, 27, 'Translating every single word into Vietnamese while listening', FALSE, 2),
    (107, 27, 'Reading silently without moving your mouth', FALSE, 3),
    (108, 27, 'Only listening once at 2x speed without checking transcripts', FALSE, 4),
    (109, 28, 'Locate the main subject and main verb before unpacking modifiers', TRUE, 1),
    (110, 28, 'Look up every adjective in the dictionary first', FALSE, 2),
    (111, 28, 'Read from the last word backward', FALSE, 3),
    (112, 28, 'Skip the sentence completely', FALSE, 4),
    (113, 29, 'Reduced API latency by 38% by indexing course catalog queries', TRUE, 1),
    (114, 29, 'Responsible for doing backend stuff on the project', FALSE, 2),
    (115, 29, 'Helped the team with coding tasks every day', FALSE, 3),
    (116, 29, 'Good at Java and SQL databases', FALSE, 4),
    (117, 30, 'Asking whether you are traveling for tourism, business, or study', TRUE, 1),
    (118, 30, 'Asking for your hotel room number', FALSE, 2),
    (119, 30, 'Asking how much your flight ticket cost', FALSE, 3),
    (120, 30, 'Asking what seat you sat in on the plane', FALSE, 4),
    (121, 31, 'Concise (~150–250 words) showing genuine familiarity with their research', TRUE, 1),
    (122, 31, 'A 2,000-word autobiography with no subject line', FALSE, 2),
    (123, 31, 'One sentence saying "Please accept me"', FALSE, 3),
    (124, 31, 'Copied identically to 100 professors with "Dear Sir/Madam"', FALSE, 4),
    (125, 32, 'Does your brother work near the city center?', TRUE, 1),
    (126, 32, 'Do your brother works near the city center?', FALSE, 2),
    (127, 32, 'Is your brother work near the city center?', FALSE, 3),
    (128, 32, 'Does your brother working near the city center?', FALSE, 4)
    ON DUPLICATE KEY UPDATE option_text = VALUES(option_text), correct = VALUES(correct);

    IF EXISTS (SELECT 1 FROM learning_db.quiz_attempts
        WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18)
            AND NOT ((id <=> 1 AND quiz_id <=> 1 AND user_id <=> @seed_u02)
                OR (id <=> 2 AND quiz_id <=> 2 AND user_id <=> @seed_u03)
                OR (id <=> 3 AND quiz_id <=> 3 AND user_id <=> @seed_u04)
                OR (id <=> 4 AND quiz_id <=> 4 AND user_id <=> @seed_u06)
                OR (id <=> 5 AND quiz_id <=> 5 AND user_id <=> @seed_u02)
                OR (id <=> 6 AND quiz_id <=> 6 AND user_id <=> @seed_u07)
                OR (id <=> 7 AND quiz_id <=> 7 AND user_id <=> @seed_u08)
                OR (id <=> 8 AND quiz_id <=> 8 AND user_id <=> @seed_u12)
                OR (id <=> 9 AND quiz_id <=> 9 AND user_id <=> @seed_u10)
                OR (id <=> 10 AND quiz_id <=> 10 AND user_id <=> @seed_u09)
                OR (id <=> 11 AND quiz_id <=> 11 AND user_id <=> @seed_u16)
                OR (id <=> 12 AND quiz_id <=> 12 AND user_id <=> @seed_u10)
                OR (id <=> 13 AND quiz_id <=> 13 AND user_id <=> @seed_u11)
                OR (id <=> 14 AND quiz_id <=> 14 AND user_id <=> @seed_u15)
                OR (id <=> 15 AND quiz_id <=> 15 AND user_id <=> @seed_u14)
                OR (id <=> 16 AND quiz_id <=> 16 AND user_id <=> @seed_u13)
                OR (id <=> 17 AND quiz_id <=> 1 AND user_id <=> @seed_u08)
                OR (id <=> 18 AND quiz_id <=> 4 AND user_id <=> @seed_u17))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quiz_attempts; no data was changed';
    END IF;

    INSERT INTO learning_db.quiz_attempts (id, quiz_id, user_id, course_id, status, score, passed, started_at, submitted_at) VALUES
    (1, 1, @seed_u02, 1, 'GRADED', 85, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 15 DAY)),
    (2, 2, @seed_u03, 2, 'GRADED', 90, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 14 DAY)),
    (3, 3, @seed_u04, 3, 'GRADED', 60, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 13 DAY)),
    (4, 4, @seed_u06, 4, 'GRADED', 100, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 11 DAY)),
    (5, 5, @seed_u02, 5, 'GRADED', 95, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 22 DAY)),
    (6, 6, @seed_u07, 6, 'GRADED', 100, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 12 DAY)),
    (7, 7, @seed_u08, 7, 'GRADED', 100, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 11 DAY)),
    (8, 8, @seed_u12, 8, 'GRADED', 100, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 10 DAY)),
    (9, 9, @seed_u10, 9, 'GRADED', 100, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 9 DAY)),
    (10, 10, @seed_u09, 10, 'GRADED', 100, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 9 DAY)),
    (11, 11, @seed_u16, 11, 'GRADED', 100, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 8 DAY)),
    (12, 12, @seed_u10, 12, 'GRADED', 50, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 6 DAY)),
    (13, 13, @seed_u11, 13, 'GRADED', 100, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 7 DAY)),
    (14, 14, @seed_u15, 14, 'GRADED', 100, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 7 DAY)),
    (15, 15, @seed_u14, 15, 'GRADED', 100, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 6 DAY)),
    (16, 16, @seed_u13, 16, 'GRADED', 100, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 5 DAY)),
    (17, 1, @seed_u08, 1, 'GRADED', 100, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), DATE_SUB('2026-10-20 08:30:00', INTERVAL 4 DAY)),
    (18, 4, @seed_u17, 4, 'IN_PROGRESS', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY), NULL)
    ON DUPLICATE KEY UPDATE score = VALUES(score), passed = VALUES(passed), status = VALUES(status);

    IF EXISTS (SELECT 1 FROM learning_db.quiz_answers
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND attempt_id <=> 1 AND question_id <=> 1)
                OR (id <=> 2 AND attempt_id <=> 2 AND question_id <=> 2)
                OR (id <=> 3 AND attempt_id <=> 3 AND question_id <=> 3)
                OR (id <=> 4 AND attempt_id <=> 4 AND question_id <=> 4)
                OR (id <=> 5 AND attempt_id <=> 5 AND question_id <=> 5))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.quiz_answers; no data was changed';
    END IF;

    INSERT INTO learning_db.quiz_answers (id, attempt_id, question_id, selected_option_id, answer_text, correct, points_awarded) VALUES
    (1, 1, 1, 1, 'Vital / Essential', TRUE, 1),
    (2, 2, 2, 2, 'attend', TRUE, 1),
    (3, 3, 3, 3, 'I apologize, but I have a prior commitment at that time. Could we reschedule?', TRUE, 1),
    (4, 4, 4, 4, 'Continuous Integration and Continuous Deployment', TRUE, 1),
    (5, 5, 5, 5, 'This bridge was built in 2020.', TRUE, 1),
    (6, 6, 6, 21, 'decided', TRUE, 1),
    (7, 7, 7, 25, 'Listing specific minor numbers and exact percentages', TRUE, 1),
    (8, 8, 8, 29, 'It largely depends on the economic context of each country.', TRUE, 1),
    (9, 9, 9, 33, 'promptly', TRUE, 1),
    (10, 10, 10, 37, 'Bottom Line Up Front', TRUE, 1),
    (11, 11, 11, 41, 'che-ki-dout', TRUE, 1),
    (12, 12, 12, 45, 'Nevertheless', TRUE, 1),
    (13, 13, 13, 49, 'Result', TRUE, 1),
    (14, 14, 14, 53, 'Excuse me, would it be possible to switch to a quieter room?', TRUE, 1),
    (15, 15, 15, 57, 'To explain your academic motivation, research fit, and future goals', TRUE, 1),
    (16, 16, 16, 61, 'She practices English for twenty minutes every evening.', TRUE, 1),
    (17, 17, 1, 1, 'Vital / Essential', TRUE, 1),
    (18, 1, 17, 65, 'When the passage provides no evidence to confirm or contradict the statement', TRUE, 1),
    (19, 2, 18, 69, 'Despite', TRUE, 1),
    (20, 3, 19, 74, 'Okay, bye everyone.', FALSE, 0),
    (21, 4, 20, 77, 'A minor, non-blocking suggestion for style or readability', TRUE, 1),
    (22, 5, 21, 81, 'I have already completed three grammar modules this week.', TRUE, 1),
    (23, 6, 22, 85, 'leave / live', TRUE, 1),
    (24, 7, 23, 89, 'Explanation and Example', TRUE, 1),
    (25, 8, 24, 93, '1 minute', TRUE, 1),
    (26, 9, 25, 97, 'attached', TRUE, 1),
    (27, 10, 26, 101, 'Moving on to our Q3 revenue breakdown...', TRUE, 1),
    (28, 11, 27, 105, 'Imitating thought-group pauses and sentence stress alongside the speaker', TRUE, 1),
    (29, 12, 28, 110, 'Look up every adjective in the dictionary first', FALSE, 0),
    (30, 13, 29, 113, 'Reduced API latency by 38% by indexing course catalog queries', TRUE, 1),
    (31, 14, 30, 117, 'Asking whether you are traveling for tourism, business, or study', TRUE, 1),
    (32, 15, 31, 121, 'Concise (~150–250 words) showing genuine familiarity with their research', TRUE, 1),
    (33, 16, 32, 125, 'Does your brother work near the city center?', TRUE, 1),
    (34, 17, 17, 65, 'When the passage provides no evidence to confirm or contradict the statement', TRUE, 1)
    ON DUPLICATE KEY UPDATE points_awarded = VALUES(points_awarded), correct = VALUES(correct);

    IF EXISTS (SELECT 1 FROM learning_db.notifications
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND user_id <=> @seed_u01 AND type <=> 'SYSTEM')
                OR (id <=> 2 AND user_id <=> @seed_u02 AND type <=> 'ENROLLMENT')
                OR (id <=> 3 AND user_id <=> @seed_u03 AND type <=> 'PROGRESS')
                OR (id <=> 4 AND user_id <=> @seed_u04 AND type <=> 'QUIZ')
                OR (id <=> 5 AND user_id <=> @seed_u06 AND type <=> 'SYSTEM'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in learning_db.notifications; no data was changed';
    END IF;

    INSERT INTO learning_db.notifications (id, user_id, type, title, body, action_url, event_key, read_at, created_at) VALUES
    (1, @seed_u01, 'SYSTEM', 'Hệ thống ChitChatGo hoạt động ổn định', 'Tất cả 6 microservices và cổng API Gateway đã sẵn sàng phục vụ.', '/admin', 'seed:sys:health:1', DATE_SUB('2026-10-20 09:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY)),
    (2, @seed_u02, 'ENROLLMENT', 'Chào mừng bạn đến với IELTS Masterclass', 'Bạn đã đăng ký thành công khóa học IELTS Masterclass 7.5+ Toàn Diện. Hãy bắt đầu bài học đầu tiên!', '/learning/1', 'seed:enroll:1', DATE_SUB('2026-10-20 09:00:00', INTERVAL 25 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY)),
    (3, @seed_u03, 'PROGRESS', 'Bạn đã hoàn thành 50% khóa TOEIC 850+', 'Tuyệt vời! Tiếp tục duy trì phong độ học tập hàng ngày nhé.', '/learning/2', 'seed:prog:2', NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (4, @seed_u04, 'QUIZ', 'Kết quả bài kiểm tra Business Communication', 'Bạn đã hoàn thành bài kiểm tra với điểm số 60/100. Hãy ôn lại và thử sức lần 2 nhé.', '/quizzes/3/result', 'seed:quiz:3', NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (5, @seed_u06, 'SYSTEM', 'Khóa học IT English có bài tập mới', 'Giảng viên đã cập nhật bài học Code Review và bộ đề quiz mới cho tuần này.', '/learning/4', 'seed:sys:4', NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (6, @seed_u02, 'PAYMENT_SUCCESS', 'Thanh toán thành công đơn hàng ORD-2026-0001', 'Đơn hàng khóa học IELTS Masterclass 7.5+ Toàn Diện (1.490.000đ) đã được xác nhận.', '/payment/history', 'seed:pay:1', DATE_SUB('2026-10-20 09:00:00', INTERVAL 25 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY)),
    (7, @seed_u03, 'PAYMENT_SUCCESS', 'Thanh toán thành công đơn hàng ORD-2026-0002', 'Khóa học TOEIC Đột Phá 850+ Cấp Tốc đã sẵn sàng trong mục Khóa học của tôi.', '/learning/2', 'seed:pay:2', DATE_SUB('2026-10-20 09:00:00', INTERVAL 22 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY)),
    (8, @seed_u07, 'COURSE_ENROLLED', 'Kích hoạt khóa Chuẩn Hóa Phát Âm 44 Âm IPA', 'Chúc mừng bạn đã ghi danh thành công. Bắt đầu luyện cặp nguyên âm đầu tiên ngay hôm nay!', '/learning/6', 'seed:enroll:6', DATE_SUB('2026-10-20 09:00:00', INTERVAL 17 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY)),
    (9, @seed_u08, 'LESSON_COMPLETED', 'Hoàn thành bài học IELTS Writing Task 1', 'Bạn vừa nhận +20 XP khi hoàn thành bài viết Overview biểu đồ đường & cột.', '/learning/7', 'seed:lesson:7', DATE_SUB('2026-10-20 09:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (10, @seed_u09, 'COURSE_ENROLLED', 'Hoàn tất khóa Viết Email & Thuyết Trình Thương Mại', 'Xuất sắc! Bạn đã hoàn thành 100% chương trình học và bài kiểm tra cuối khóa.', '/learning/10', 'seed:complete:8', NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (11, @seed_u10, 'QUIZ_RESULT_AVAILABLE', 'Có kết quả bài kiểm tra TOEIC 4 Kỹ năng', 'Bạn đạt 100/100 điểm và nhận thưởng +10 XP. Xem chi tiết giải thích từng câu.', '/quizzes/9/result', 'seed:quiz:9', NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (12, @seed_u11, 'PAYMENT_SUCCESS', 'Thanh toán thành công khóa Phỏng Vấn & CV ATS', 'Đơn hàng ORD-2026-0010 đã hoàn tất. Bạn có thể tải bộ mẫu CV chuẩn ATS ngay.', '/learning/13', 'seed:pay:10', DATE_SUB('2026-10-20 09:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (13, @seed_u12, 'LESSON_COMPLETED', 'Hoàn thành bài học IELTS Speaking Part 1', 'Tuyệt vời! Bạn đã duy trì chuỗi học tập liên tiếp 12 ngày.', '/learning/8', 'seed:lesson:11', NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (14, @seed_u13, 'COURSE_ENROLLED', 'Chào mừng bạn đến với Tiếng Anh Từ Số 0 Lên A2', 'Hãy dành 15 phút mỗi ngày cùng bài tập trật tự câu S-V-O và từ vựng cơ bản nhé.', '/learning/16', 'seed:enroll:12', DATE_SUB('2026-10-20 09:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (15, @seed_u14, 'PAYMENT_SUCCESS', 'Thanh toán thành công khóa Hồ Sơ Du Học', 'Đơn hàng ORD-2026-0012 đã được kích hoạt. Bắt đầu phác thảo SOP cùng giảng viên.', '/learning/15', 'seed:pay:13', DATE_SUB('2026-10-20 09:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (16, @seed_u15, 'QUIZ_RESULT_AVAILABLE', 'Hoàn thành bài kiểm tra Travel English', 'Bạn đạt 100/100 điểm. Sẵn sàng tự tin cho chuyến công tác quốc tế!', '/quizzes/14/result', 'seed:quiz:14', DATE_SUB('2026-10-20 09:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (17, @seed_u16, 'PROGRESS', 'Cột mốc chuỗi 21 ngày luyện nghe Dictation', 'Bạn đã mở khóa huy hiệu Chuỗi 21 ngày và đủ điều kiện nhận 210 Gems thưởng.', '/shop', 'seed:streak:15', NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY)),
    (18, @seed_u17, 'COURSE_ENROLLED', 'Kích hoạt khóa English for Software Engineers', 'Chào mừng kỹ sư DevOps tham gia lộ trình tiếng Anh công nghệ.', '/learning/4', 'seed:enroll:16', NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (19, @seed_u18, 'PAYMENT_SUCCESS', 'Thanh toán thành công đơn hàng ORD-2026-0015', 'Khóa học Chinh Phục Phỏng Vấn Tiếng Anh & CV ATS đã sẵn sàng.', '/learning/13', 'seed:pay:17', NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (20, @seed_u02, 'SYSTEM', 'ChitChatGo Pro 1 năm đã được kích hoạt', 'Tài khoản của bạn đã mở khóa toàn bộ khóa học công bố và hạn mức Trợ lý AI nâng cao.', '/pro', 'seed:pro:1', NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY))
    ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body);

    INSERT INTO learning_db.shop_items (code, name_key, item_type, rarity, price, original_price, asset_key, position, active) VALUES
    ('FRAME_STAR_SCHOLAR', 'Học giả ánh sao', 'FRAME', 'LEGENDARY', 320, 400, 'owl-wizard', 9, TRUE),
    ('FRAME_SAKURA_VIP', 'Anh đào mùa thi', 'FRAME', 'LEGENDARY', 280, 350, 'bunny-bloom', 10, TRUE),
    ('FRAME_EMERALD_CAT', 'Mèo học bài Ngọc Lục Bảo', 'FRAME', 'EPIC', 200, 250, 'kitty-scholar', 11, TRUE),
    ('FRAME_FOREST_KOALA', 'Koala rừng thông', 'FRAME', 'RARE', 140, NULL, 'koala-garden', 12, TRUE),
    ('BACKGROUND_DAWN_HALL', 'Bình minh thư viện', 'BACKGROUND', 'LEGENDARY', 220, 300, 'campus-sunrise', 13, TRUE),
    ('BACKGROUND_STARLIGHT', 'Đêm ôn thi ngàn sao', 'BACKGROUND', 'LEGENDARY', 260, 320, 'moonlit-library', 14, TRUE)
    ON DUPLICATE KEY UPDATE name_key = VALUES(name_key), price = VALUES(price), active = VALUES(active);

    INSERT INTO learning_db.engagement_reward_rules (code, label, metric, threshold, gems, active) VALUES
    ('STREAK_14', 'Chuỗi 14 ngày', 'STREAK', 14, 140, TRUE),
    ('STREAK_21', 'Chuỗi 21 ngày', 'STREAK', 21, 210, TRUE),
    ('STREAK_60', 'Chuỗi 60 ngày', 'STREAK', 60, 500, TRUE),
    ('STREAK_90', 'Chuỗi 90 ngày', 'STREAK', 90, 750, TRUE),
    ('STREAK_180', 'Chuỗi 180 ngày', 'STREAK', 180, 1200, TRUE),
    ('LEVEL_2', 'Đạt cấp độ 2', 'LEVEL', 2, 40, TRUE),
    ('LEVEL_3', 'Đạt cấp độ 3', 'LEVEL', 3, 60, TRUE),
    ('LEVEL_10', 'Đạt cấp độ 10', 'LEVEL', 10, 220, TRUE),
    ('LEVEL_15', 'Đạt cấp độ 15', 'LEVEL', 15, 350, TRUE),
    ('LEVEL_20', 'Đạt cấp độ 20', 'LEVEL', 20, 500, TRUE)
    ON DUPLICATE KEY UPDATE label = VALUES(label), gems = VALUES(gems), active = VALUES(active);

    INSERT INTO learning_db.learner_profiles (user_id, display_name, total_xp, gems, current_streak, longest_streak, last_activity_date, active_frame, streak_freezes, streak_accounted_through, active_background) VALUES
    (@seed_u01, 'System Administrator', 1200, 500, 10, 24, '2026-10-10', 'FRAME_OWL', 3, '2026-10-10', 'BACKGROUND_LIBRARY'),
    (@seed_u02, 'Nguyễn Văn A', 1450, 420, 14, 30, '2026-10-11', 'FRAME_OWL', 2, '2026-10-11', 'BACKGROUND_CAMPUS'),
    (@seed_u03, 'Trần Thị B', 1120, 310, 9, 19, '2026-10-12', 'FRAME_KITTY', 2, '2026-10-12', 'BACKGROUND_SKY'),
    (@seed_u04, 'Lê Văn C', 680, 185, 4, 12, '2026-10-13', 'FRAME_CLASSIC', 1, '2026-10-13', 'BACKGROUND_SKY'),
    (@seed_u05, 'Phạm Thị D', 180, 60, 0, 3, '2026-09-12', 'FRAME_CLASSIC', 0, '2026-09-12', 'BACKGROUND_SKY'),
    (@seed_u06, 'Hoàng Văn E', 1690, 540, 18, 28, '2026-10-15', 'FRAME_STAR_SCHOLAR', 3, '2026-10-15', 'BACKGROUND_STARLIGHT'),
    (@seed_u07, 'Nguyễn Minh Khôi', 840, 220, 7, 14, '2026-10-16', 'FRAME_KOALA', 1, '2026-10-16', 'BACKGROUND_SKY'),
    (@seed_u08, 'Võ Thảo Vy', 1340, 390, 11, 21, '2026-10-17', 'FRAME_BUNNY', 2, '2026-10-17', 'BACKGROUND_CAMPUS'),
    (@seed_u09, 'Đặng Quốc Bảo', 1520, 480, 15, 22, '2026-10-18', 'FRAME_OWL', 2, '2026-10-18', 'BACKGROUND_LIBRARY'),
    (@seed_u10, 'Bùi Ngọc Hân', 1280, 340, 8, 16, '2026-10-19', 'FRAME_KITTY', 1, '2026-10-19', 'BACKGROUND_CAMPUS'),
    (@seed_u11, 'Đỗ Gia Huy', 960, 290, 6, 15, '2026-10-20', 'FRAME_CLASSIC', 1, '2026-10-20', 'BACKGROUND_SKY'),
    (@seed_u12, 'Ngô Khánh Linh', 1780, 610, 12, 31, '2026-10-21', 'FRAME_SAKURA_VIP', 3, '2026-10-21', 'BACKGROUND_DAWN_HALL'),
    (@seed_u13, 'Dương Tuấn Kiệt', 540, 150, 5, 9, '2026-10-10', 'FRAME_CLASSIC', 1, '2026-10-10', 'BACKGROUND_SKY'),
    (@seed_u14, 'Lý Thanh Trúc', 1080, 330, 10, 18, '2026-10-11', 'FRAME_BUNNY', 2, '2026-10-11', 'BACKGROUND_LIBRARY'),
    (@seed_u15, 'Trương Hoàng Nam', 910, 275, 7, 14, '2026-10-12', 'FRAME_KOALA', 1, '2026-10-12', 'BACKGROUND_SKY'),
    (@seed_u16, 'Phan Mỹ Duyên', 2340, 790, 21, 35, '2026-10-13', 'FRAME_STAR_SCHOLAR', 4, '2026-10-13', 'BACKGROUND_STARLIGHT'),
    (@seed_u17, 'Vũ Đức Thịnh', 720, 240, 4, 11, '2026-10-14', 'FRAME_EMERALD_CAT', 1, '2026-10-14', 'BACKGROUND_CAMPUS'),
    (@seed_u18, 'Đinh Lan Anh', 640, 210, 3, 10, '2026-10-15', 'FRAME_CLASSIC', 1, '2026-10-15', 'BACKGROUND_SKY')
    ON DUPLICATE KEY UPDATE total_xp = VALUES(total_xp), gems = VALUES(gems), current_streak = VALUES(current_streak), longest_streak = VALUES(longest_streak);

    INSERT INTO learning_db.learning_xp_events (id, user_id, source_type, source_id, xp, earned_at) VALUES
    (1, @seed_u02, 'LESSON', 910101, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 23 DAY)),
    (2, @seed_u03, 'LESSON', 910201, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY)),
    (3, @seed_u06, 'LESSON', 910401, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (4, @seed_u02, 'LESSON', 910501, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 27 DAY)),
    (5, @seed_u02, 'LESSON', 910502, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY)),
    (6, @seed_u02, 'LESSON', 910503, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 23 DAY)),
    (7, @seed_u07, 'LESSON', 910601, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (8, @seed_u08, 'LESSON', 910701, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (9, @seed_u08, 'LESSON', 910101, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (10, @seed_u09, 'LESSON', 911001, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (11, @seed_u09, 'LESSON', 911002, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (12, @seed_u10, 'LESSON', 910901, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (13, @seed_u11, 'LESSON', 911301, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (14, @seed_u12, 'LESSON', 910801, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (15, @seed_u13, 'LESSON', 911601, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (16, @seed_u15, 'LESSON', 911401, 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (17, @seed_u02, 'QUIZ', 1, 10, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (18, @seed_u03, 'QUIZ', 2, 10, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (19, @seed_u04, 'QUIZ', 3, 10, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (20, @seed_u06, 'QUIZ', 4, 10, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (21, @seed_u02, 'QUIZ', 5, 10, DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY)),
    (22, @seed_u07, 'QUIZ', 6, 10, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (23, @seed_u08, 'QUIZ', 7, 10, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (24, @seed_u12, 'QUIZ', 8, 10, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (25, @seed_u10, 'QUIZ', 9, 10, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (26, @seed_u09, 'QUIZ', 10, 10, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY))
    ON DUPLICATE KEY UPDATE xp = VALUES(xp);

    INSERT INTO learning_db.learning_activity_days (user_id, activity_date, activity_count, gems_awarded) VALUES
    (@seed_u01, '2026-10-01', 1, 25),
    (@seed_u02, '2026-10-02', 2, 25),
    (@seed_u03, '2026-10-03', 3, 25),
    (@seed_u04, '2026-10-04', 4, 25),
    (@seed_u05, '2026-10-05', 5, 25),
    (@seed_u06, '2026-10-06', 1, 25),
    (@seed_u07, '2026-10-07', 2, 25),
    (@seed_u08, '2026-10-08', 3, 25),
    (@seed_u09, '2026-10-09', 4, 25),
    (@seed_u10, '2026-10-10', 5, 25),
    (@seed_u11, '2026-10-11', 1, 25),
    (@seed_u12, '2026-10-12', 2, 25),
    (@seed_u13, '2026-10-13', 3, 25),
    (@seed_u14, '2026-10-14', 4, 25),
    (@seed_u15, '2026-10-15', 5, 25),
    (@seed_u16, '2026-10-01', 1, 25),
    (@seed_u17, '2026-10-02', 2, 25),
    (@seed_u18, '2026-10-03', 3, 25),
    (@seed_u02, '2026-10-16', 2, 25),
    (@seed_u03, '2026-10-17', 3, 25),
    (@seed_u04, '2026-10-18', 4, 25),
    (@seed_u05, '2026-10-19', 5, 25),
    (@seed_u06, '2026-10-16', 2, 25),
    (@seed_u07, '2026-10-17', 3, 25),
    (@seed_u08, '2026-10-18', 4, 25)
    ON DUPLICATE KEY UPDATE activity_count = VALUES(activity_count), gems_awarded = VALUES(gems_awarded);

    INSERT INTO learning_db.learner_rewards (user_id, reward_code, gems, claimed_at) VALUES
    (@seed_u02, 'FIRST_LESSON', 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 24 DAY)),
    (@seed_u03, 'FIRST_LESSON', 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 23 DAY)),
    (@seed_u04, 'FIRST_LESSON', 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY)),
    (@seed_u05, 'FIRST_LESSON', 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 21 DAY)),
    (@seed_u06, 'FIRST_LESSON', 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY)),
    (@seed_u07, 'FIRST_LESSON', 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 19 DAY)),
    (@seed_u08, 'FIRST_LESSON', 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY)),
    (@seed_u09, 'FIRST_LESSON', 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY)),
    (@seed_u10, 'FIRST_LESSON', 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (@seed_u11, 'FIRST_LESSON', 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (@seed_u12, 'FIRST_LESSON', 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (@seed_u13, 'FIRST_LESSON', 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (@seed_u14, 'FIRST_LESSON', 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (@seed_u15, 'FIRST_LESSON', 20, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (@seed_u02, 'STREAK_7', 70, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (@seed_u03, 'STREAK_3', 30, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (@seed_u06, 'STREAK_14', 140, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (@seed_u09, 'LEVEL_5', 100, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (@seed_u12, 'LEVEL_10', 220, DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    (@seed_u16, 'STREAK_21', 210, DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY))
    ON DUPLICATE KEY UPDATE gems = VALUES(gems);

    INSERT INTO learning_db.community_topics (id, code, position) VALUES
    (5, 'speaking-practice', 5),
    (6, 'writing-feedback', 6),
    (7, 'listening-dictation', 7),
    (8, 'pronunciation-ipa', 8),
    (9, 'vocabulary-tips', 9),
    (10, 'grammar-clinic', 10),
    (11, 'business-english', 11),
    (12, 'it-english', 12),
    (13, 'study-abroad', 13),
    (14, 'study-partners', 14),
    (15, 'exam-reviews', 15)
    ON DUPLICATE KEY UPDATE position = VALUES(position);

    INSERT INTO learning_db.community_posts (id, author_id, topic_id, kind, title, body, locked, accepted_comment_id, created_at, updated_at) VALUES
    (1, @seed_u02, 2, 'DISCUSSION', 'Kinh nghiệm tăng IELTS Listening từ 6.5 lên 8.0 nhờ nghe chép chính tả', 'Mình duy trì mỗi tối chép 2 bài Dictation trên ChitChatGo và ghi lại các từ bị nối âm. Sau 6 tuần làm đề Cambridge thấy bắt ý rõ hơn hẳn, đặc biệt Part 3 và Part 4.', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 19 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 19 DAY)),
    (2, @seed_u03, 2, 'QUESTION', 'Làm sao để xử lý kịp 54 câu TOEIC Part 7 trong 50 phút?', 'Mình thường làm xong Part 5–6 mất 18 phút nên sang đoạn ba Part 7 hay bị thiếu giờ. Mọi người có mẹo phân bổ thời gian hiệu quả không ạ?', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY)),
    (3, @seed_u04, 11, 'DISCUSSION', 'Chia sẻ 5 mẫu câu từ chối lịch họp bằng tiếng Anh rất lịch sự', 'Trong công việc quốc tế, tránh nói thẳng "I am busy". Hãy dùng "I have a prior commitment at that slot, could we move it to..." để vừa chuyên nghiệp vừa thiện chí.', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY)),
    (4, @seed_u06, 12, 'DISCUSSION', 'Tổng hợp mẫu câu Code Review tinh tế cho anh em lập trình viên', 'Dùng "Nit:" cho góp ý style nhỏ, dùng câu hỏi mở "What do you think about extracting...?" thay vì mệnh lệnh sẽ giúp không khí review trong team thoải mái hơn nhiều.', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (5, @seed_u07, 8, 'QUESTION', 'Phân biệt âm /θ/ và /ð/ khi nói nhanh làm sao cho tự nhiên?', 'Khi đọc từng từ đơn thì mình đặt lưỡi giữa hai răng được, nhưng vào câu dài như "they think that this..." thì hay bị trượt sang âm /t/ hoặc /d/.', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (6, @seed_u08, 6, 'QUESTION', 'Nhờ mọi người góp ý đoạn Overview IELTS Writing Task 1 dạng Line Graph', 'Mình viết hai câu Overview gồm xu hướng tăng giảm và đối tượng dẫn đầu, nhưng sợ bị dài quá 50 từ. Tiêu chuẩn thường khoảng mấy câu là hợp lý?', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (7, @seed_u09, 11, 'DISCUSSION', 'Áp dụng nguyên tắc BLUF giúp email công việc ngắn đi một nửa', 'Đưa kết luận hoặc yêu cầu hành động lên ngay 2 dòng đầu email, sau đó mới liệt kê bối cảnh gạch đầu dòng. Khách hàng nước ngoài phản hồi nhanh gấp đôi!', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (8, @seed_u10, 15, 'DISCUSSION', 'Review trải nghiệm thi TOEIC máy tính tháng 10/2026 tại TP.HCM', 'Màn hình rõ, tai nghe cách âm tốt. Đặc biệt Part 7 chia hai khung trái/phải nên đối chiếu thông tin nhanh hơn thi giấy khá nhiều.', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (9, @seed_u11, 12, 'QUESTION', 'Phỏng vấn System Design bằng tiếng Anh nên ưu tiên nói phần nào trước?', 'Tuần sau mình phỏng vấn vị trí Backend Engineer với team Singapore. Mình nên trình bày yêu cầu phi chức năng trước hay vẽ sơ đồ kiến trúc ngay?', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (10, @seed_u12, 5, 'DISCUSSION', 'Tuyển bạn luyện IELTS Speaking Part 2–3 mỗi tối thứ 3, 5, 7', 'Mục tiêu của mình là Band 7.5 vào tháng 12. Bạn nào ở mức 6.0–6.5 muốn ghép đôi bấm giờ và chấm chéo phát âm thì bình luận bên dưới nhé!', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (11, @seed_u13, 10, 'QUESTION', 'Khi nào dùng Present Perfect thay vì Past Simple trong giao tiếp?', 'Mình hay phân vân giữa "Did you eat yet?" và "Have you eaten yet?". Hai câu này khác sắc thái nhau thế nào trong thực tế ạ?', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (12, @seed_u14, 13, 'DISCUSSION', 'Checklist 5 điểm quan trọng trước khi nộp Statement of Purpose du học', 'Kiểm tra kỹ tên giáo sư, môn học đặc thù của trường, độ dài giới hạn từ và mối liên hệ logic giữa dự án đã làm với hướng nghiên cứu tương lai.', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (13, @seed_u15, 4, 'DISCUSSION', 'Nhật ký 30 ngày học tiếng Anh mỗi sáng 25 phút trước khi đi làm', 'Chỉ cần duy trì 1 bài đọc ngắn + 1 bài quiz trên ChitChatGo cùng ly cà phê sáng, mình đã đạt chuỗi 30 ngày mà không hề thấy áp lực.', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (14, @seed_u16, 7, 'DISCUSSION', 'Mẹo dùng tính năng gợi ý từng từ trong Dictation để không bị nản', 'Với những câu tốc độ nhanh, hãy nghe lại 3 lần trước rồi mới mở gợi ý tối đa 1–2 từ khóa nối âm để vẫn giữ được hiệu quả luyện tai.', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (15, @seed_u17, 12, 'QUESTION', 'Cách giải thích ngắn gọn sự cố Production Incident trong buổi Postmortem?', 'Mình cần chuẩn bị báo cáo bằng tiếng Anh về nguyên nhân gốc rễ (Root Cause) và hướng phòng ngừa mà vẫn giữ tinh thần blameless.', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (16, @seed_u18, 3, 'QUESTION', 'Viết CV tiếng Anh cho người chuyển ngành nên dùng cấu trúc nào?', 'Mình chuyển từ Sale sang HRBP, muốn nhấn mạnh kỹ năng chuyển giao (transferable skills) chuẩn ATS thì nên sắp xếp các mục ra sao?', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    (17, @seed_u02, 9, 'DISCUSSION', 'Cách học Collocations theo chủ đề thay vì chép từ đơn lẻ', 'Thay vì ghi "make = làm", hãy học cả cụm "make an informed decision", "meet a tight deadline", "bridge the gap" kèm câu ví dụ của riêng bạn.', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (18, @seed_u03, 14, 'DISCUSSION', 'Lập nhóm tự học TOEIC 850+ cam kết check-in tiến độ mỗi cuối tuần', 'Nhóm hiện có 5 thành viên, mỗi Chủ nhật cùng làm 1 đề Reading trên mục Luyện thi TOEIC và chia sẻ sổ ghi chú từ vựng mới.', FALSE, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY))
    ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body);

    INSERT INTO learning_db.community_comments (id, post_id, author_id, body, created_at, updated_at) VALUES
    (1, 2, @seed_u02, 'Bạn thử giới hạn Part 5–6 tối đa 14 phút (không dịch cả câu với câu từ loại). Sang Part 7 hãy đọc câu hỏi trước để định vị đoạn văn nhé!', DATE_SUB('2026-10-20 12:00:00', INTERVAL 24 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 24 HOUR)),
    (2, 2, @seed_u10, 'Mình cũng áp dụng cách làm ngược từ câu 200 lên 147 vì đoạn ba tốn nhiều năng lượng nhất, thấy cải thiện rõ rệt!', DATE_SUB('2026-10-20 12:00:00', INTERVAL 23 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 23 HOUR)),
    (3, 5, @seed_u12, 'Mẹo của mình là tập chậm theo cụm 3 từ (chunking) trước gương, giữ đầu lưỡi chạm nhẹ răng trên chứ đừng đưa ra quá dài.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 22 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 22 HOUR)),
    (4, 6, @seed_u02, 'Overview lý tưởng chỉ cần 2 câu, khoảng 35–45 từ, tuyệt đối không chèn con số chi tiết mà chỉ nêu xu hướng nổi bật nhất.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 21 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 21 HOUR)),
    (5, 9, @seed_u06, 'Luôn bắt đầu bằng 3–5 phút clarify functional & non-functional requirements (QPS, latency, storage), sau đó mới vẽ high-level architecture và đi sâu vào bottlenecks.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 20 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 20 HOUR)),
    (6, 11, @seed_u08, 'Trong tiếng Anh Mỹ người ta hay dùng Past Simple với "yet", còn tiếng Anh Anh và bài thi học thuật ưu tiên Present Perfect vì nhấn mạnh kết quả đến hiện tại.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 19 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 19 HOUR)),
    (7, 15, @seed_u06, 'Hãy dùng cấu trúc Timeline → Impact → Root Cause → Action Items, dùng câu bị động hoặc chủ ngữ hệ thống ("The cache expired unexpectedly") để giữ văn phong blameless.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 18 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 18 HOUR)),
    (8, 16, @seed_u11, 'Bạn đặt phần Professional Summary 3 dòng ngay đầu CV, làm nổi bật thành tích định lượng liên quan đến tuyển dụng và giao tiếp đối tác nhé!', DATE_SUB('2026-10-20 12:00:00', INTERVAL 17 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 17 HOUR)),
    (9, 1, @seed_u16, 'Chuẩn luôn bạn ơi, mình cũng tăng tốc độ bắt âm nhờ chép chính tả đều đặn mỗi tối.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 16 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 16 HOUR)),
    (10, 1, @seed_u07, 'Bạn có nghe lại tốc độ 1.25x sau khi kiểm tra đáp án không? Mình thấy bước đó cực hiệu quả.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 15 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 15 HOUR)),
    (11, 3, @seed_u09, 'Mẫu câu "I have a prior commitment" mình dùng suốt tuần rồi, sếp phản hồi rất tích cực.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 14 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 14 HOUR)),
    (12, 4, @seed_u11, 'Team mình còn dùng thêm quy ước Conventional Comments như "suggestion:", "question:", "praise:" rất văn minh.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 13 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 13 HOUR)),
    (13, 7, @seed_u04, 'Cảm ơn chia sẻ của anh! Từ hồi học bài Email BLUF em đỡ viết dài dòng hẳn.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 12 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 12 HOUR)),
    (14, 8, @seed_u03, 'Cảm ơn review siêu có tâm, tháng sau mình cũng đăng ký thi máy tính luôn.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 11 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 11 HOUR)),
    (15, 10, @seed_u08, 'Cho mình đăng ký một slot luyện chung nhé, mình đang ở mức Speaking 6.5.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 10 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 10 HOUR)),
    (16, 10, @seed_u14, 'Mình tham gia với! Mình muốn luyện phản xạ Part 3 chủ đề giáo dục và công nghệ.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 9 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 9 HOUR)),
    (17, 12, @seed_u02, 'Checklist này rất thiết thực, đặc biệt lưu ý tránh viết chung chung kiểu "your university is prestigious".', DATE_SUB('2026-10-20 12:00:00', INTERVAL 8 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 8 HOUR)),
    (18, 13, @seed_u13, 'Đọc bài của anh có động lực quá, em cũng vừa bắt đầu chuỗi 5 ngày đầu tiên!', DATE_SUB('2026-10-20 12:00:00', INTERVAL 7 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 7 HOUR)),
    (19, 14, @seed_u07, 'Mình cũng áp dụng quy tắc nghe 3 lần rồi mới mở gợi ý, nhớ từ lâu hơn nhiều.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 6 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 6 HOUR)),
    (20, 17, @seed_u15, 'Học collocations theo cụm giúp mình nói tự nhiên hơn và ít bị dịch từng từ từ tiếng Việt.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 5 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 5 HOUR)),
    (21, 18, @seed_u10, 'Cho mình tham gia nhóm check-in Chủ nhật với nhé!', DATE_SUB('2026-10-20 12:00:00', INTERVAL 4 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 4 HOUR)),
    (22, 4, @seed_u17, 'Bài viết rất đúng trọng tâm cho dev, cảm ơn bạn đã tổng hợp.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 3 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 3 HOUR)),
    (23, 9, @seed_u17, 'Bổ sung thêm là nên nói rõ trade-offs khi chọn SQL vs NoSQL hay Cache strategy.', DATE_SUB('2026-10-20 12:00:00', INTERVAL 2 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 2 HOUR)),
    (24, 12, @seed_u18, 'Chúc bạn sớm nhận thư mời nhập học và học bổng mong muốn nhé!', DATE_SUB('2026-10-20 12:00:00', INTERVAL 1 HOUR), DATE_SUB('2026-10-20 12:00:00', INTERVAL 1 HOUR))
    ON DUPLICATE KEY UPDATE body = VALUES(body);

    UPDATE learning_db.community_posts SET accepted_comment_id = 1 WHERE id = 2;
    UPDATE learning_db.community_posts SET accepted_comment_id = 3 WHERE id = 5;
    UPDATE learning_db.community_posts SET accepted_comment_id = 4 WHERE id = 6;
    UPDATE learning_db.community_posts SET accepted_comment_id = 5 WHERE id = 9;
    UPDATE learning_db.community_posts SET accepted_comment_id = 6 WHERE id = 11;
    UPDATE learning_db.community_posts SET accepted_comment_id = 7 WHERE id = 15;
    UPDATE learning_db.community_posts SET accepted_comment_id = 8 WHERE id = 16;

    INSERT INTO learning_db.shop_inventory (user_id, item_code, acquired_at) VALUES
    (@seed_u01, 'FRAME_OWL', DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY)),
    (@seed_u01, 'BACKGROUND_LIBRARY', DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY)),
    (@seed_u02, 'FRAME_OWL', DATE_SUB('2026-10-20 08:00:00', INTERVAL 19 DAY)),
    (@seed_u02, 'BACKGROUND_CAMPUS', DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY)),
    (@seed_u03, 'FRAME_KITTY', DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY)),
    (@seed_u04, 'FRAME_CLASSIC', DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY)),
    (@seed_u05, 'FRAME_CLASSIC', DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (@seed_u06, 'FRAME_STAR_SCHOLAR', DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (@seed_u06, 'BACKGROUND_STARLIGHT', DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (@seed_u07, 'FRAME_KOALA', DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (@seed_u08, 'FRAME_BUNNY', DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (@seed_u08, 'BACKGROUND_CAMPUS', DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (@seed_u09, 'FRAME_OWL', DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (@seed_u09, 'BACKGROUND_LIBRARY', DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (@seed_u10, 'FRAME_KITTY', DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (@seed_u10, 'BACKGROUND_CAMPUS', DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (@seed_u11, 'FRAME_CLASSIC', DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (@seed_u12, 'FRAME_SAKURA_VIP', DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (@seed_u12, 'BACKGROUND_DAWN_HALL', DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (@seed_u13, 'FRAME_CLASSIC', DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (@seed_u14, 'FRAME_BUNNY', DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (@seed_u14, 'BACKGROUND_LIBRARY', DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY)),
    (@seed_u15, 'FRAME_KOALA', DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (@seed_u16, 'FRAME_STAR_SCHOLAR', DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY)),
    (@seed_u16, 'BACKGROUND_STARLIGHT', DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (@seed_u17, 'FRAME_EMERALD_CAT', DATE_SUB('2026-10-20 08:00:00', INTERVAL 19 DAY)),
    (@seed_u17, 'BACKGROUND_CAMPUS', DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (@seed_u18, 'FRAME_CLASSIC', DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY))
    ON DUPLICATE KEY UPDATE acquired_at = VALUES(acquired_at);

    INSERT INTO learning_db.shop_purchases (id, user_id, request_id, item_code, gems_spent, item_granted, created_at) VALUES
    (1, @seed_u02, 'seed-shop-req-0001', 'FRAME_OWL', 250, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY)),
    (2, @seed_u02, 'seed-shop-req-0002', 'BACKGROUND_CAMPUS', 100, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (3, @seed_u03, 'seed-shop-req-0003', 'FRAME_KITTY', 150, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (4, @seed_u04, 'seed-shop-req-0004', 'STREAK_FREEZE', 25, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (5, @seed_u06, 'seed-shop-req-0005', 'FRAME_STAR_SCHOLAR', 320, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (6, @seed_u06, 'seed-shop-req-0006', 'BACKGROUND_STARLIGHT', 260, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (7, @seed_u07, 'seed-shop-req-0007', 'FRAME_KOALA', 180, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (8, @seed_u08, 'seed-shop-req-0008', 'FRAME_BUNNY', 180, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (9, @seed_u08, 'seed-shop-req-0009', 'BACKGROUND_CAMPUS', 100, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (10, @seed_u09, 'seed-shop-req-0010', 'FRAME_OWL', 250, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (11, @seed_u09, 'seed-shop-req-0011', 'BACKGROUND_LIBRARY', 120, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (12, @seed_u10, 'seed-shop-req-0012', 'FRAME_KITTY', 150, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (13, @seed_u11, 'seed-shop-req-0013', 'STREAK_FREEZE', 25, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (14, @seed_u12, 'seed-shop-req-0014', 'FRAME_SAKURA_VIP', 280, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (15, @seed_u12, 'seed-shop-req-0015', 'BACKGROUND_DAWN_HALL', 220, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (16, @seed_u14, 'seed-shop-req-0016', 'BACKGROUND_LIBRARY', 120, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    (17, @seed_u16, 'seed-shop-req-0017', 'FRAME_STAR_SCHOLAR', 320, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (18, @seed_u17, 'seed-shop-req-0018', 'FRAME_EMERALD_CAT', 200, TRUE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY))
    ON DUPLICATE KEY UPDATE gems_spent = VALUES(gems_spent), item_granted = VALUES(item_granted);

    INSERT INTO learning_db.learning_frozen_days (user_id, frozen_date, used_at) VALUES
    (@seed_u02, '2026-09-10', '2026-09-10 23:55:00'),
    (@seed_u03, '2026-09-11', '2026-09-11 23:55:00'),
    (@seed_u04, '2026-09-12', '2026-09-12 23:55:00'),
    (@seed_u05, '2026-09-13', '2026-09-13 23:55:00'),
    (@seed_u06, '2026-09-14', '2026-09-14 23:55:00'),
    (@seed_u07, '2026-09-15', '2026-09-15 23:55:00'),
    (@seed_u08, '2026-09-16', '2026-09-16 23:55:00'),
    (@seed_u09, '2026-09-17', '2026-09-17 23:55:00'),
    (@seed_u10, '2026-09-18', '2026-09-18 23:55:00'),
    (@seed_u11, '2026-09-19', '2026-09-19 23:55:00'),
    (@seed_u12, '2026-09-20', '2026-09-20 23:55:00'),
    (@seed_u13, '2026-09-21', '2026-09-21 23:55:00'),
    (@seed_u14, '2026-09-22', '2026-09-22 23:55:00'),
    (@seed_u15, '2026-09-23', '2026-09-23 23:55:00'),
    (@seed_u16, '2026-09-24', '2026-09-24 23:55:00'),
    (@seed_u17, '2026-09-25', '2026-09-25 23:55:00')
    ON DUPLICATE KEY UPDATE used_at = VALUES(used_at);

    INSERT INTO learning_db.pro_memberships (user_id, expires_at, plan_code, suspended) VALUES
    (@seed_u02, '2027-10-05 08:00:00', 'PRO_YEAR', FALSE),
    (@seed_u03, '2027-01-15 08:00:00', 'PRO_QUARTER', FALSE),
    (@seed_u04, '2026-12-20 08:00:00', 'PRO_MONTH', FALSE),
    (@seed_u06, '2027-10-05 08:00:00', 'PRO_YEAR', FALSE),
    (@seed_u07, '2027-01-15 08:00:00', 'PRO_QUARTER', FALSE),
    (@seed_u08, '2026-12-20 08:00:00', 'PRO_MONTH', FALSE),
    (@seed_u09, '2027-10-05 08:00:00', 'PRO_YEAR', FALSE),
    (@seed_u10, '2027-01-15 08:00:00', 'PRO_QUARTER', FALSE),
    (@seed_u11, '2026-12-20 08:00:00', 'PRO_MONTH', FALSE),
    (@seed_u12, '2027-10-05 08:00:00', 'PRO_YEAR', FALSE),
    (@seed_u13, '2027-01-15 08:00:00', 'PRO_QUARTER', FALSE),
    (@seed_u14, '2026-12-20 08:00:00', 'PRO_MONTH', FALSE),
    (@seed_u15, '2027-10-05 08:00:00', 'PRO_YEAR', FALSE),
    (@seed_u16, '2026-08-01 08:00:00', 'PRO_QUARTER', FALSE),
    (@seed_u17, '2026-12-20 08:00:00', 'PRO_MONTH', TRUE)
    ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at), plan_code = VALUES(plan_code), suspended = VALUES(suspended);

    INSERT INTO learning_db.pro_grants (id, reference_code, user_id, source_type, plan_code, duration_months, granted_at, revoked_at, actor_id, admin_reason) VALUES
    (1, 'ORD-PRO-2026-0001', @seed_u02, 'PAYMENT', 'PRO_YEAR', 12, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), NULL, NULL, NULL),
    (2, 'ORD-PRO-2026-0002', @seed_u03, 'PAYMENT', 'PRO_QUARTER', 3, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), NULL, NULL, NULL),
    (3, 'ORD-PRO-2026-0003', @seed_u06, 'PAYMENT', 'PRO_MONTH', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), NULL, NULL, NULL),
    (4, 'ORD-PRO-2026-0004', @seed_u09, 'PAYMENT', 'PRO_QUARTER', 3, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), NULL, NULL, NULL),
    (5, 'SEED-PRO-CODE-001', @seed_u04, 'CODE', 'PRO_YEAR', 12, DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY), NULL, NULL, NULL),
    (6, 'SEED-PRO-CODE-002', @seed_u07, 'CODE', 'PRO_QUARTER', 3, DATE_SUB('2026-10-20 08:00:00', INTERVAL 19 DAY), NULL, NULL, NULL),
    (7, 'SEED-PRO-CODE-003', @seed_u08, 'CODE', 'PRO_MONTH', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY), NULL, NULL, NULL),
    (8, 'SEED-PRO-CODE-004', @seed_u10, 'CODE', 'PRO_YEAR', 12, DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY), NULL, NULL, NULL),
    (9, 'SEED-PRO-CODE-005', @seed_u11, 'CODE', 'PRO_QUARTER', 3, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), NULL, NULL, NULL),
    (10, 'SEED-PRO-CODE-006', @seed_u12, 'CODE', 'PRO_MONTH', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), NULL, NULL, NULL),
    (11, 'SEED-PRO-ADMIN-007', @seed_u13, 'ADMIN', 'PRO_YEAR', 12, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), NULL, @seed_u01, 'Cấp gói Pro học bổng cộng đồng ChitChatGo.'),
    (12, 'SEED-PRO-ADMIN-008', @seed_u14, 'ADMIN', 'PRO_QUARTER', 3, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), NULL, @seed_u01, 'Cấp gói Pro học bổng cộng đồng ChitChatGo.'),
    (13, 'SEED-PRO-ADMIN-009', @seed_u15, 'ADMIN', 'PRO_MONTH', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), NULL, @seed_u01, 'Cấp gói Pro học bổng cộng đồng ChitChatGo.'),
    (14, 'SEED-PRO-ADMIN-010', @seed_u16, 'ADMIN', 'PRO_YEAR', 12, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), NULL, @seed_u01, 'Cấp gói Pro học bổng cộng đồng ChitChatGo.'),
    (15, 'SEED-PRO-ADMIN-011', @seed_u17, 'ADMIN', 'PRO_QUARTER', 3, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), NULL, @seed_u01, 'Cấp gói Pro học bổng cộng đồng ChitChatGo.'),
    (16, 'SEED-PRO-CODE-016', @seed_u02, 'CODE', 'PRO_MONTH', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 30 DAY), NULL, NULL, NULL),
    (17, 'SEED-PRO-ADMIN-017', @seed_u03, 'ADMIN', 'PRO_MONTH', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY), NULL, @seed_u01, 'Thưởng học viên tích cực tháng 9.'),
    (18, 'SEED-PRO-ADMIN-018', @seed_u16, 'ADMIN', 'PRO_QUARTER', 3, DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), NULL, @seed_u01, 'Quà tặng top bảng xếp hạng Dictation.')
    ON DUPLICATE KEY UPDATE plan_code = VALUES(plan_code);

    INSERT INTO learning_db.pro_activation_codes (id, code_hash, code_suffix, plan_code, duration_months, created_by, created_at, expires_at, redeemed_by, redeemed_at, revoked_at) VALUES
    (1, '74adaa6635647a0dce4e0056ede445c469c16ddb13fb9b1e1893a9b3d53b3574', '1001', 'PRO_YEAR', 12, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY), '2027-06-30 23:59:59', @seed_u02, DATE_SUB('2026-10-18 08:00:00', INTERVAL 8 DAY), NULL),
    (2, 'bd2fc34515d2825cce71d554679a3753ead6b141810704df08e1e76dbf901466', '1002', 'PRO_QUARTER', 3, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 19 DAY), '2027-06-30 23:59:59', @seed_u03, DATE_SUB('2026-10-18 08:00:00', INTERVAL 7 DAY), NULL),
    (3, '4e5ba732abbddd61b18127cb76fd78c4d2686f27fc9936dec94ba5a3b6af5985', '1003', 'PRO_MONTH', 1, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY), '2027-06-30 23:59:59', @seed_u04, DATE_SUB('2026-10-18 08:00:00', INTERVAL 6 DAY), NULL),
    (4, '41437cba9fcb65ba7ee2c1496e7f4a87f688c6709eb32f9eec414110b16e1dac', '1004', 'PRO_YEAR', 12, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY), '2027-06-30 23:59:59', @seed_u06, DATE_SUB('2026-10-18 08:00:00', INTERVAL 5 DAY), NULL),
    (5, 'cff9a86847a47205c759db97179d1f7a358c6377ed1550ae281484a593ecc975', '1005', 'PRO_QUARTER', 3, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), '2027-06-30 23:59:59', @seed_u07, DATE_SUB('2026-10-18 08:00:00', INTERVAL 4 DAY), NULL),
    (6, '53c04109909465bb998682bf14b7d1e18b1c33ebdbef41241b685730382e39fd', '1006', 'PRO_MONTH', 1, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), '2027-06-30 23:59:59', @seed_u08, DATE_SUB('2026-10-18 08:00:00', INTERVAL 3 DAY), NULL),
    (7, 'efe172ed753ccda337b810b6809aaf9c71ab1fb0f8fe14d0022b746d9dbab771', '1007', 'PRO_YEAR', 12, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), '2027-06-30 23:59:59', @seed_u09, DATE_SUB('2026-10-18 08:00:00', INTERVAL 2 DAY), NULL),
    (8, '2d5890e182dbb2a41c78d970a8af4419c2b3617bb22a24ed7914724e5b9a2eb7', '1008', 'PRO_QUARTER', 3, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), '2027-06-30 23:59:59', @seed_u10, DATE_SUB('2026-10-18 08:00:00', INTERVAL 1 DAY), NULL),
    (9, '7a3f3bc44f4f4beba4f94a9a005f9a2de07f4f783be9fd45ed53a475d1153be5', '1009', 'PRO_MONTH', 1, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), '2027-06-30 23:59:59', NULL, NULL, NULL),
    (10, '83faa17ebd12e5dc7c14e5a32d24f453e837b64de9d568aad2636904117d9168', '1010', 'PRO_YEAR', 12, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), '2027-06-30 23:59:59', NULL, NULL, NULL),
    (11, '5c277ce6e4ec2c69b73bdda974fd5b7dc2be46c3f7074deb360995c0642fc898', '1011', 'PRO_QUARTER', 3, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), '2027-06-30 23:59:59', NULL, NULL, NULL),
    (12, '9fb937dd490e3cdb874346b5ea8542e279d2e82e80b13df786ff52c4b0fb7639', '1012', 'PRO_MONTH', 1, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), '2027-06-30 23:59:59', NULL, NULL, NULL),
    (13, '156881e406e102f8d160e83150725d9c0d93b1453308599d4bf7418157d0d43a', '1013', 'PRO_YEAR', 12, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), '2027-06-30 23:59:59', NULL, NULL, NULL),
    (14, 'cfe5a52b9114bcb8a2a7eee7f188d8a9064049ca30c265a8079099e3c09bd8f9', '1014', 'PRO_QUARTER', 3, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), '2027-06-30 23:59:59', NULL, NULL, NULL),
    (15, 'dcac2f563587ba62f2703dacc0e30e579238e40852f4dfde04eac5f7218415c2', '1015', 'PRO_MONTH', 1, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), '2027-06-30 23:59:59', NULL, NULL, NULL),
    (16, '98a592eba730e8d7ce81d87393a277b7af56cf4dd893bf63bcec326e142643b4', '1016', 'PRO_YEAR', 12, @seed_u01, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), '2027-06-30 23:59:59', NULL, NULL, '2026-10-19 08:00:00')
    ON DUPLICATE KEY UPDATE redeemed_by = VALUES(redeemed_by), revoked_at = VALUES(revoked_at);

    INSERT INTO learning_db.pro_activation_attempts (user_id, window_start, attempts) VALUES
    (@seed_u02, '2025-06-01 08:00:00', 1),
    (@seed_u03, '2025-06-01 08:00:00', 2),
    (@seed_u04, '2025-06-01 08:00:00', 3),
    (@seed_u05, '2025-06-01 08:00:00', 1),
    (@seed_u06, '2025-06-01 08:00:00', 2),
    (@seed_u07, '2025-06-01 08:00:00', 3),
    (@seed_u08, '2025-06-01 08:00:00', 1),
    (@seed_u09, '2025-06-01 08:00:00', 2),
    (@seed_u10, '2025-06-01 08:00:00', 3),
    (@seed_u11, '2025-06-01 08:00:00', 1),
    (@seed_u12, '2025-06-01 08:00:00', 2),
    (@seed_u13, '2025-06-01 08:00:00', 3),
    (@seed_u14, '2025-06-01 08:00:00', 1),
    (@seed_u15, '2025-06-01 08:00:00', 2),
    (@seed_u16, '2025-06-01 08:00:00', 3)
    ON DUPLICATE KEY UPDATE attempts = VALUES(attempts);

    INSERT INTO learning_db.learner_admin_adjustments (id, user_id, actor_id, request_id, gems_delta, xp_delta, target_level, freezes_delta, restored_streak, gems_before, gems_after, xp_before, xp_after, freezes_before, freezes_after, reason, created_at) VALUES
    (1, @seed_u02, @seed_u01, 'seed-adj-req-0001', 50, 100, NULL, 1, NULL, 370, 420, 1350, 1450, 1, 2, 'Thưởng hoàn thành thử thách học tập tuần 1 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (2, @seed_u03, @seed_u01, 'seed-adj-req-0002', 50, 100, NULL, 1, NULL, 260, 310, 1020, 1120, 1, 2, 'Thưởng hoàn thành thử thách học tập tuần 2 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (3, @seed_u04, @seed_u01, 'seed-adj-req-0003', 50, 100, NULL, 1, NULL, 135, 185, 580, 680, 0, 1, 'Thưởng hoàn thành thử thách học tập tuần 3 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (4, @seed_u05, @seed_u01, 'seed-adj-req-0004', 50, 100, NULL, 1, NULL, 10, 60, 80, 180, 0, 1, 'Thưởng hoàn thành thử thách học tập tuần 4 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (5, @seed_u06, @seed_u01, 'seed-adj-req-0005', 50, 100, NULL, 1, NULL, 490, 540, 1590, 1690, 2, 3, 'Thưởng hoàn thành thử thách học tập tuần 1 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (6, @seed_u07, @seed_u01, 'seed-adj-req-0006', 50, 100, NULL, 1, NULL, 170, 220, 740, 840, 0, 1, 'Thưởng hoàn thành thử thách học tập tuần 2 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (7, @seed_u08, @seed_u01, 'seed-adj-req-0007', 50, 100, NULL, 1, NULL, 340, 390, 1240, 1340, 1, 2, 'Thưởng hoàn thành thử thách học tập tuần 3 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (8, @seed_u09, @seed_u01, 'seed-adj-req-0008', 50, 100, NULL, 1, NULL, 430, 480, 1420, 1520, 1, 2, 'Thưởng hoàn thành thử thách học tập tuần 4 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (9, @seed_u10, @seed_u01, 'seed-adj-req-0009', 50, 100, NULL, 1, NULL, 290, 340, 1180, 1280, 0, 1, 'Thưởng hoàn thành thử thách học tập tuần 1 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (10, @seed_u11, @seed_u01, 'seed-adj-req-0010', 50, 100, NULL, 1, NULL, 240, 290, 860, 960, 0, 1, 'Thưởng hoàn thành thử thách học tập tuần 2 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (11, @seed_u12, @seed_u01, 'seed-adj-req-0011', 50, 100, NULL, 1, NULL, 560, 610, 1680, 1780, 2, 3, 'Thưởng hoàn thành thử thách học tập tuần 3 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (12, @seed_u13, @seed_u01, 'seed-adj-req-0012', 50, 100, NULL, 1, NULL, 100, 150, 440, 540, 0, 1, 'Thưởng hoàn thành thử thách học tập tuần 4 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    (13, @seed_u14, @seed_u01, 'seed-adj-req-0013', 50, 100, NULL, 1, NULL, 280, 330, 980, 1080, 1, 2, 'Thưởng hoàn thành thử thách học tập tuần 1 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (14, @seed_u15, @seed_u01, 'seed-adj-req-0014', 50, 100, NULL, 1, NULL, 225, 275, 810, 910, 0, 1, 'Thưởng hoàn thành thử thách học tập tuần 2 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY)),
    (15, @seed_u16, @seed_u01, 'seed-adj-req-0015', 50, 100, NULL, 1, NULL, 740, 790, 2240, 2340, 3, 4, 'Thưởng hoàn thành thử thách học tập tuần 3 trên ChitChatGo.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE reason = VALUES(reason);

    INSERT INTO learning_db.learning_admin_audit (id, actor_id, action, target, description, created_at) VALUES
    (1, @seed_u01, 'SHOP_CREATE', 'shop:FRAME_STAR_SCHOLAR', 'Thêm khung avatar Học giả ánh sao (LEGENDARY).', DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (2, @seed_u01, 'SHOP_CREATE', 'shop:FRAME_SAKURA_VIP', 'Thêm khung avatar Anh đào mùa thi (LEGENDARY).', DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (3, @seed_u01, 'SHOP_CREATE', 'shop:BACKGROUND_STARLIGHT', 'Thêm ảnh nền Đêm ôn thi ngàn sao (LEGENDARY).', DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (4, @seed_u01, 'REWARD_CREATE', 'rule:STREAK_14', 'Tạo mốc thưởng chuỗi học tập 14 ngày (+140 Gems).', DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (5, @seed_u01, 'REWARD_CREATE', 'rule:STREAK_21', 'Tạo mốc thưởng chuỗi học tập 21 ngày (+210 Gems).', DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (6, @seed_u01, 'REWARD_CREATE', 'rule:LEVEL_10', 'Tạo mốc thưởng đạt cấp độ 10 (+220 Gems).', DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (7, @seed_u01, 'PRO_CODE_CREATE', 'code:1001..1016', 'Phát hành lô 16 mã kích hoạt ChitChatGo Pro cho chiến dịch học bổng.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (8, @seed_u01, 'PRO_CODE_REVOKE', 'code:1016', 'Thu hồi mã kích hoạt dự phòng kết thúc đợt kiểm thử.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (9, @seed_u01, 'PRO_GRANT', 'user:hoang.van.e', 'Xác nhận gia hạn thành công gói Pro 1 tháng.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (10, @seed_u01, 'GEM_ADJUST', 'user:phan.my.duyen', 'Cộng thưởng 50 Gems sự kiện Top Dictation tháng 10.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (11, @seed_u01, 'COMMUNITY_MODERATE', 'post:18', 'Duyệt bài viết thành lập nhóm tự học TOEIC 850+.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (12, @seed_u01, 'TOEIC_PUBLISH', 'exam:seed-toeic-practice-01', 'Công bố bộ luyện nhanh TOEIC Practice Set 01.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (13, @seed_u01, 'TOEIC_PUBLISH', 'exam:seed-toeic-practice-11', 'Công bố bộ luyện nghe TOEIC Listening Mini 11.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    (14, @seed_u01, 'DICTATION_PUBLISH', 'exercise:seed-dict-ex-01', 'Xuất bản bài nghe chép chính tả Morning Stand-up Check-in.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (15, @seed_u01, 'DICTATION_SYNC', 'workbook:local', 'Đồng bộ 15 workbook bài luyện Dictation với kho local.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY)),
    (16, @seed_u01, 'ENGAGEMENT_CONFIG_VIEW', 'settings:1', 'Kiểm tra cấu hình XP bài học (20), XP quiz (10) và Gems ngày (25).', DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE description = VALUES(description);

    INSERT INTO learning_db.gem_topup_receipts (order_code, user_id, gems, created_at) VALUES
    ('ORD-GEM-2026-0001', @seed_u02, 200, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    ('ORD-GEM-2026-0002', @seed_u03, 500, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    ('ORD-GEM-2026-0003', @seed_u04, 1200, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    ('ORD-GEM-2026-0004', @seed_u06, 200, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    ('ORD-GEM-2026-0005', @seed_u07, 500, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    ('ORD-GEM-2026-0006', @seed_u08, 1200, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    ('ORD-GEM-2026-0007', @seed_u09, 200, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    ('ORD-GEM-2026-0008', @seed_u10, 500, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    ('ORD-GEM-2026-0009', @seed_u11, 1200, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    ('ORD-GEM-2026-0010', @seed_u12, 200, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    ('ORD-GEM-2026-0011', @seed_u13, 500, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    ('ORD-GEM-2026-0012', @seed_u14, 1200, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    ('ORD-GEM-2026-0013', @seed_u15, 200, DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    ('ORD-GEM-2026-0014', @seed_u16, 500, DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    ('ORD-GEM-2026-0015', @seed_u17, 1200, DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY))
    ON DUPLICATE KEY UPDATE gems = VALUES(gems);

    INSERT INTO learning_db.toeic_exams (id, slug, seed_key, title, description, duration_minutes, source_label, question_count, lesson_count, definition_json, section, published, deleted, version, created_at, updated_at) VALUES
    (910001, 'seed-toeic-practice-01', 'seed-toeic-practice-01', 'TOEIC Practice Set 01 · Word Forms & Office Notices', 'Bộ đề luyện Reading đầy đủ Part 5–7 tập trung phân tích từ loại, email văn phòng và thông báo sự kiện.', 25, 'ChitChatGo TOEIC Reading · Set 01', 6, 1, '{"slug":"seed-toeic-practice-01","title":"TOEIC Practice Set 01 · Word Forms & Office Notices","description":"Bộ đề luyện Reading đầy đủ Part 5–7 tập trung phân tích từ loại, email văn phòng và thông báo sự kiện.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 01","lessons":[{"id":"lesson-guide-01","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 01 · Word Forms & Office Notices","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r1_101","number":101,"part":5,"passage":null,"prompt":"The marketing team will _____ the new campaign brochure before Monday.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"finalize"},{"id":"B","text":"final"},{"id":"C","text":"finally"},{"id":"D","text":"finality"}],"correctOptionId":"A","explanation":"Sau trợ động từ \\"will\\" cần động từ nguyên mẫu (finalize).","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 101","listening":null},{"id":"r1_102","number":102,"part":5,"passage":null,"prompt":"Customers who register early receive a _____ twenty-percent discount.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"substantial"},{"id":"B","text":"substance"},{"id":"C","text":"substantially"},{"id":"D","text":"substantiate"}],"correctOptionId":"A","explanation":"Trước cụm danh từ \\"twenty-percent discount\\" cần tính từ (substantial).","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 102","listening":null},{"id":"r1_131","number":131,"part":6,"passage":"Memo: Onboarding Schedule Update\\nWelcome to Northstar Solutions! All new hires should arrive at Lobby B by 8:45 A.M. on Monday. (131) _____ Light refreshments will be served before the orientation begins at 9:15 A.M. Please contact HR (132) _____ you need parking validation.","prompt":"Choose the best sentence for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Please bring a photo ID to receive your access badge."},{"id":"B","text":"The cafeteria closes early every Friday."},{"id":"C","text":"Parking permits expired last autumn."},{"id":"D","text":"Several flights were delayed due to fog."}],"correctOptionId":"A","explanation":"Câu (A) nối tiếp hợp lý quy trình nhận thẻ nhân viên mới trong buổi onboarding.","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 131","listening":null},{"id":"r1_132","number":132,"part":6,"passage":"Memo: Onboarding Schedule Update\\nWelcome to Northstar Solutions! All new hires should arrive at Lobby B by 8:45 A.M. on Monday. (131) _____ Light refreshments will be served before the orientation begins at 9:15 A.M. Please contact HR (132) _____ you need parking validation.","prompt":"Choose the best word for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"if"},{"id":"B","text":"despite"},{"id":"C","text":"during"},{"id":"D","text":"unless of"}],"correctOptionId":"A","explanation":"Cần liên từ điều kiện \\"if\\" trước mệnh đề \\"you need parking validation\\".","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 132","listening":null},{"id":"r1_147","number":147,"part":7,"passage":"NOTICE: Central Library Community Workshop\\nLearn practical digital productivity tools this Saturday from 10:00 A.M. to 12:30 P.M. in Room 204. Admission is free for all library cardholders. To reserve a seat, complete the registration form on the library web portal before Thursday at 5:00 P.M.","prompt":"How can residents register for the community workshop?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"By completing the online form on the library portal"},{"id":"B","text":"By mailing a printed postcard"},{"id":"C","text":"By visiting city hall on Sunday"},{"id":"D","text":"By calling the local radio station"}],"correctOptionId":"A","explanation":"Thông báo ghi rõ đăng ký qua biểu mẫu trực tuyến trên cổng thông tin thư viện.","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 147","listening":null},{"id":"r1_148","number":148,"part":7,"passage":"NOTICE: Central Library Community Workshop\\nLearn practical digital productivity tools this Saturday from 10:00 A.M. to 12:30 P.M. in Room 204. Admission is free for all library cardholders. To reserve a seat, complete the registration form on the library web portal before Thursday at 5:00 P.M.","prompt":"What is required for free admission?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Holding a valid library card"},{"id":"B","text":"Bringing a personal projector"},{"id":"C","text":"Paying a materials deposit"},{"id":"D","text":"Attending an orientation on Friday"}],"correctOptionId":"A","explanation":"Câu \\"Admission is free for all library cardholders\\" khẳng định đáp án (A).","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-01"}', 'READING', TRUE, FALSE, 1, NOW(6), NOW(6)),
    (910002, 'seed-toeic-practice-02', 'seed-toeic-practice-02', 'TOEIC Practice Set 02 · Conjunctions & Logistics', 'Luyện Reading đủ Part 5–7 về liên từ, giới từ, email vận chuyển và đơn hàng doanh nghiệp.', 25, 'ChitChatGo TOEIC Reading · Set 02', 6, 1, '{"slug":"seed-toeic-practice-02","title":"TOEIC Practice Set 02 · Conjunctions & Logistics","description":"Luyện Reading đủ Part 5–7 về liên từ, giới từ, email vận chuyển và đơn hàng doanh nghiệp.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 02","lessons":[{"id":"lesson-guide-02","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 02 · Conjunctions & Logistics","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r2_101","number":101,"part":5,"passage":null,"prompt":"_____ the revised budget was approved, construction of the new lab began.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Once"},{"id":"B","text":"During"},{"id":"C","text":"Despite"},{"id":"D","text":"Because of"}],"correctOptionId":"A","explanation":"Theo sau là mệnh đề hoàn chỉnh nên dùng liên từ thời gian \\"Once\\".","source":"ChitChatGo TOEIC Reading · Set 02 · Câu 101","listening":null},{"id":"r2_102","number":102,"part":5,"passage":null,"prompt":"Please submit the signed contract _____ Friday afternoon to avoid processing delays.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"by"},{"id":"B","text":"until to"},{"id":"C","text":"among"},{"id":"D","text":"between"}],"correctOptionId":"A","explanation":"Dùng giới từ \\"by\\" để chỉ hạn chót trước một mốc thời gian.","source":"ChitChatGo TOEIC Reading · Set 02 · Câu 102","listening":null},{"id":"r2_131","number":131,"part":6,"passage":"To: Operations Team\\nSubject: Warehouse Audit\\nOur annual inventory check will take place this Thursday. All shipping cartons must be labeled (131) _____ before 4:00 P.M. Wednesday. (132) _____ Thank you for your cooperation.","prompt":"Choose the best word for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"accurately"},{"id":"B","text":"accurate"},{"id":"C","text":"accuracy"},{"id":"D","text":"accuracies"}],"correctOptionId":"A","explanation":"Cần trạng từ \\"accurately\\" bổ nghĩa cho động từ \\"be labeled\\".","source":"ChitChatGo TOEIC Reading · Set 02 · Câu 131","listening":null},{"id":"r2_132","number":132,"part":6,"passage":"To: Operations Team\\nSubject: Warehouse Audit\\nOur annual inventory check will take place this Thursday. All shipping cartons must be labeled (131) _____ before 4:00 P.M. Wednesday. (132) _____ Thank you for your cooperation.","prompt":"Choose the best sentence for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Supervisors will verify each aisle checklist at 5:00 P.M."},{"id":"B","text":"The cafe menu will feature seasonal soup."},{"id":"C","text":"New laptops were ordered for the design team."},{"id":"D","text":"The bus route was extended downtown."}],"correctOptionId":"A","explanation":"Câu (A) nối tiếp trực tiếp quy trình kiểm kho của giám sát viên.","source":"ChitChatGo TOEIC Reading · Set 02 · Câu 132","listening":null},{"id":"r2_147","number":147,"part":7,"passage":"From: Lan Nguyen <lan@harborcraft.vn>\\nTo: Support <support@northstar-logistics.com>\\nSubject: Delayed Shipment #NS-4821\\nOur studio ordered four display monitors on October 2, scheduled to arrive yesterday. According to tracking, the parcel is still held at the regional hub. Please confirm the revised delivery date.","prompt":"Why did Ms. Nguyen contact Northstar Logistics?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"To inquire about a delayed equipment shipment"},{"id":"B","text":"To cancel an annual subscription"},{"id":"C","text":"To apply for a warehouse supervisor role"},{"id":"D","text":"To book a conference room"}],"correctOptionId":"A","explanation":"Email hỏi về kiện hàng màn hình bị trễ tại trung tâm trung chuyển.","source":"ChitChatGo TOEIC Reading · Set 02 · Câu 147","listening":null},{"id":"r2_148","number":148,"part":7,"passage":"From: Lan Nguyen <lan@harborcraft.vn>\\nTo: Support <support@northstar-logistics.com>\\nSubject: Delayed Shipment #NS-4821\\nOur studio ordered four display monitors on October 2, scheduled to arrive yesterday. According to tracking, the parcel is still held at the regional hub. Please confirm the revised delivery date.","prompt":"What does Ms. Nguyen ask support to provide?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"An updated delivery date"},{"id":"B","text":"A replacement monitor model"},{"id":"C","text":"A printed catalog of warehouses"},{"id":"D","text":"A refund for express shipping"}],"correctOptionId":"A","explanation":"Câu cuối yêu cầu xác nhận ngày giao hàng mới (\\"revised delivery date\\").","source":"ChitChatGo TOEIC Reading · Set 02 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-02"}', 'READING', TRUE, FALSE, 1, NOW(6), NOW(6)),
    (910003, 'seed-toeic-practice-03', 'seed-toeic-practice-03', 'TOEIC Practice Set 03 · Verb Tenses & IT Policies', 'Ôn luyện Reading Part 5–7 về chia thì, câu bị động, lịch bảo trì hệ thống và hướng dẫn nội bộ.', 25, 'ChitChatGo TOEIC Reading · Set 03', 6, 1, '{"slug":"seed-toeic-practice-03","title":"TOEIC Practice Set 03 · Verb Tenses & IT Policies","description":"Ôn luyện Reading Part 5–7 về chia thì, câu bị động, lịch bảo trì hệ thống và hướng dẫn nội bộ.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 03","lessons":[{"id":"lesson-guide-03","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 03 · Verb Tenses & IT Policies","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r3_101","number":101,"part":5,"passage":null,"prompt":"All expense receipts must _____ within ten business days of the trip.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"be submitted"},{"id":"B","text":"submit"},{"id":"C","text":"submitting"},{"id":"D","text":"have submitted"}],"correctOptionId":"A","explanation":"Chủ ngữ \\"expense receipts\\" chịu tác động → bị động sau modal: must be submitted.","source":"ChitChatGo TOEIC Reading · Set 03 · Câu 101","listening":null},{"id":"r3_102","number":102,"part":5,"passage":null,"prompt":"The software update _____ yesterday resolves several display issues.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"released"},{"id":"B","text":"releasing"},{"id":"C","text":"release"},{"id":"D","text":"releases"}],"correctOptionId":"A","explanation":"Rút gọn mệnh đề quan hệ bị động: (which was) released yesterday.","source":"ChitChatGo TOEIC Reading · Set 03 · Câu 102","listening":null},{"id":"r3_131","number":131,"part":6,"passage":"IT Maintenance Bulletin\\nEmployees are reminded that the main database server will undergo scheduled maintenance (131) _____ Sunday from 1:00 A.M. to 4:00 A.M. (132) _____ Normal access will resume automatically afterward.","prompt":"Choose the best preposition for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"on"},{"id":"B","text":"at"},{"id":"C","text":"in"},{"id":"D","text":"into"}],"correctOptionId":"A","explanation":"Dùng giới từ \\"on\\" trước thứ trong tuần (on Sunday).","source":"ChitChatGo TOEIC Reading · Set 03 · Câu 131","listening":null},{"id":"r3_132","number":132,"part":6,"passage":"IT Maintenance Bulletin\\nEmployees are reminded that the main database server will undergo scheduled maintenance (131) _____ Sunday from 1:00 A.M. to 4:00 A.M. (132) _____ Normal access will resume automatically afterward.","prompt":"Choose the best sentence for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Please save your work and log out before midnight."},{"id":"B","text":"The office gym will open two hours earlier."},{"id":"C","text":"Travel vouchers are available at reception."},{"id":"D","text":"New interns will join the sales branch next month."}],"correctOptionId":"A","explanation":"Câu (A) đưa hướng dẫn phù hợp trước giờ bảo trì máy chủ.","source":"ChitChatGo TOEIC Reading · Set 03 · Câu 132","listening":null},{"id":"r3_147","number":147,"part":7,"passage":"ANNUAL TECH SUMMIT — SCHEDULE CHANGE\\nDue to high attendance, the Data Privacy Compliance seminar originally scheduled for Room 302 at 2:00 P.M. has been moved to Auditorium B on the first floor. All other sessions, including the 9:00 A.M. Opening Keynote, remain unchanged.","prompt":"Which seminar session has been moved to Auditorium B?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Data Privacy Compliance at 2:00 P.M."},{"id":"B","text":"Opening Keynote at 9:00 A.M."},{"id":"C","text":"Networking Lunch at 12:00 P.M."},{"id":"D","text":"Closing Remarks at 4:30 P.M."}],"correctOptionId":"A","explanation":"Thông báo nêu rõ phiên Data Privacy Compliance lúc 2:00 P.M. chuyển sang Auditorium B.","source":"ChitChatGo TOEIC Reading · Set 03 · Câu 147","listening":null},{"id":"r3_148","number":148,"part":7,"passage":"ANNUAL TECH SUMMIT — SCHEDULE CHANGE\\nDue to high attendance, the Data Privacy Compliance seminar originally scheduled for Room 302 at 2:00 P.M. has been moved to Auditorium B on the first floor. All other sessions, including the 9:00 A.M. Opening Keynote, remain unchanged.","prompt":"Why was the session relocated?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Because more people registered than expected"},{"id":"B","text":"Because Room 302 lost electrical power"},{"id":"C","text":"Because the keynote speaker arrived late"},{"id":"D","text":"Because Auditorium B is closer to the parking lot"}],"correctOptionId":"A","explanation":"Cụm \\"Due to high attendance\\" cho biết số người tham dự đông.","source":"ChitChatGo TOEIC Reading · Set 03 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-03"}', 'READING', TRUE, FALSE, 1, NOW(6), NOW(6)),
    (910004, 'seed-toeic-practice-04', 'seed-toeic-practice-04', 'TOEIC Practice Set 04 · Business Emails & Hospitality', 'Thực hành Reading Part 5–7 chủ đề khách sạn, công tác quốc tế và giao dịch dịch vụ khách hàng.', 25, 'ChitChatGo TOEIC Reading · Set 04', 6, 1, '{"slug":"seed-toeic-practice-04","title":"TOEIC Practice Set 04 · Business Emails & Hospitality","description":"Thực hành Reading Part 5–7 chủ đề khách sạn, công tác quốc tế và giao dịch dịch vụ khách hàng.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 04","lessons":[{"id":"lesson-guide-04","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 04 · Business Emails & Hospitality","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r4_101","number":101,"part":5,"passage":null,"prompt":"Guests are encouraged to reserve airport shuttle seats at least 24 hours in _____.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"advance"},{"id":"B","text":"advancing"},{"id":"C","text":"advanced"},{"id":"D","text":"advancement"}],"correctOptionId":"A","explanation":"Cụm cố định \\"in advance\\" nghĩa là trước (thời hạn).","source":"ChitChatGo TOEIC Reading · Set 04 · Câu 101","listening":null},{"id":"r4_102","number":102,"part":5,"passage":null,"prompt":"The boutique hotel renovated its rooftop lounge to attract more _____ travelers.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"international"},{"id":"B","text":"internationally"},{"id":"C","text":"internationalize"},{"id":"D","text":"internationalism"}],"correctOptionId":"A","explanation":"Trước danh từ \\"travelers\\" cần tính từ (international).","source":"ChitChatGo TOEIC Reading · Set 04 · Câu 102","listening":null},{"id":"r4_131","number":131,"part":6,"passage":"Reservation Confirmation — Harborview Hotel\\nThank you for booking an Executive Suite for November 12–15. Your stay includes complimentary buffet breakfast and high-speed Wi-Fi (131) _____ the property. (132) _____","prompt":"Choose the best preposition for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"throughout"},{"id":"B","text":"between"},{"id":"C","text":"behind"},{"id":"D","text":"toward"}],"correctOptionId":"A","explanation":"\\"throughout the property\\" nghĩa là trên toàn bộ khuôn viên khách sạn.","source":"ChitChatGo TOEIC Reading · Set 04 · Câu 131","listening":null},{"id":"r4_132","number":132,"part":6,"passage":"Reservation Confirmation — Harborview Hotel\\nThank you for booking an Executive Suite for November 12–15. Your stay includes complimentary buffet breakfast and high-speed Wi-Fi (131) _____ the property. (132) _____","prompt":"Choose the best closing sentence for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Please let our concierge know if you require airport pickup."},{"id":"B","text":"Construction of the new bridge will begin next spring."},{"id":"C","text":"Monthly utility bills are due on the first Tuesday."},{"id":"D","text":"All library books must be returned within two weeks."}],"correctOptionId":"A","explanation":"Câu (A) là lời hỗ trợ tiêu chuẩn trong email xác nhận đặt phòng khách sạn.","source":"ChitChatGo TOEIC Reading · Set 04 · Câu 132","listening":null},{"id":"r4_147","number":147,"part":7,"passage":"EXECUTIVE ROOM BENEFITS\\nGuests booking an Executive Room directly through our website receive complimentary airport shuttle service and daily breakfast buffet. Late checkout until 2:00 P.M. is available upon request, subject to room availability.","prompt":"What is included free of charge with the executive room booking?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Airport shuttle service and breakfast buffet"},{"id":"B","text":"Private guided city tour"},{"id":"C","text":"Spa massage package"},{"id":"D","text":"International phone calls"}],"correctOptionId":"A","explanation":"Mục Benefits ghi rõ xe đưa đón sân bay và buffet sáng miễn phí (complimentary).","source":"ChitChatGo TOEIC Reading · Set 04 · Câu 147","listening":null},{"id":"r4_148","number":148,"part":7,"passage":"EXECUTIVE ROOM BENEFITS\\nGuests booking an Executive Room directly through our website receive complimentary airport shuttle service and daily breakfast buffet. Late checkout until 2:00 P.M. is available upon request, subject to room availability.","prompt":"What condition applies to late checkout?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"It depends on room availability"},{"id":"B","text":"It requires a minimum seven-night stay"},{"id":"C","text":"It is only offered on Sundays"},{"id":"D","text":"It costs an extra fifty dollars"}],"correctOptionId":"A","explanation":"Cụm \\"subject to room availability\\" nghĩa là tùy tình trạng phòng trống.","source":"ChitChatGo TOEIC Reading · Set 04 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-04"}', 'READING', TRUE, FALSE, 1, NOW(6), NOW(6)),
    (910005, 'seed-toeic-practice-05', 'seed-toeic-practice-05', 'TOEIC Practice Set 05 · HR & Recruitment Reading', 'Luyện Reading Part 5–7 với từ vựng nhân sự, tin tuyển dụng và quy trình đánh giá ứng viên.', 25, 'ChitChatGo TOEIC Reading · Set 05', 6, 1, '{"slug":"seed-toeic-practice-05","title":"TOEIC Practice Set 05 · HR & Recruitment Reading","description":"Luyện Reading Part 5–7 với từ vựng nhân sự, tin tuyển dụng và quy trình đánh giá ứng viên.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 05","lessons":[{"id":"lesson-guide-05","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 05 · HR & Recruitment Reading","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r5_101","number":101,"part":5,"passage":null,"prompt":"Applicants with relevant project management experience will be given _____.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"priority"},{"id":"B","text":"prioritize"},{"id":"C","text":"prior"},{"id":"D","text":"prioritized"}],"correctOptionId":"A","explanation":"Cụm \\"be given priority\\" nghĩa là được ưu tiên.","source":"ChitChatGo TOEIC Reading · Set 05 · Câu 101","listening":null},{"id":"r5_102","number":102,"part":5,"passage":null,"prompt":"The hiring committee interviewed six candidates _____ selecting the final two.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"before"},{"id":"B","text":"although"},{"id":"C","text":"unless"},{"id":"D","text":"whereas"}],"correctOptionId":"A","explanation":"Trước V-ing \\"selecting\\" dùng giới từ \\"before\\".","source":"ChitChatGo TOEIC Reading · Set 05 · Câu 102","listening":null},{"id":"r5_131","number":131,"part":6,"passage":"Job Posting: Product Analyst\\nCloudBridge is seeking an analytical specialist to support our regional expansion. Candidates should have at least three years of experience (131) _____ SQL and dashboard reporting. (132) _____","prompt":"Choose the best preposition for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"with"},{"id":"B","text":"from"},{"id":"C","text":"into"},{"id":"D","text":"onto"}],"correctOptionId":"A","explanation":"Cụm tự nhiên \\"experience with + công cụ/kỹ năng\\".","source":"ChitChatGo TOEIC Reading · Set 05 · Câu 131","listening":null},{"id":"r5_132","number":132,"part":6,"passage":"Job Posting: Product Analyst\\nCloudBridge is seeking an analytical specialist to support our regional expansion. Candidates should have at least three years of experience (131) _____ SQL and dashboard reporting. (132) _____","prompt":"Choose the best sentence for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Qualified applicants may upload a resume via our careers page."},{"id":"B","text":"The elevator near Wing C is temporarily out of service."},{"id":"C","text":"Seasonal produce arrives at the market each morning."},{"id":"D","text":"Tickets for the concert sold out within minutes."}],"correctOptionId":"A","explanation":"Câu (A) hướng dẫn cách nộp hồ sơ ứng tuyển.","source":"ChitChatGo TOEIC Reading · Set 05 · Câu 132","listening":null},{"id":"r5_147","number":147,"part":7,"passage":"INTERNAL REFERRAL PROGRAM\\nEmployees who refer a qualified candidate for an engineering or product opening will receive a 5,000,000 VND bonus once the new hire completes their 60-day probation period. Submit referrals through the HR portal before the candidate applies independently.","prompt":"When is the referral bonus paid to an employee?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"After the referred hire finishes a 60-day probation"},{"id":"B","text":"Immediately when the resume is uploaded"},{"id":"C","text":"On the day of the technical interview"},{"id":"D","text":"At the end of the calendar year"}],"correctOptionId":"A","explanation":"Đoạn văn nêu thưởng chi trả sau khi nhân sự mới hoàn tất 60 ngày thử việc.","source":"ChitChatGo TOEIC Reading · Set 05 · Câu 147","listening":null},{"id":"r5_148","number":148,"part":7,"passage":"INTERNAL REFERRAL PROGRAM\\nEmployees who refer a qualified candidate for an engineering or product opening will receive a 5,000,000 VND bonus once the new hire completes their 60-day probation period. Submit referrals through the HR portal before the candidate applies independently.","prompt":"What must employees do for a referral to count?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Submit it on the HR portal before the candidate applies alone"},{"id":"B","text":"Attend the final interview panel in person"},{"id":"C","text":"Work in the same department as the open position"},{"id":"D","text":"Send a printed recommendation letter to the CEO"}],"correctOptionId":"A","explanation":"Câu cuối yêu cầu gửi giới thiệu qua cổng HR trước khi ứng viên tự ứng tuyển.","source":"ChitChatGo TOEIC Reading · Set 05 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-05"}', 'READING', TRUE, FALSE, 1, NOW(6), NOW(6)),
    (910006, 'seed-toeic-practice-06', 'seed-toeic-practice-06', 'TOEIC Practice Set 06 · Finance & Budgeting', 'Luyện Reading Part 5–7 chủ đề kế toán, báo cáo quý, hóa đơn và phê duyệt chi phí.', 25, 'ChitChatGo TOEIC Reading · Set 06', 6, 1, '{"slug":"seed-toeic-practice-06","title":"TOEIC Practice Set 06 · Finance & Budgeting","description":"Luyện Reading Part 5–7 chủ đề kế toán, báo cáo quý, hóa đơn và phê duyệt chi phí.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 06","lessons":[{"id":"lesson-guide-06","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 06 · Finance & Budgeting","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r6_101","number":101,"part":5,"passage":null,"prompt":"Quarterly operating costs declined _____ after the company consolidated two regional offices.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"significantly"},{"id":"B","text":"significant"},{"id":"C","text":"significance"},{"id":"D","text":"signify"}],"correctOptionId":"A","explanation":"Cần trạng từ \\"significantly\\" bổ nghĩa cho động từ \\"declined\\".","source":"ChitChatGo TOEIC Reading · Set 06 · Câu 101","listening":null},{"id":"r6_102","number":102,"part":5,"passage":null,"prompt":"Neither the finance director _____ the lead auditor found any discrepancies in the ledger.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"nor"},{"id":"B","text":"or"},{"id":"C","text":"and"},{"id":"D","text":"but"}],"correctOptionId":"A","explanation":"Cặp liên từ tương quan chuẩn: Neither ... nor ...","source":"ChitChatGo TOEIC Reading · Set 06 · Câu 102","listening":null},{"id":"r6_131","number":131,"part":6,"passage":"Accounting Notice — Q3 Closing\\nDepartment heads must finalize all vendor invoices by October 28 so the finance team can close Q3 books (131) _____ schedule. (132) _____","prompt":"Choose the best preposition for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"on"},{"id":"B","text":"at"},{"id":"C","text":"by"},{"id":"D","text":"of"}],"correctOptionId":"A","explanation":"Cụm cố định \\"on schedule\\" nghĩa là đúng tiến độ.","source":"ChitChatGo TOEIC Reading · Set 06 · Câu 131","listening":null},{"id":"r6_132","number":132,"part":6,"passage":"Accounting Notice — Q3 Closing\\nDepartment heads must finalize all vendor invoices by October 28 so the finance team can close Q3 books (131) _____ schedule. (132) _____","prompt":"Choose the best sentence for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Late submissions will be recorded under the Q4 budget instead."},{"id":"B","text":"Free umbrellas are available by the main lobby entrance."},{"id":"C","text":"The robotics exhibition opens to students next week."},{"id":"D","text":"All company vans were washed yesterday morning."}],"correctOptionId":"A","explanation":"Câu (A) nêu rõ hậu quả nếu nộp hóa đơn trễ hạn chốt sổ quý 3.","source":"ChitChatGo TOEIC Reading · Set 06 · Câu 132","listening":null},{"id":"r6_147","number":147,"part":7,"passage":"INVOICE SUMMARY #INV-8830\\nClient: Sunrise Edu Corp · Issue Date: Oct 10 · Payment Terms: Net 15.\\nItems: Annual LMS Hosting ($1,200) + Priority Support ($300) = $1,500.\\nA 5% early-payment discount applies if paid by October 17.","prompt":"How much can Sunrise Edu Corp save by paying by October 17?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"5% off the total invoice amount"},{"id":"B","text":"15% off the hosting fee only"},{"id":"C","text":"Free priority support for two years"},{"id":"D","text":"$300 off the next invoice"}],"correctOptionId":"A","explanation":"Hóa đơn áp dụng giảm 5% nếu thanh toán sớm trước ngày 17/10.","source":"ChitChatGo TOEIC Reading · Set 06 · Câu 147","listening":null},{"id":"r6_148","number":148,"part":7,"passage":"INVOICE SUMMARY #INV-8830\\nClient: Sunrise Edu Corp · Issue Date: Oct 10 · Payment Terms: Net 15.\\nItems: Annual LMS Hosting ($1,200) + Priority Support ($300) = $1,500.\\nA 5% early-payment discount applies if paid by October 17.","prompt":"When is the standard payment due date?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"October 25 (15 days after issue)"},{"id":"B","text":"October 10"},{"id":"C","text":"November 15"},{"id":"D","text":"December 1"}],"correctOptionId":"A","explanation":"Issue Date Oct 10 + Payment Terms Net 15 = hạn chuẩn là ngày 25/10.","source":"ChitChatGo TOEIC Reading · Set 06 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-06"}', 'READING', TRUE, FALSE, 1, NOW(6), NOW(6)),
    (910007, 'seed-toeic-practice-07', 'seed-toeic-practice-07', 'TOEIC Practice Set 07 · Marketing & Product Launch', 'Luyện Reading Part 5–7 về chiến dịch ra mắt sản phẩm, khảo sát khách hàng và báo chí.', 25, 'ChitChatGo TOEIC Reading · Set 07', 6, 1, '{"slug":"seed-toeic-practice-07","title":"TOEIC Practice Set 07 · Marketing & Product Launch","description":"Luyện Reading Part 5–7 về chiến dịch ra mắt sản phẩm, khảo sát khách hàng và báo chí.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 07","lessons":[{"id":"lesson-guide-07","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 07 · Marketing & Product Launch","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r7_101","number":101,"part":5,"passage":null,"prompt":"_____ the heavy rain, the outdoor product launch proceeded smoothly.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Despite"},{"id":"B","text":"Although"},{"id":"C","text":"Even though"},{"id":"D","text":"Because"}],"correctOptionId":"A","explanation":"Theo sau là cụm danh từ \\"the heavy rain\\" nên dùng giới từ \\"Despite\\".","source":"ChitChatGo TOEIC Reading · Set 07 · Câu 101","listening":null},{"id":"r7_102","number":102,"part":5,"passage":null,"prompt":"The new ergonomic keyboard was designed specifically to _____ wrist strain.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"minimize"},{"id":"B","text":"minimum"},{"id":"C","text":"minimal"},{"id":"D","text":"minimally"}],"correctOptionId":"A","explanation":"Sau \\"to\\" chỉ mục đích cần động từ nguyên mẫu (minimize).","source":"ChitChatGo TOEIC Reading · Set 07 · Câu 102","listening":null},{"id":"r7_131","number":131,"part":6,"passage":"Press Release: AeroNote Tablet\\nToday Lumina Tech unveiled the AeroNote 11, a lightweight tablet built for note-taking. Weighing just 410 grams, the device offers up to 14 hours of battery life (131) _____ a single charge. (132) _____","prompt":"Choose the best preposition for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"on"},{"id":"B","text":"into"},{"id":"C","text":"among"},{"id":"D","text":"beside"}],"correctOptionId":"A","explanation":"Cụm chuẩn công nghệ: \\"on a single charge\\" (trên một lần sạc).","source":"ChitChatGo TOEIC Reading · Set 07 · Câu 131","listening":null},{"id":"r7_132","number":132,"part":6,"passage":"Press Release: AeroNote Tablet\\nToday Lumina Tech unveiled the AeroNote 11, a lightweight tablet built for note-taking. Weighing just 410 grams, the device offers up to 14 hours of battery life (131) _____ a single charge. (132) _____","prompt":"Choose the best sentence for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Pre-orders open online this Friday at participating retailers."},{"id":"B","text":"The highway tunnel will close for repainting tonight."},{"id":"C","text":"Fresh pastries are baked every hour at the bakery."},{"id":"D","text":"Our gardening club meets on the first Sunday of each month."}],"correctOptionId":"A","explanation":"Câu (A) thông báo thời điểm mở đặt trước phù hợp thông cáo báo chí sản phẩm.","source":"ChitChatGo TOEIC Reading · Set 07 · Câu 132","listening":null},{"id":"r7_147","number":147,"part":7,"passage":"CUSTOMER FEEDBACK SUMMARY\\nIn our September survey of 450 subscribers, 88% rated lesson audio clarity as \\"excellent,\\" while 34% requested an offline download option for commuting. Our mobile team plans to release offline caching in Q1.","prompt":"What feature did one-third of respondents request?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Offline download capability for commuting"},{"id":"B","text":"Larger textbook print fonts"},{"id":"C","text":"More weekend customer phone hours"},{"id":"D","text":"Lower annual membership pricing"}],"correctOptionId":"A","explanation":"34% người tham gia khảo sát đề xuất tính năng tải ngoại tuyến khi di chuyển.","source":"ChitChatGo TOEIC Reading · Set 07 · Câu 147","listening":null},{"id":"r7_148","number":148,"part":7,"passage":"CUSTOMER FEEDBACK SUMMARY\\nIn our September survey of 450 subscribers, 88% rated lesson audio clarity as \\"excellent,\\" while 34% requested an offline download option for commuting. Our mobile team plans to release offline caching in Q1.","prompt":"When does the mobile team plan to ship offline caching?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"In the first quarter (Q1)"},{"id":"B","text":"Immediately this week"},{"id":"C","text":"Next September"},{"id":"D","text":"Only for desktop browsers"}],"correctOptionId":"A","explanation":"Câu cuối ghi rõ kế hoạch phát hành vào Q1.","source":"ChitChatGo TOEIC Reading · Set 07 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-07"}', 'READING', TRUE, FALSE, 1, NOW(6), NOW(6)),
    (910008, 'seed-toeic-practice-08', 'seed-toeic-practice-08', 'TOEIC Practice Set 08 · Contracts & Agreements', 'Luyện Reading Part 5–7 về hợp đồng dịch vụ, điều khoản gia hạn và thông báo pháp lý.', 25, 'ChitChatGo TOEIC Reading · Set 08', 6, 1, '{"slug":"seed-toeic-practice-08","title":"TOEIC Practice Set 08 · Contracts & Agreements","description":"Luyện Reading Part 5–7 về hợp đồng dịch vụ, điều khoản gia hạn và thông báo pháp lý.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 08","lessons":[{"id":"lesson-guide-08","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 08 · Contracts & Agreements","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r8_101","number":101,"part":5,"passage":null,"prompt":"Please find the updated service agreement _____ to this email.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"attached"},{"id":"B","text":"attaching"},{"id":"C","text":"attachment"},{"id":"D","text":"attach"}],"correctOptionId":"A","explanation":"Cấu trúc \\"find + O + V3/ed (attached)\\" rất quen thuộc trong email TOEIC.","source":"ChitChatGo TOEIC Reading · Set 08 · Câu 101","listening":null},{"id":"r8_102","number":102,"part":5,"passage":null,"prompt":"Either party may terminate the contract by providing thirty days written _____.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"notice"},{"id":"B","text":"notify"},{"id":"C","text":"notified"},{"id":"D","text":"notifying"}],"correctOptionId":"A","explanation":"Sau tính từ \\"written\\" cần danh từ \\"notice\\" (thông báo bằng văn bản).","source":"ChitChatGo TOEIC Reading · Set 08 · Câu 102","listening":null},{"id":"r8_131","number":131,"part":6,"passage":"Renewal Reminder — Enterprise License\\nYour organization''s annual cloud license will expire on December 31. Renewing before December 15 locks in your current rate (131) _____ any price adjustment next year. (132) _____","prompt":"Choose the best preposition for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"without"},{"id":"B","text":"between"},{"id":"C","text":"inside"},{"id":"D","text":"underneath"}],"correctOptionId":"A","explanation":"\\"without any price adjustment\\" nghĩa là không bị điều chỉnh tăng giá.","source":"ChitChatGo TOEIC Reading · Set 08 · Câu 131","listening":null},{"id":"r8_132","number":132,"part":6,"passage":"Renewal Reminder — Enterprise License\\nYour organization''s annual cloud license will expire on December 31. Renewing before December 15 locks in your current rate (131) _____ any price adjustment next year. (132) _____","prompt":"Choose the best sentence for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"To approve renewal, simply sign the attached quote."},{"id":"B","text":"The museum gift shop accepts major credit cards."},{"id":"C","text":"Rain showers are forecast for the coastal region."},{"id":"D","text":"Bicycles must be parked in the designated rack outside."}],"correctOptionId":"A","explanation":"Câu (A) hướng dẫn bước ký báo giá để xác nhận gia hạn.","source":"ChitChatGo TOEIC Reading · Set 08 · Câu 132","listening":null},{"id":"r8_147","number":147,"part":7,"passage":"SERVICE LEVEL AGREEMENT (SLA) EXCERPT\\nProvider guarantees 99.9% monthly uptime for core platform APIs. Scheduled maintenance windows announced at least 72 hours beforehand are excluded from downtime calculations. Credits must be requested within 15 days of an outage.","prompt":"What is excluded from downtime calculations?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Maintenance announced at least 72 hours in advance"},{"id":"B","text":"Unplanned network outages during peak hours"},{"id":"C","text":"Customer support ticket response times"},{"id":"D","text":"Database storage capacity upgrades"}],"correctOptionId":"A","explanation":"Lịch bảo trì thông báo trước tối thiểu 72 giờ được loại trừ khỏi tính thời gian ngừng hoạt động.","source":"ChitChatGo TOEIC Reading · Set 08 · Câu 147","listening":null},{"id":"r8_148","number":148,"part":7,"passage":"SERVICE LEVEL AGREEMENT (SLA) EXCERPT\\nProvider guarantees 99.9% monthly uptime for core platform APIs. Scheduled maintenance windows announced at least 72 hours beforehand are excluded from downtime calculations. Credits must be requested within 15 days of an outage.","prompt":"How soon must a client request a service credit after an outage?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Within 15 days"},{"id":"B","text":"Within 24 hours"},{"id":"C","text":"Within 60 days"},{"id":"D","text":"Before the end of the next year"}],"correctOptionId":"A","explanation":"Câu cuối nêu rõ yêu cầu bồi hoàn phải gửi trong vòng 15 ngày.","source":"ChitChatGo TOEIC Reading · Set 08 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-08"}', 'READING', TRUE, FALSE, 1, NOW(6), NOW(6)),
    (910009, 'seed-toeic-practice-09', 'seed-toeic-practice-09', 'TOEIC Practice Set 09 · Corporate Training & Events', 'Luyện Reading Part 5–7 chủ đề đào tạo nhân sự, hội thảo và quản lý dự án.', 25, 'ChitChatGo TOEIC Reading · Set 09', 6, 1, '{"slug":"seed-toeic-practice-09","title":"TOEIC Practice Set 09 · Corporate Training & Events","description":"Luyện Reading Part 5–7 chủ đề đào tạo nhân sự, hội thảo và quản lý dự án.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 09","lessons":[{"id":"lesson-guide-09","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 09 · Corporate Training & Events","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r9_101","number":101,"part":5,"passage":null,"prompt":"The regional director requested that every manager _____ the leadership workshop.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"attend"},{"id":"B","text":"attended"},{"id":"C","text":"attending"},{"id":"D","text":"to attend"}],"correctOptionId":"A","explanation":"Cấu trúc giả định: request + that + S + V nguyên mẫu (attend).","source":"ChitChatGo TOEIC Reading · Set 09 · Câu 101","listening":null},{"id":"r9_102","number":102,"part":5,"passage":null,"prompt":"Participants will receive a digital certificate upon successful _____ of all modules.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"completion"},{"id":"B","text":"complete"},{"id":"C","text":"completed"},{"id":"D","text":"completely"}],"correctOptionId":"A","explanation":"Sau tính từ \\"successful\\" và trước \\"of\\" cần danh từ \\"completion\\".","source":"ChitChatGo TOEIC Reading · Set 09 · Câu 102","listening":null},{"id":"r9_131","number":131,"part":6,"passage":"Training Announcement\\nNext month, the Learning & Development team is launching a four-week business writing course. Sessions will be held every Tuesday afternoon (131) _____ Zoom. (132) _____","prompt":"Choose the best preposition for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"via"},{"id":"B","text":"beside"},{"id":"C","text":"under"},{"id":"D","text":"from"}],"correctOptionId":"A","explanation":"Dùng \\"via Zoom\\" nghĩa là thông qua nền tảng Zoom.","source":"ChitChatGo TOEIC Reading · Set 09 · Câu 131","listening":null},{"id":"r9_132","number":132,"part":6,"passage":"Training Announcement\\nNext month, the Learning & Development team is launching a four-week business writing course. Sessions will be held every Tuesday afternoon (131) _____ Zoom. (132) _____","prompt":"Choose the best sentence for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Space is limited to twenty attendees per cohort."},{"id":"B","text":"The rooftop pool closes for winter in October."},{"id":"C","text":"Fresh coffee beans are roasted in our downtown cafe."},{"id":"D","text":"Local trains run every ten minutes during rush hour."}],"correctOptionId":"A","explanation":"Câu (A) nêu giới hạn sĩ số lớp đào tạo rất hợp ngữ cảnh.","source":"ChitChatGo TOEIC Reading · Set 09 · Câu 132","listening":null},{"id":"r9_147","number":147,"part":7,"passage":"WORKSHOP REGISTRATION CONFIRMATION\\nYou are enrolled in \\"Effective Stakeholder Presentations\\" on November 8 (1:30 P.M. – 4:30 P.M.). Please upload a 3-slide sample deck by November 5 so the instructor can prepare personalized feedback during the live coaching segment.","prompt":"What are attendees asked to submit before November 5?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"A three-slide sample presentation deck"},{"id":"B","text":"A recorded thirty-minute video lecture"},{"id":"C","text":"A signed travel reimbursement voucher"},{"id":"D","text":"A printed copy of the company handbook"}],"correctOptionId":"A","explanation":"Thông báo yêu cầu tải lên bộ 3 slide mẫu trước ngày 5/11 để giảng viên góp ý.","source":"ChitChatGo TOEIC Reading · Set 09 · Câu 147","listening":null},{"id":"r9_148","number":148,"part":7,"passage":"WORKSHOP REGISTRATION CONFIRMATION\\nYou are enrolled in \\"Effective Stakeholder Presentations\\" on November 8 (1:30 P.M. – 4:30 P.M.). Please upload a 3-slide sample deck by November 5 so the instructor can prepare personalized feedback during the live coaching segment.","prompt":"How long does the workshop last?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Three hours"},{"id":"B","text":"Ninety minutes"},{"id":"C","text":"Two full days"},{"id":"D","text":"Five hours"}],"correctOptionId":"A","explanation":"Từ 1:30 P.M. đến 4:30 P.M. là đúng 3 giờ.","source":"ChitChatGo TOEIC Reading · Set 09 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-09"}', 'READING', TRUE, FALSE, 1, NOW(6), NOW(6)),
    (910010, 'seed-toeic-practice-10', 'seed-toeic-practice-10', 'TOEIC Practice Set 10 · Retail & Customer Support', 'Luyện Reading Part 5–7 chủ đề bán lẻ, bảo hành sản phẩm và chính sách đổi trả.', 25, 'ChitChatGo TOEIC Reading · Set 10', 6, 1, '{"slug":"seed-toeic-practice-10","title":"TOEIC Practice Set 10 · Retail & Customer Support","description":"Luyện Reading Part 5–7 chủ đề bán lẻ, bảo hành sản phẩm và chính sách đổi trả.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 10","lessons":[{"id":"lesson-guide-10","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 10 · Retail & Customer Support","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r10_101","number":101,"part":5,"passage":null,"prompt":"All warranty claims must be accompanied by the _____ sales receipt.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"original"},{"id":"B","text":"originally"},{"id":"C","text":"originate"},{"id":"D","text":"originality"}],"correctOptionId":"A","explanation":"Trước cụm danh từ \\"sales receipt\\" cần tính từ \\"original\\".","source":"ChitChatGo TOEIC Reading · Set 10 · Câu 101","listening":null},{"id":"r10_102","number":102,"part":5,"passage":null,"prompt":"Our support center operates seven days a week to assist customers _____.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"promptly"},{"id":"B","text":"prompt"},{"id":"C","text":"promptness"},{"id":"D","text":"prompted"}],"correctOptionId":"A","explanation":"Cần trạng từ \\"promptly\\" bổ nghĩa cho động từ \\"assist\\".","source":"ChitChatGo TOEIC Reading · Set 10 · Câu 102","listening":null},{"id":"r10_131","number":131,"part":6,"passage":"Store Policy Update — Meadow Home Goods\\nEffective November 1, unopened items may be returned for a full refund within 30 days of purchase. Items returned (131) _____ a receipt qualify for store credit at the current selling price. (132) _____","prompt":"Choose the best preposition for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"without"},{"id":"B","text":"among"},{"id":"C","text":"across"},{"id":"D","text":"toward"}],"correctOptionId":"A","explanation":"Hàng trả lại \\"without a receipt\\" (không có hóa đơn) sẽ nhận store credit.","source":"ChitChatGo TOEIC Reading · Set 10 · Câu 131","listening":null},{"id":"r10_132","number":132,"part":6,"passage":"Store Policy Update — Meadow Home Goods\\nEffective November 1, unopened items may be returned for a full refund within 30 days of purchase. Items returned (131) _____ a receipt qualify for store credit at the current selling price. (132) _____","prompt":"Choose the best sentence for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Clearance merchandise marked final sale is not eligible for return."},{"id":"B","text":"The annual marathon route passes through City Park."},{"id":"C","text":"Passengers should check gate monitors for boarding updates."},{"id":"D","text":"Our accounting software backs up files every midnight."}],"correctOptionId":"A","explanation":"Câu (A) bổ sung ngoại lệ cho hàng thanh lý trong chính sách đổi trả.","source":"ChitChatGo TOEIC Reading · Set 10 · Câu 132","listening":null},{"id":"r10_147","number":147,"part":7,"passage":"EXTENDED WARRANTY NOTICE\\nEvery BrewMaster espresso machine comes with a standard one-year manufacturer warranty covering parts and labor. Register your serial number online within 30 days of purchase to receive an additional six months of coverage at no extra cost.","prompt":"How can customers extend their warranty by six months for free?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"By registering the serial number online within 30 days"},{"id":"B","text":"By purchasing an annual coffee bean subscription"},{"id":"C","text":"By mailing the original box back to the factory"},{"id":"D","text":"By visiting a service center every quarter"}],"correctOptionId":"A","explanation":"Đăng ký số serial trực tuyến trong 30 ngày sẽ được tặng thêm 6 tháng bảo hành.","source":"ChitChatGo TOEIC Reading · Set 10 · Câu 147","listening":null},{"id":"r10_148","number":148,"part":7,"passage":"EXTENDED WARRANTY NOTICE\\nEvery BrewMaster espresso machine comes with a standard one-year manufacturer warranty covering parts and labor. Register your serial number online within 30 days of purchase to receive an additional six months of coverage at no extra cost.","prompt":"What does the standard warranty cover?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Both replacement parts and repair labor"},{"id":"B","text":"Accidental drops and cosmetic scratches only"},{"id":"C","text":"Shipping costs for international moves"},{"id":"D","text":"Free monthly descaling powder"}],"correctOptionId":"A","explanation":"Đoạn văn nêu rõ \\"covering parts and labor\\".","source":"ChitChatGo TOEIC Reading · Set 10 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-10"}', 'READING', TRUE, FALSE, 1, NOW(6), NOW(6)),
    (910011, 'seed-toeic-practice-11', 'seed-toeic-practice-11', 'TOEIC Listening Practice 01 · Office & Daily Routines', 'Bộ đề luyện nghe đầy đủ Part 1–4 với hình ảnh minh họa, câu hỏi phản hồi, hội thoại và thông báo.', 20, 'ChitChatGo TOEIC Listening · Set 01', 6, 1, '{"slug":"seed-toeic-practice-11","title":"TOEIC Listening Practice 01 · Office & Daily Routines","description":"Bộ đề luyện nghe đầy đủ Part 1–4 với hình ảnh minh họa, câu hỏi phản hồi, hội thoại và thông báo.","durationMinutes":20,"sourceLabel":"ChitChatGo TOEIC Listening · Set 01","lessons":[{"id":"lesson-guide-11","title":"Chiến thuật Listening Part 1–4 · TOEIC Listening Practice 01 · Office & Daily Routines","content":"MỤC TIÊU\\nLuyện đủ 4 phần TOEIC Listening (Part 1, Part 2, Part 3, Part 4) kèm transcript và đáp án chi tiết."}],"questions":[{"id":"l11_01","number":1,"part":1,"passage":null,"prompt":"","imageUrl":"/toeic-assets/ets2024-listening/test01/question-001.webp","passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""},{"id":"D","text":""}],"correctOptionId":"A","explanation":"Nghe mô tả đúng hành động/khung cảnh trong hình.","source":"ChitChatGo TOEIC Listening · Set 01 · Câu 1","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-001.mp3","transcript":"Number 1. Look at the picture.\\n(A) She is reviewing documents outdoors.\\n(B) She is waiting in line at a food truck.\\n(C) She is wiping off a bench.\\n(D) She is throwing away a plate."}},{"id":"l11_07","number":7,"part":2,"passage":null,"prompt":"","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""}],"correctOptionId":"A","explanation":"Chọn câu phản hồi trực tiếp đúng từ để hỏi.","source":"ChitChatGo TOEIC Listening · Set 01 · Câu 7","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-007.mp3","transcript":"Number 7. Where will the quarterly sales review be held?\\n(A) In Conference Room 4B on the third floor.\\n(B) Yes, sales grew by twelve percent.\\n(C) About forty-five minutes."}},{"id":"l11_32","number":32,"part":3,"passage":null,"prompt":"What event are the speakers discussing?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"An annual company picnic"},{"id":"B","text":"A quarterly board election"},{"id":"C","text":"A software release party"},{"id":"D","text":"A warehouse safety audit"}],"correctOptionId":"A","explanation":"Đối chiếu câu mở đầu trong đoạn hội thoại Part 3.","source":"ChitChatGo TOEIC Listening · Set 01 · Câu 32","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-032-034.mp3","transcript":"Man: Thank you for organizing the annual company picnic. The food was great.\\nWoman: I am glad everyone enjoyed it! I can send you the online link to the peach pie recipe."}},{"id":"l11_33","number":33,"part":3,"passage":null,"prompt":"What does the woman offer to send the man?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"A link to a recipe Web page"},{"id":"B","text":"A revised travel itinerary"},{"id":"C","text":"A copy of the catering invoice"},{"id":"D","text":"Photos from the conference"}],"correctOptionId":"A","explanation":"Đối chiếu hành động tiếp theo trong đoạn hội thoại Part 3.","source":"ChitChatGo TOEIC Listening · Set 01 · Câu 33","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-032-034.mp3","transcript":"Man: Thank you for organizing the annual company picnic. The food was great.\\nWoman: I am glad everyone enjoyed it! I can send you the online link to the peach pie recipe."}},{"id":"l11_71","number":71,"part":4,"passage":null,"prompt":"Where is this announcement most likely being made?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"At an airport terminal"},{"id":"B","text":"Inside a subway station"},{"id":"C","text":"At a hotel reception desk"},{"id":"D","text":"In a corporate cafeteria"}],"correctOptionId":"A","explanation":"Xác định bối cảnh/mục đích của bài nói ngắn Part 4.","source":"ChitChatGo TOEIC Listening · Set 01 · Câu 71","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-071-073.mp3","transcript":"Attention passengers: Flight 402 to Singapore will begin boarding at Gate 14 in ten minutes. Please have your boarding pass and photo ID ready for inspection."}},{"id":"l11_72","number":72,"part":4,"passage":null,"prompt":"What are listeners asked to prepare before boarding?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Their boarding pass and photo ID"},{"id":"B","text":"Their checked luggage receipts"},{"id":"C","text":"Their hotel reservation emails"},{"id":"D","text":"Their duty-free shopping bags"}],"correctOptionId":"A","explanation":"Bắt thông tin chi tiết được nhấn mạnh trong bài nói Part 4.","source":"ChitChatGo TOEIC Listening · Set 01 · Câu 72","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-071-073.mp3","transcript":"Attention passengers: Flight 402 to Singapore will begin boarding at Gate 14 in ten minutes. Please have your boarding pass and photo ID ready for inspection."}}],"published":true,"version":1,"seedKey":"seed-toeic-practice-11"}', 'LISTENING', TRUE, FALSE, 1, NOW(6), NOW(6)),
    (910012, 'seed-toeic-practice-12', 'seed-toeic-practice-12', 'TOEIC Listening Practice 02 · Meetings & Schedules', 'Luyện nghe đủ 4 phần Part 1–4 chủ đề lịch họp, thiết bị phòng họp và thông báo nội bộ.', 20, 'ChitChatGo TOEIC Listening · Set 02', 6, 1, '{"slug":"seed-toeic-practice-12","title":"TOEIC Listening Practice 02 · Meetings & Schedules","description":"Luyện nghe đủ 4 phần Part 1–4 chủ đề lịch họp, thiết bị phòng họp và thông báo nội bộ.","durationMinutes":20,"sourceLabel":"ChitChatGo TOEIC Listening · Set 02","lessons":[{"id":"lesson-guide-12","title":"Chiến thuật Listening Part 1–4 · TOEIC Listening Practice 02 · Meetings & Schedules","content":"MỤC TIÊU\\nLuyện đủ 4 phần TOEIC Listening (Part 1, Part 2, Part 3, Part 4) kèm transcript và đáp án chi tiết."}],"questions":[{"id":"l12_01","number":1,"part":1,"passage":null,"prompt":"","imageUrl":"/toeic-assets/ets2024-listening/test01/question-002.webp","passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""},{"id":"D","text":""}],"correctOptionId":"A","explanation":"Nghe mô tả đúng hành động/khung cảnh trong hình.","source":"ChitChatGo TOEIC Listening · Set 02 · Câu 1","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-002.mp3","transcript":"Number 2. Look at the picture.\\n(A) Two colleagues are collaborating at a table.\\n(B) A technician is replacing a ceiling bulb.\\n(C) Chairs are stacked near the window.\\n(D) A delivery driver is unloading boxes."}},{"id":"l12_07","number":7,"part":2,"passage":null,"prompt":"","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""}],"correctOptionId":"A","explanation":"Chọn câu phản hồi trực tiếp đúng từ để hỏi.","source":"ChitChatGo TOEIC Listening · Set 02 · Câu 7","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-008.mp3","transcript":"Number 8. Who is leading the client onboarding call tomorrow?\\n(A) Ms. Tran from the enterprise team.\\n(B) At ten thirty in the morning.\\n(C) No, the brochure is already printed."}},{"id":"l12_32","number":32,"part":3,"passage":null,"prompt":"What problem do the speakers mention?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"The HDMI cable is missing from the meeting room"},{"id":"B","text":"The conference room was double-booked"},{"id":"C","text":"The slide deck failed to export"},{"id":"D","text":"The client arrived an hour early"}],"correctOptionId":"A","explanation":"Đối chiếu câu mở đầu trong đoạn hội thoại Part 3.","source":"ChitChatGo TOEIC Listening · Set 02 · Câu 32","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-035-037.mp3","transcript":"Woman: The projector in Room 3A is missing its HDMI cable, and our client demo starts in fifteen minutes.\\nMan: No problem—I will borrow a spare adapter from the IT help desk right now."}},{"id":"l12_33","number":33,"part":3,"passage":null,"prompt":"What does the man say he will do next?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Borrow a spare adapter from the IT help desk"},{"id":"B","text":"Reschedule the demo for next Monday"},{"id":"C","text":"Print paper handouts for the clients"},{"id":"D","text":"Move the session to the main lobby"}],"correctOptionId":"A","explanation":"Đối chiếu hành động tiếp theo trong đoạn hội thoại Part 3.","source":"ChitChatGo TOEIC Listening · Set 02 · Câu 33","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-035-037.mp3","transcript":"Woman: The projector in Room 3A is missing its HDMI cable, and our client demo starts in fifteen minutes.\\nMan: No problem—I will borrow a spare adapter from the IT help desk right now."}},{"id":"l12_71","number":71,"part":4,"passage":null,"prompt":"Why is the main parking garage unavailable on Friday?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"It is undergoing resurfacing work"},{"id":"B","text":"A trade fair is occupying the lot"},{"id":"C","text":"Security gates are being upgraded"},{"id":"D","text":"Heavy snow blocked the entrance"}],"correctOptionId":"A","explanation":"Xác định bối cảnh/mục đích của bài nói ngắn Part 4.","source":"ChitChatGo TOEIC Listening · Set 02 · Câu 71","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-074-076.mp3","transcript":"Good afternoon everyone. Because the main parking garage is being resurfaced this Friday, employees are encouraged to use the complimentary shuttle bus running every fifteen minutes from Metro Station West."}},{"id":"l12_72","number":72,"part":4,"passage":null,"prompt":"How often will the shuttle bus operate?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Every fifteen minutes"},{"id":"B","text":"Once every hour"},{"id":"C","text":"Only at 8:00 A.M. and 5:00 P.M."},{"id":"D","text":"Every forty-five minutes"}],"correctOptionId":"A","explanation":"Bắt thông tin chi tiết được nhấn mạnh trong bài nói Part 4.","source":"ChitChatGo TOEIC Listening · Set 02 · Câu 72","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-074-076.mp3","transcript":"Good afternoon everyone. Because the main parking garage is being resurfaced this Friday, employees are encouraged to use the complimentary shuttle bus running every fifteen minutes from Metro Station West."}}],"published":true,"version":1,"seedKey":"seed-toeic-practice-12"}', 'LISTENING', TRUE, FALSE, 1, NOW(6), NOW(6)),
    (910013, 'seed-toeic-practice-13', 'seed-toeic-practice-13', 'TOEIC Listening Practice 03 · Client Services & Travel', 'Luyện nghe đủ 4 phần Part 1–4 về tư vấn khách hàng, đặt lịch và hướng dẫn tham quan.', 20, 'ChitChatGo TOEIC Listening · Set 03', 6, 1, '{"slug":"seed-toeic-practice-13","title":"TOEIC Listening Practice 03 · Client Services & Travel","description":"Luyện nghe đủ 4 phần Part 1–4 về tư vấn khách hàng, đặt lịch và hướng dẫn tham quan.","durationMinutes":20,"sourceLabel":"ChitChatGo TOEIC Listening · Set 03","lessons":[{"id":"lesson-guide-13","title":"Chiến thuật Listening Part 1–4 · TOEIC Listening Practice 03 · Client Services & Travel","content":"MỤC TIÊU\\nLuyện đủ 4 phần TOEIC Listening (Part 1, Part 2, Part 3, Part 4) kèm transcript và đáp án chi tiết."}],"questions":[{"id":"l13_01","number":1,"part":1,"passage":null,"prompt":"","imageUrl":"/toeic-assets/ets2024-listening/test01/question-003.webp","passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""},{"id":"D","text":""}],"correctOptionId":"A","explanation":"Nghe mô tả đúng hành động/khung cảnh trong hình.","source":"ChitChatGo TOEIC Listening · Set 03 · Câu 1","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-003.mp3","transcript":"Number 3. Look at the picture.\\n(A) A display shelf is neatly organized.\\n(B) Customers are exiting a bookstore.\\n(C) A clerk is sweeping the sidewalk.\\n(D) Bicycles are lined up beside a fence."}},{"id":"l13_07","number":7,"part":2,"passage":null,"prompt":"","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""}],"correctOptionId":"A","explanation":"Chọn câu phản hồi trực tiếp đúng từ để hỏi.","source":"ChitChatGo TOEIC Listening · Set 03 · Câu 7","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-009.mp3","transcript":"Number 9. When will the revised design proposal be sent to the client?\\n(A) By Thursday afternoon at the latest.\\n(B) To the marketing department.\\n(C) Yes, the colors look much brighter."}},{"id":"l13_32","number":32,"part":3,"passage":null,"prompt":"Where is the conversation taking place?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"At a hotel front desk"},{"id":"B","text":"At a car rental counter"},{"id":"C","text":"Inside a travel agency"},{"id":"D","text":"At a conference registration booth"}],"correctOptionId":"A","explanation":"Đối chiếu câu mở đầu trong đoạn hội thoại Part 3.","source":"ChitChatGo TOEIC Listening · Set 03 · Câu 32","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-038-040.mp3","transcript":"Man: Welcome to Riverside Hotel. Your executive room on the eighth floor is ready.\\nWoman: Thank you! Could you tell me when the breakfast buffet opens tomorrow and whether shuttle vouchers are available here?"}},{"id":"l13_33","number":33,"part":3,"passage":null,"prompt":"What does the woman inquire about?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Breakfast hours and shuttle vouchers"},{"id":"B","text":"Gym membership discounts"},{"id":"C","text":"Conference hall audio equipment"},{"id":"D","text":"Nearby dry-cleaning shops"}],"correctOptionId":"A","explanation":"Đối chiếu hành động tiếp theo trong đoạn hội thoại Part 3.","source":"ChitChatGo TOEIC Listening · Set 03 · Câu 33","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-038-040.mp3","transcript":"Man: Welcome to Riverside Hotel. Your executive room on the eighth floor is ready.\\nWoman: Thank you! Could you tell me when the breakfast buffet opens tomorrow and whether shuttle vouchers are available here?"}},{"id":"l13_71","number":71,"part":4,"passage":null,"prompt":"Who is most likely speaking?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"A museum tour guide"},{"id":"B","text":"An airline flight attendant"},{"id":"C","text":"A university librarian"},{"id":"D","text":"A theater ticket manager"}],"correctOptionId":"A","explanation":"Xác định bối cảnh/mục đích của bài nói ngắn Part 4.","source":"ChitChatGo TOEIC Listening · Set 03 · Câu 71","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-077-079.mp3","transcript":"Welcome to the Harbor Design Museum. Before we begin our guided tour of the Modern Architecture wing, please silence mobile phones and note that flash photography is not permitted inside the galleries."}},{"id":"l13_72","number":72,"part":4,"passage":null,"prompt":"What restriction does the speaker mention?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Flash photography is prohibited in the galleries"},{"id":"B","text":"Water bottles cannot be brought into the lobby"},{"id":"C","text":"The tour group cannot exceed five visitors"},{"id":"D","text":"The gift shop closes before noon"}],"correctOptionId":"A","explanation":"Bắt thông tin chi tiết được nhấn mạnh trong bài nói Part 4.","source":"ChitChatGo TOEIC Listening · Set 03 · Câu 72","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-077-079.mp3","transcript":"Welcome to the Harbor Design Museum. Before we begin our guided tour of the Modern Architecture wing, please silence mobile phones and note that flash photography is not permitted inside the galleries."}}],"published":true,"version":1,"seedKey":"seed-toeic-practice-13"}', 'LISTENING', TRUE, FALSE, 1, NOW(6), NOW(6)),
    (910014, 'seed-toeic-practice-14', 'seed-toeic-practice-14', 'TOEIC Listening Practice 04 · Retail & Logistics', 'Luyện nghe đủ 4 phần Part 1–4 chủ đề đặt hàng, kho vận và bản tin doanh nghiệp.', 20, 'ChitChatGo TOEIC Listening · Set 04', 6, 1, '{"slug":"seed-toeic-practice-14","title":"TOEIC Listening Practice 04 · Retail & Logistics","description":"Luyện nghe đủ 4 phần Part 1–4 chủ đề đặt hàng, kho vận và bản tin doanh nghiệp.","durationMinutes":20,"sourceLabel":"ChitChatGo TOEIC Listening · Set 04","lessons":[{"id":"lesson-guide-14","title":"Chiến thuật Listening Part 1–4 · TOEIC Listening Practice 04 · Retail & Logistics","content":"MỤC TIÊU\\nLuyện đủ 4 phần TOEIC Listening (Part 1, Part 2, Part 3, Part 4) kèm transcript và đáp án chi tiết."}],"questions":[{"id":"l14_01","number":1,"part":1,"passage":null,"prompt":"","imageUrl":"/toeic-assets/ets2024-listening/test01/question-004.webp","passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""},{"id":"D","text":""}],"correctOptionId":"A","explanation":"Nghe mô tả đúng hành động/khung cảnh trong hình.","source":"ChitChatGo TOEIC Listening · Set 04 · Câu 1","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-004.mp3","transcript":"Number 4. Look at the picture.\\n(A) Workers are inspecting items in a workspace.\\n(B) A chef is slicing vegetables.\\n(C) Shoppers are carrying grocery bags.\\n(D) A painter is climbing a ladder."}},{"id":"l14_07","number":7,"part":2,"passage":null,"prompt":"","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""}],"correctOptionId":"A","explanation":"Chọn câu phản hồi trực tiếp đúng từ để hỏi.","source":"ChitChatGo TOEIC Listening · Set 04 · Câu 7","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-010.mp3","transcript":"Number 10. Have you reviewed the updated shipping rates yet?\\n(A) I plan to check them right after lunch.\\n(B) By express courier service.\\n(C) Three boxes of brochures."}},{"id":"l14_32","number":32,"part":3,"passage":null,"prompt":"Why is the woman calling?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Her order arrived missing two items"},{"id":"B","text":"The lamps were damaged in transit"},{"id":"C","text":"She wants to change the billing address"},{"id":"D","text":"She needs an invoice copy for accounting"}],"correctOptionId":"A","explanation":"Đối chiếu câu mở đầu trong đoạn hội thoại Part 3.","source":"ChitChatGo TOEIC Listening · Set 04 · Câu 32","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-041-043.mp3","transcript":"Woman: Hi, I am calling about Order 512. We received ten desk lamps instead of twelve.\\nMan: I sincerely apologize for the packing error. I will dispatch the remaining two lamps via overnight express today."}},{"id":"l14_33","number":33,"part":3,"passage":null,"prompt":"How will the man resolve the issue?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"By shipping the missing lamps via overnight express"},{"id":"B","text":"By issuing a store gift card"},{"id":"C","text":"By asking her to visit the nearest branch"},{"id":"D","text":"By canceling the entire order"}],"correctOptionId":"A","explanation":"Đối chiếu hành động tiếp theo trong đoạn hội thoại Part 3.","source":"ChitChatGo TOEIC Listening · Set 04 · Câu 33","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-041-043.mp3","transcript":"Woman: Hi, I am calling about Order 512. We received ten desk lamps instead of twelve.\\nMan: I sincerely apologize for the packing error. I will dispatch the remaining two lamps via overnight express today."}},{"id":"l14_71","number":71,"part":4,"passage":null,"prompt":"What is the purpose of the voicemail?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"To schedule delivery of an order that arrived early"},{"id":"B","text":"To report a backorder on office desks"},{"id":"C","text":"To promote a seasonal clearance sale"},{"id":"D","text":"To verify a credit card billing code"}],"correctOptionId":"A","explanation":"Xác định bối cảnh/mục đích của bài nói ngắn Part 4.","source":"ChitChatGo TOEIC Listening · Set 04 · Câu 71","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-080-082.mp3","transcript":"Hi, this is Minh calling from GreenLeaf Office Supplies. The ergonomic chairs you ordered have arrived at our warehouse earlier than expected. Please call us back to confirm whether Tuesday morning works for delivery."}},{"id":"l14_72","number":72,"part":4,"passage":null,"prompt":"What does Minh ask the listener to do?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Call back to confirm a Tuesday morning delivery slot"},{"id":"B","text":"Pick up the chairs directly at the warehouse"},{"id":"C","text":"Email a revised purchase order"},{"id":"D","text":"Sign a form on the delivery truck"}],"correctOptionId":"A","explanation":"Bắt thông tin chi tiết được nhấn mạnh trong bài nói Part 4.","source":"ChitChatGo TOEIC Listening · Set 04 · Câu 72","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-080-082.mp3","transcript":"Hi, this is Minh calling from GreenLeaf Office Supplies. The ergonomic chairs you ordered have arrived at our warehouse earlier than expected. Please call us back to confirm whether Tuesday morning works for delivery."}}],"published":true,"version":1,"seedKey":"seed-toeic-practice-14"}', 'LISTENING', TRUE, FALSE, 1, NOW(6), NOW(6)),
    (910015, 'seed-toeic-practice-15', 'seed-toeic-practice-15', 'TOEIC Listening Practice 05 · Tech & Corporate Events', 'Luyện nghe đủ 4 phần Part 1–4 chủ đề hội thảo công nghệ, văn phòng và đào tạo.', 20, 'ChitChatGo TOEIC Listening · Set 05', 6, 1, '{"slug":"seed-toeic-practice-15","title":"TOEIC Listening Practice 05 · Tech & Corporate Events","description":"Luyện nghe đủ 4 phần Part 1–4 chủ đề hội thảo công nghệ, văn phòng và đào tạo.","durationMinutes":20,"sourceLabel":"ChitChatGo TOEIC Listening · Set 05","lessons":[{"id":"lesson-guide-15","title":"Chiến thuật Listening Part 1–4 · TOEIC Listening Practice 05 · Tech & Corporate Events","content":"MỤC TIÊU\\nLuyện đủ 4 phần TOEIC Listening (Part 1, Part 2, Part 3, Part 4) kèm transcript và đáp án chi tiết."}],"questions":[{"id":"l15_01","number":1,"part":1,"passage":null,"prompt":"","imageUrl":"/toeic-assets/ets2024-listening/test01/question-005.webp","passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""},{"id":"D","text":""}],"correctOptionId":"A","explanation":"Nghe mô tả đúng hành động/khung cảnh trong hình.","source":"ChitChatGo TOEIC Listening · Set 05 · Câu 1","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-005.mp3","transcript":"Number 5. Look at the picture.\\n(A) People are gathered in a bright indoor space.\\n(B) Boats are docked along a pier.\\n(C) A bus is parked outside a stadium.\\n(D) Trees are being trimmed along a pathway."}},{"id":"l15_07","number":7,"part":2,"passage":null,"prompt":"","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""}],"correctOptionId":"A","explanation":"Chọn câu phản hồi trực tiếp đúng từ để hỏi.","source":"ChitChatGo TOEIC Listening · Set 05 · Câu 7","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-011.mp3","transcript":"Number 11. Why was the product roadmap briefing postponed?\\n(A) The lead engineer is attending a conference abroad.\\n(B) In the second-floor auditorium.\\n(C) Yes, the slides are ready."}},{"id":"l15_32","number":32,"part":3,"passage":null,"prompt":"What happens tonight according to the man?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Early-bird registration for a summit closes"},{"id":"B","text":"A production database migration begins"},{"id":"C","text":"Keynote speakers submit their slide decks"},{"id":"D","text":"The office badge system resets"}],"correctOptionId":"A","explanation":"Đối chiếu câu mở đầu trong đoạn hội thoại Part 3.","source":"ChitChatGo TOEIC Listening · Set 05 · Câu 32","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-044-046.mp3","transcript":"Man: Did you see that early-bird registration for the Annual Cloud Summit closes tonight?\\nWoman: Yes, I already signed up our whole backend team so we get digital access to all keynote recordings."}},{"id":"l15_33","number":33,"part":3,"passage":null,"prompt":"What benefit does the woman mention?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Digital access to all keynote recordings"},{"id":"B","text":"Complimentary hotel rooms downtown"},{"id":"C","text":"Free certification exam vouchers"},{"id":"D","text":"Reserved front-row banquet seating"}],"correctOptionId":"A","explanation":"Đối chiếu hành động tiếp theo trong đoạn hội thoại Part 3.","source":"ChitChatGo TOEIC Listening · Set 05 · Câu 33","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-044-046.mp3","transcript":"Man: Did you see that early-bird registration for the Annual Cloud Summit closes tonight?\\nWoman: Yes, I already signed up our whole backend team so we get digital access to all keynote recordings."}},{"id":"l15_71","number":71,"part":4,"passage":null,"prompt":"How can remote employees participate in the Town Hall?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"By watching the livestream"},{"id":"B","text":"By dialing an international hotline"},{"id":"C","text":"By visiting a partner coworking space"},{"id":"D","text":"By reading a printed transcript next week"}],"correctOptionId":"A","explanation":"Xác định bối cảnh/mục đích của bài nói ngắn Part 4.","source":"ChitChatGo TOEIC Listening · Set 05 · Câu 71","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-083-085.mp3","transcript":"Good morning, team. Just a quick reminder that our quarterly Town Hall begins at 3:00 P.M. in the main auditorium and will also be livestreamed for remote staff. Submit any Q&A questions through the internal portal before 1:00 P.M."}},{"id":"l15_72","number":72,"part":4,"passage":null,"prompt":"When is the deadline to submit Q&A questions?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Before 1:00 P.M."},{"id":"B","text":"At 3:00 P.M."},{"id":"C","text":"By Friday evening"},{"id":"D","text":"Immediately after the meeting"}],"correctOptionId":"A","explanation":"Bắt thông tin chi tiết được nhấn mạnh trong bài nói Part 4.","source":"ChitChatGo TOEIC Listening · Set 05 · Câu 72","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-083-085.mp3","transcript":"Good morning, team. Just a quick reminder that our quarterly Town Hall begins at 3:00 P.M. in the main auditorium and will also be livestreamed for remote staff. Submit any Q&A questions through the internal portal before 1:00 P.M."}}],"published":true,"version":1,"seedKey":"seed-toeic-practice-15"}', 'LISTENING', TRUE, FALSE, 1, NOW(6), NOW(6))
    ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), duration_minutes = VALUES(duration_minutes), source_label = VALUES(source_label), question_count = VALUES(question_count), lesson_count = VALUES(lesson_count), definition_json = VALUES(definition_json), section = VALUES(section);

    INSERT INTO learning_db.toeic_attempts (id, exam_id, user_id, mode, part, status, snapshot_json, answers_json, total_questions, score, correct_count, started_at, deadline_at, submitted_at) VALUES
    (910001, 910001, @seed_u02, 'EXAM', NULL, 'GRADED', '{"slug":"seed-toeic-practice-01","title":"TOEIC Practice Set 01 · Word Forms & Office Notices","description":"Bộ đề luyện Reading đầy đủ Part 5–7 tập trung phân tích từ loại, email văn phòng và thông báo sự kiện.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 01","lessons":[{"id":"lesson-guide-01","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 01 · Word Forms & Office Notices","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r1_101","number":101,"part":5,"passage":null,"prompt":"The marketing team will _____ the new campaign brochure before Monday.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"finalize"},{"id":"B","text":"final"},{"id":"C","text":"finally"},{"id":"D","text":"finality"}],"correctOptionId":"A","explanation":"Sau trợ động từ \\"will\\" cần động từ nguyên mẫu (finalize).","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 101","listening":null},{"id":"r1_102","number":102,"part":5,"passage":null,"prompt":"Customers who register early receive a _____ twenty-percent discount.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"substantial"},{"id":"B","text":"substance"},{"id":"C","text":"substantially"},{"id":"D","text":"substantiate"}],"correctOptionId":"A","explanation":"Trước cụm danh từ \\"twenty-percent discount\\" cần tính từ (substantial).","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 102","listening":null},{"id":"r1_131","number":131,"part":6,"passage":"Memo: Onboarding Schedule Update\\nWelcome to Northstar Solutions! All new hires should arrive at Lobby B by 8:45 A.M. on Monday. (131) _____ Light refreshments will be served before the orientation begins at 9:15 A.M. Please contact HR (132) _____ you need parking validation.","prompt":"Choose the best sentence for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Please bring a photo ID to receive your access badge."},{"id":"B","text":"The cafeteria closes early every Friday."},{"id":"C","text":"Parking permits expired last autumn."},{"id":"D","text":"Several flights were delayed due to fog."}],"correctOptionId":"A","explanation":"Câu (A) nối tiếp hợp lý quy trình nhận thẻ nhân viên mới trong buổi onboarding.","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 131","listening":null},{"id":"r1_132","number":132,"part":6,"passage":"Memo: Onboarding Schedule Update\\nWelcome to Northstar Solutions! All new hires should arrive at Lobby B by 8:45 A.M. on Monday. (131) _____ Light refreshments will be served before the orientation begins at 9:15 A.M. Please contact HR (132) _____ you need parking validation.","prompt":"Choose the best word for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"if"},{"id":"B","text":"despite"},{"id":"C","text":"during"},{"id":"D","text":"unless of"}],"correctOptionId":"A","explanation":"Cần liên từ điều kiện \\"if\\" trước mệnh đề \\"you need parking validation\\".","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 132","listening":null},{"id":"r1_147","number":147,"part":7,"passage":"NOTICE: Central Library Community Workshop\\nLearn practical digital productivity tools this Saturday from 10:00 A.M. to 12:30 P.M. in Room 204. Admission is free for all library cardholders. To reserve a seat, complete the registration form on the library web portal before Thursday at 5:00 P.M.","prompt":"How can residents register for the community workshop?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"By completing the online form on the library portal"},{"id":"B","text":"By mailing a printed postcard"},{"id":"C","text":"By visiting city hall on Sunday"},{"id":"D","text":"By calling the local radio station"}],"correctOptionId":"A","explanation":"Thông báo ghi rõ đăng ký qua biểu mẫu trực tuyến trên cổng thông tin thư viện.","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 147","listening":null},{"id":"r1_148","number":148,"part":7,"passage":"NOTICE: Central Library Community Workshop\\nLearn practical digital productivity tools this Saturday from 10:00 A.M. to 12:30 P.M. in Room 204. Admission is free for all library cardholders. To reserve a seat, complete the registration form on the library web portal before Thursday at 5:00 P.M.","prompt":"What is required for free admission?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Holding a valid library card"},{"id":"B","text":"Bringing a personal projector"},{"id":"C","text":"Paying a materials deposit"},{"id":"D","text":"Attending an orientation on Friday"}],"correctOptionId":"A","explanation":"Câu \\"Admission is free for all library cardholders\\" khẳng định đáp án (A).","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-01"}', '{"r1_101":"A","r1_102":"A","r1_131":"A","r1_132":"A","r1_147":"A","r1_148":"A"}', 6, 100, 6, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), INTERVAL 25 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 16 DAY)),
    (910002, 910002, @seed_u03, 'PRACTICE', 5, 'GRADED', '{"slug":"seed-toeic-practice-02","title":"TOEIC Practice Set 02 · Conjunctions & Logistics","description":"Luyện Reading đủ Part 5–7 về liên từ, giới từ, email vận chuyển và đơn hàng doanh nghiệp.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 02","lessons":[{"id":"lesson-guide-02","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 02 · Conjunctions & Logistics","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r2_101","number":101,"part":5,"passage":null,"prompt":"_____ the revised budget was approved, construction of the new lab began.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Once"},{"id":"B","text":"During"},{"id":"C","text":"Despite"},{"id":"D","text":"Because of"}],"correctOptionId":"A","explanation":"Theo sau là mệnh đề hoàn chỉnh nên dùng liên từ thời gian \\"Once\\".","source":"ChitChatGo TOEIC Reading · Set 02 · Câu 101","listening":null},{"id":"r2_102","number":102,"part":5,"passage":null,"prompt":"Please submit the signed contract _____ Friday afternoon to avoid processing delays.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"by"},{"id":"B","text":"until to"},{"id":"C","text":"among"},{"id":"D","text":"between"}],"correctOptionId":"A","explanation":"Dùng giới từ \\"by\\" để chỉ hạn chót trước một mốc thời gian.","source":"ChitChatGo TOEIC Reading · Set 02 · Câu 102","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-02"}', '{"r2_101":"A","r2_102":"A"}', 2, 100, 2, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), INTERVAL 25 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 15 DAY)),
    (910003, 910003, @seed_u04, 'PRACTICE', 5, 'GRADED', '{"slug":"seed-toeic-practice-03","title":"TOEIC Practice Set 03 · Verb Tenses & IT Policies","description":"Ôn luyện Reading Part 5–7 về chia thì, câu bị động, lịch bảo trì hệ thống và hướng dẫn nội bộ.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 03","lessons":[{"id":"lesson-guide-03","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 03 · Verb Tenses & IT Policies","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r3_101","number":101,"part":5,"passage":null,"prompt":"All expense receipts must _____ within ten business days of the trip.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"be submitted"},{"id":"B","text":"submit"},{"id":"C","text":"submitting"},{"id":"D","text":"have submitted"}],"correctOptionId":"A","explanation":"Chủ ngữ \\"expense receipts\\" chịu tác động → bị động sau modal: must be submitted.","source":"ChitChatGo TOEIC Reading · Set 03 · Câu 101","listening":null},{"id":"r3_102","number":102,"part":5,"passage":null,"prompt":"The software update _____ yesterday resolves several display issues.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"released"},{"id":"B","text":"releasing"},{"id":"C","text":"release"},{"id":"D","text":"releases"}],"correctOptionId":"A","explanation":"Rút gọn mệnh đề quan hệ bị động: (which was) released yesterday.","source":"ChitChatGo TOEIC Reading · Set 03 · Câu 102","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-03"}', '{"r3_101":"A","r3_102":"A"}', 2, 100, 2, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), INTERVAL 25 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 14 DAY)),
    (910004, 910004, @seed_u05, 'EXAM', NULL, 'GRADED', '{"slug":"seed-toeic-practice-04","title":"TOEIC Practice Set 04 · Business Emails & Hospitality","description":"Thực hành Reading Part 5–7 chủ đề khách sạn, công tác quốc tế và giao dịch dịch vụ khách hàng.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 04","lessons":[{"id":"lesson-guide-04","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 04 · Business Emails & Hospitality","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r4_101","number":101,"part":5,"passage":null,"prompt":"Guests are encouraged to reserve airport shuttle seats at least 24 hours in _____.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"advance"},{"id":"B","text":"advancing"},{"id":"C","text":"advanced"},{"id":"D","text":"advancement"}],"correctOptionId":"A","explanation":"Cụm cố định \\"in advance\\" nghĩa là trước (thời hạn).","source":"ChitChatGo TOEIC Reading · Set 04 · Câu 101","listening":null},{"id":"r4_102","number":102,"part":5,"passage":null,"prompt":"The boutique hotel renovated its rooftop lounge to attract more _____ travelers.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"international"},{"id":"B","text":"internationally"},{"id":"C","text":"internationalize"},{"id":"D","text":"internationalism"}],"correctOptionId":"A","explanation":"Trước danh từ \\"travelers\\" cần tính từ (international).","source":"ChitChatGo TOEIC Reading · Set 04 · Câu 102","listening":null},{"id":"r4_131","number":131,"part":6,"passage":"Reservation Confirmation — Harborview Hotel\\nThank you for booking an Executive Suite for November 12–15. Your stay includes complimentary buffet breakfast and high-speed Wi-Fi (131) _____ the property. (132) _____","prompt":"Choose the best preposition for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"throughout"},{"id":"B","text":"between"},{"id":"C","text":"behind"},{"id":"D","text":"toward"}],"correctOptionId":"A","explanation":"\\"throughout the property\\" nghĩa là trên toàn bộ khuôn viên khách sạn.","source":"ChitChatGo TOEIC Reading · Set 04 · Câu 131","listening":null},{"id":"r4_132","number":132,"part":6,"passage":"Reservation Confirmation — Harborview Hotel\\nThank you for booking an Executive Suite for November 12–15. Your stay includes complimentary buffet breakfast and high-speed Wi-Fi (131) _____ the property. (132) _____","prompt":"Choose the best closing sentence for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Please let our concierge know if you require airport pickup."},{"id":"B","text":"Construction of the new bridge will begin next spring."},{"id":"C","text":"Monthly utility bills are due on the first Tuesday."},{"id":"D","text":"All library books must be returned within two weeks."}],"correctOptionId":"A","explanation":"Câu (A) là lời hỗ trợ tiêu chuẩn trong email xác nhận đặt phòng khách sạn.","source":"ChitChatGo TOEIC Reading · Set 04 · Câu 132","listening":null},{"id":"r4_147","number":147,"part":7,"passage":"EXECUTIVE ROOM BENEFITS\\nGuests booking an Executive Room directly through our website receive complimentary airport shuttle service and daily breakfast buffet. Late checkout until 2:00 P.M. is available upon request, subject to room availability.","prompt":"What is included free of charge with the executive room booking?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Airport shuttle service and breakfast buffet"},{"id":"B","text":"Private guided city tour"},{"id":"C","text":"Spa massage package"},{"id":"D","text":"International phone calls"}],"correctOptionId":"A","explanation":"Mục Benefits ghi rõ xe đưa đón sân bay và buffet sáng miễn phí (complimentary).","source":"ChitChatGo TOEIC Reading · Set 04 · Câu 147","listening":null},{"id":"r4_148","number":148,"part":7,"passage":"EXECUTIVE ROOM BENEFITS\\nGuests booking an Executive Room directly through our website receive complimentary airport shuttle service and daily breakfast buffet. Late checkout until 2:00 P.M. is available upon request, subject to room availability.","prompt":"What condition applies to late checkout?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"It depends on room availability"},{"id":"B","text":"It requires a minimum seven-night stay"},{"id":"C","text":"It is only offered on Sundays"},{"id":"D","text":"It costs an extra fifty dollars"}],"correctOptionId":"A","explanation":"Cụm \\"subject to room availability\\" nghĩa là tùy tình trạng phòng trống.","source":"ChitChatGo TOEIC Reading · Set 04 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-04"}', '{"r4_101":"A","r4_102":"A","r4_131":"A","r4_132":"A","r4_147":"A","r4_148":"A"}', 6, 100, 6, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), INTERVAL 25 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 13 DAY)),
    (910005, 910005, @seed_u06, 'PRACTICE', 5, 'GRADED', '{"slug":"seed-toeic-practice-05","title":"TOEIC Practice Set 05 · HR & Recruitment Reading","description":"Luyện Reading Part 5–7 với từ vựng nhân sự, tin tuyển dụng và quy trình đánh giá ứng viên.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 05","lessons":[{"id":"lesson-guide-05","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 05 · HR & Recruitment Reading","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r5_101","number":101,"part":5,"passage":null,"prompt":"Applicants with relevant project management experience will be given _____.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"priority"},{"id":"B","text":"prioritize"},{"id":"C","text":"prior"},{"id":"D","text":"prioritized"}],"correctOptionId":"A","explanation":"Cụm \\"be given priority\\" nghĩa là được ưu tiên.","source":"ChitChatGo TOEIC Reading · Set 05 · Câu 101","listening":null},{"id":"r5_102","number":102,"part":5,"passage":null,"prompt":"The hiring committee interviewed six candidates _____ selecting the final two.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"before"},{"id":"B","text":"although"},{"id":"C","text":"unless"},{"id":"D","text":"whereas"}],"correctOptionId":"A","explanation":"Trước V-ing \\"selecting\\" dùng giới từ \\"before\\".","source":"ChitChatGo TOEIC Reading · Set 05 · Câu 102","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-05"}', '{"r5_101":"A","r5_102":"A"}', 2, 100, 2, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), INTERVAL 25 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 12 DAY)),
    (910006, 910006, @seed_u07, 'PRACTICE', 5, 'GRADED', '{"slug":"seed-toeic-practice-06","title":"TOEIC Practice Set 06 · Finance & Budgeting","description":"Luyện Reading Part 5–7 chủ đề kế toán, báo cáo quý, hóa đơn và phê duyệt chi phí.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 06","lessons":[{"id":"lesson-guide-06","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 06 · Finance & Budgeting","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r6_101","number":101,"part":5,"passage":null,"prompt":"Quarterly operating costs declined _____ after the company consolidated two regional offices.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"significantly"},{"id":"B","text":"significant"},{"id":"C","text":"significance"},{"id":"D","text":"signify"}],"correctOptionId":"A","explanation":"Cần trạng từ \\"significantly\\" bổ nghĩa cho động từ \\"declined\\".","source":"ChitChatGo TOEIC Reading · Set 06 · Câu 101","listening":null},{"id":"r6_102","number":102,"part":5,"passage":null,"prompt":"Neither the finance director _____ the lead auditor found any discrepancies in the ledger.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"nor"},{"id":"B","text":"or"},{"id":"C","text":"and"},{"id":"D","text":"but"}],"correctOptionId":"A","explanation":"Cặp liên từ tương quan chuẩn: Neither ... nor ...","source":"ChitChatGo TOEIC Reading · Set 06 · Câu 102","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-06"}', '{"r6_101":"A","r6_102":"A"}', 2, 100, 2, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), INTERVAL 25 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 11 DAY)),
    (910007, 910007, @seed_u08, 'EXAM', NULL, 'GRADED', '{"slug":"seed-toeic-practice-07","title":"TOEIC Practice Set 07 · Marketing & Product Launch","description":"Luyện Reading Part 5–7 về chiến dịch ra mắt sản phẩm, khảo sát khách hàng và báo chí.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 07","lessons":[{"id":"lesson-guide-07","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 07 · Marketing & Product Launch","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r7_101","number":101,"part":5,"passage":null,"prompt":"_____ the heavy rain, the outdoor product launch proceeded smoothly.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Despite"},{"id":"B","text":"Although"},{"id":"C","text":"Even though"},{"id":"D","text":"Because"}],"correctOptionId":"A","explanation":"Theo sau là cụm danh từ \\"the heavy rain\\" nên dùng giới từ \\"Despite\\".","source":"ChitChatGo TOEIC Reading · Set 07 · Câu 101","listening":null},{"id":"r7_102","number":102,"part":5,"passage":null,"prompt":"The new ergonomic keyboard was designed specifically to _____ wrist strain.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"minimize"},{"id":"B","text":"minimum"},{"id":"C","text":"minimal"},{"id":"D","text":"minimally"}],"correctOptionId":"A","explanation":"Sau \\"to\\" chỉ mục đích cần động từ nguyên mẫu (minimize).","source":"ChitChatGo TOEIC Reading · Set 07 · Câu 102","listening":null},{"id":"r7_131","number":131,"part":6,"passage":"Press Release: AeroNote Tablet\\nToday Lumina Tech unveiled the AeroNote 11, a lightweight tablet built for note-taking. Weighing just 410 grams, the device offers up to 14 hours of battery life (131) _____ a single charge. (132) _____","prompt":"Choose the best preposition for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"on"},{"id":"B","text":"into"},{"id":"C","text":"among"},{"id":"D","text":"beside"}],"correctOptionId":"A","explanation":"Cụm chuẩn công nghệ: \\"on a single charge\\" (trên một lần sạc).","source":"ChitChatGo TOEIC Reading · Set 07 · Câu 131","listening":null},{"id":"r7_132","number":132,"part":6,"passage":"Press Release: AeroNote Tablet\\nToday Lumina Tech unveiled the AeroNote 11, a lightweight tablet built for note-taking. Weighing just 410 grams, the device offers up to 14 hours of battery life (131) _____ a single charge. (132) _____","prompt":"Choose the best sentence for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Pre-orders open online this Friday at participating retailers."},{"id":"B","text":"The highway tunnel will close for repainting tonight."},{"id":"C","text":"Fresh pastries are baked every hour at the bakery."},{"id":"D","text":"Our gardening club meets on the first Sunday of each month."}],"correctOptionId":"A","explanation":"Câu (A) thông báo thời điểm mở đặt trước phù hợp thông cáo báo chí sản phẩm.","source":"ChitChatGo TOEIC Reading · Set 07 · Câu 132","listening":null},{"id":"r7_147","number":147,"part":7,"passage":"CUSTOMER FEEDBACK SUMMARY\\nIn our September survey of 450 subscribers, 88% rated lesson audio clarity as \\"excellent,\\" while 34% requested an offline download option for commuting. Our mobile team plans to release offline caching in Q1.","prompt":"What feature did one-third of respondents request?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Offline download capability for commuting"},{"id":"B","text":"Larger textbook print fonts"},{"id":"C","text":"More weekend customer phone hours"},{"id":"D","text":"Lower annual membership pricing"}],"correctOptionId":"A","explanation":"34% người tham gia khảo sát đề xuất tính năng tải ngoại tuyến khi di chuyển.","source":"ChitChatGo TOEIC Reading · Set 07 · Câu 147","listening":null},{"id":"r7_148","number":148,"part":7,"passage":"CUSTOMER FEEDBACK SUMMARY\\nIn our September survey of 450 subscribers, 88% rated lesson audio clarity as \\"excellent,\\" while 34% requested an offline download option for commuting. Our mobile team plans to release offline caching in Q1.","prompt":"When does the mobile team plan to ship offline caching?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"In the first quarter (Q1)"},{"id":"B","text":"Immediately this week"},{"id":"C","text":"Next September"},{"id":"D","text":"Only for desktop browsers"}],"correctOptionId":"A","explanation":"Câu cuối ghi rõ kế hoạch phát hành vào Q1.","source":"ChitChatGo TOEIC Reading · Set 07 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-07"}', '{"r7_101":"A","r7_102":"A","r7_131":"A","r7_132":"A","r7_147":"A","r7_148":"A"}', 6, 100, 6, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), INTERVAL 25 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 10 DAY)),
    (910008, 910008, @seed_u09, 'PRACTICE', 5, 'GRADED', '{"slug":"seed-toeic-practice-08","title":"TOEIC Practice Set 08 · Contracts & Agreements","description":"Luyện Reading Part 5–7 về hợp đồng dịch vụ, điều khoản gia hạn và thông báo pháp lý.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 08","lessons":[{"id":"lesson-guide-08","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 08 · Contracts & Agreements","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r8_101","number":101,"part":5,"passage":null,"prompt":"Please find the updated service agreement _____ to this email.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"attached"},{"id":"B","text":"attaching"},{"id":"C","text":"attachment"},{"id":"D","text":"attach"}],"correctOptionId":"A","explanation":"Cấu trúc \\"find + O + V3/ed (attached)\\" rất quen thuộc trong email TOEIC.","source":"ChitChatGo TOEIC Reading · Set 08 · Câu 101","listening":null},{"id":"r8_102","number":102,"part":5,"passage":null,"prompt":"Either party may terminate the contract by providing thirty days written _____.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"notice"},{"id":"B","text":"notify"},{"id":"C","text":"notified"},{"id":"D","text":"notifying"}],"correctOptionId":"A","explanation":"Sau tính từ \\"written\\" cần danh từ \\"notice\\" (thông báo bằng văn bản).","source":"ChitChatGo TOEIC Reading · Set 08 · Câu 102","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-08"}', '{"r8_101":"A","r8_102":"A"}', 2, 100, 2, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), INTERVAL 25 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 9 DAY)),
    (910009, 910009, @seed_u10, 'PRACTICE', 5, 'GRADED', '{"slug":"seed-toeic-practice-09","title":"TOEIC Practice Set 09 · Corporate Training & Events","description":"Luyện Reading Part 5–7 chủ đề đào tạo nhân sự, hội thảo và quản lý dự án.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 09","lessons":[{"id":"lesson-guide-09","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 09 · Corporate Training & Events","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r9_101","number":101,"part":5,"passage":null,"prompt":"The regional director requested that every manager _____ the leadership workshop.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"attend"},{"id":"B","text":"attended"},{"id":"C","text":"attending"},{"id":"D","text":"to attend"}],"correctOptionId":"A","explanation":"Cấu trúc giả định: request + that + S + V nguyên mẫu (attend).","source":"ChitChatGo TOEIC Reading · Set 09 · Câu 101","listening":null},{"id":"r9_102","number":102,"part":5,"passage":null,"prompt":"Participants will receive a digital certificate upon successful _____ of all modules.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"completion"},{"id":"B","text":"complete"},{"id":"C","text":"completed"},{"id":"D","text":"completely"}],"correctOptionId":"A","explanation":"Sau tính từ \\"successful\\" và trước \\"of\\" cần danh từ \\"completion\\".","source":"ChitChatGo TOEIC Reading · Set 09 · Câu 102","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-09"}', '{"r9_101":"A","r9_102":"A"}', 2, 100, 2, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), INTERVAL 25 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 8 DAY)),
    (910010, 910010, @seed_u11, 'EXAM', NULL, 'GRADED', '{"slug":"seed-toeic-practice-10","title":"TOEIC Practice Set 10 · Retail & Customer Support","description":"Luyện Reading Part 5–7 chủ đề bán lẻ, bảo hành sản phẩm và chính sách đổi trả.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 10","lessons":[{"id":"lesson-guide-10","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 10 · Retail & Customer Support","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r10_101","number":101,"part":5,"passage":null,"prompt":"All warranty claims must be accompanied by the _____ sales receipt.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"original"},{"id":"B","text":"originally"},{"id":"C","text":"originate"},{"id":"D","text":"originality"}],"correctOptionId":"A","explanation":"Trước cụm danh từ \\"sales receipt\\" cần tính từ \\"original\\".","source":"ChitChatGo TOEIC Reading · Set 10 · Câu 101","listening":null},{"id":"r10_102","number":102,"part":5,"passage":null,"prompt":"Our support center operates seven days a week to assist customers _____.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"promptly"},{"id":"B","text":"prompt"},{"id":"C","text":"promptness"},{"id":"D","text":"prompted"}],"correctOptionId":"A","explanation":"Cần trạng từ \\"promptly\\" bổ nghĩa cho động từ \\"assist\\".","source":"ChitChatGo TOEIC Reading · Set 10 · Câu 102","listening":null},{"id":"r10_131","number":131,"part":6,"passage":"Store Policy Update — Meadow Home Goods\\nEffective November 1, unopened items may be returned for a full refund within 30 days of purchase. Items returned (131) _____ a receipt qualify for store credit at the current selling price. (132) _____","prompt":"Choose the best preposition for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"without"},{"id":"B","text":"among"},{"id":"C","text":"across"},{"id":"D","text":"toward"}],"correctOptionId":"A","explanation":"Hàng trả lại \\"without a receipt\\" (không có hóa đơn) sẽ nhận store credit.","source":"ChitChatGo TOEIC Reading · Set 10 · Câu 131","listening":null},{"id":"r10_132","number":132,"part":6,"passage":"Store Policy Update — Meadow Home Goods\\nEffective November 1, unopened items may be returned for a full refund within 30 days of purchase. Items returned (131) _____ a receipt qualify for store credit at the current selling price. (132) _____","prompt":"Choose the best sentence for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Clearance merchandise marked final sale is not eligible for return."},{"id":"B","text":"The annual marathon route passes through City Park."},{"id":"C","text":"Passengers should check gate monitors for boarding updates."},{"id":"D","text":"Our accounting software backs up files every midnight."}],"correctOptionId":"A","explanation":"Câu (A) bổ sung ngoại lệ cho hàng thanh lý trong chính sách đổi trả.","source":"ChitChatGo TOEIC Reading · Set 10 · Câu 132","listening":null},{"id":"r10_147","number":147,"part":7,"passage":"EXTENDED WARRANTY NOTICE\\nEvery BrewMaster espresso machine comes with a standard one-year manufacturer warranty covering parts and labor. Register your serial number online within 30 days of purchase to receive an additional six months of coverage at no extra cost.","prompt":"How can customers extend their warranty by six months for free?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"By registering the serial number online within 30 days"},{"id":"B","text":"By purchasing an annual coffee bean subscription"},{"id":"C","text":"By mailing the original box back to the factory"},{"id":"D","text":"By visiting a service center every quarter"}],"correctOptionId":"A","explanation":"Đăng ký số serial trực tuyến trong 30 ngày sẽ được tặng thêm 6 tháng bảo hành.","source":"ChitChatGo TOEIC Reading · Set 10 · Câu 147","listening":null},{"id":"r10_148","number":148,"part":7,"passage":"EXTENDED WARRANTY NOTICE\\nEvery BrewMaster espresso machine comes with a standard one-year manufacturer warranty covering parts and labor. Register your serial number online within 30 days of purchase to receive an additional six months of coverage at no extra cost.","prompt":"What does the standard warranty cover?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Both replacement parts and repair labor"},{"id":"B","text":"Accidental drops and cosmetic scratches only"},{"id":"C","text":"Shipping costs for international moves"},{"id":"D","text":"Free monthly descaling powder"}],"correctOptionId":"A","explanation":"Đoạn văn nêu rõ \\"covering parts and labor\\".","source":"ChitChatGo TOEIC Reading · Set 10 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-10"}', '{"r10_101":"A","r10_102":"A","r10_131":"A","r10_132":"A","r10_147":"A","r10_148":"A"}', 6, 100, 6, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), INTERVAL 25 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 7 DAY)),
    (910011, 910011, @seed_u12, 'PRACTICE', 1, 'GRADED', '{"slug":"seed-toeic-practice-11","title":"TOEIC Listening Practice 01 · Office & Daily Routines","description":"Bộ đề luyện nghe đầy đủ Part 1–4 với hình ảnh minh họa, câu hỏi phản hồi, hội thoại và thông báo.","durationMinutes":20,"sourceLabel":"ChitChatGo TOEIC Listening · Set 01","lessons":[{"id":"lesson-guide-11","title":"Chiến thuật Listening Part 1–4 · TOEIC Listening Practice 01 · Office & Daily Routines","content":"MỤC TIÊU\\nLuyện đủ 4 phần TOEIC Listening (Part 1, Part 2, Part 3, Part 4) kèm transcript và đáp án chi tiết."}],"questions":[{"id":"l11_01","number":1,"part":1,"passage":null,"prompt":"","imageUrl":"/toeic-assets/ets2024-listening/test01/question-001.webp","passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""},{"id":"D","text":""}],"correctOptionId":"A","explanation":"Nghe mô tả đúng hành động/khung cảnh trong hình.","source":"ChitChatGo TOEIC Listening · Set 01 · Câu 1","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-001.mp3","transcript":"Number 1. Look at the picture.\\n(A) She is reviewing documents outdoors.\\n(B) She is waiting in line at a food truck.\\n(C) She is wiping off a bench.\\n(D) She is throwing away a plate."}}],"published":true,"version":1,"seedKey":"seed-toeic-practice-11"}', '{"l11_01":"A"}', 1, 100, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), INTERVAL 20 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 6 DAY)),
    (910012, 910012, @seed_u13, 'PRACTICE', 1, 'GRADED', '{"slug":"seed-toeic-practice-12","title":"TOEIC Listening Practice 02 · Meetings & Schedules","description":"Luyện nghe đủ 4 phần Part 1–4 chủ đề lịch họp, thiết bị phòng họp và thông báo nội bộ.","durationMinutes":20,"sourceLabel":"ChitChatGo TOEIC Listening · Set 02","lessons":[{"id":"lesson-guide-12","title":"Chiến thuật Listening Part 1–4 · TOEIC Listening Practice 02 · Meetings & Schedules","content":"MỤC TIÊU\\nLuyện đủ 4 phần TOEIC Listening (Part 1, Part 2, Part 3, Part 4) kèm transcript và đáp án chi tiết."}],"questions":[{"id":"l12_01","number":1,"part":1,"passage":null,"prompt":"","imageUrl":"/toeic-assets/ets2024-listening/test01/question-002.webp","passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""},{"id":"D","text":""}],"correctOptionId":"A","explanation":"Nghe mô tả đúng hành động/khung cảnh trong hình.","source":"ChitChatGo TOEIC Listening · Set 02 · Câu 1","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-002.mp3","transcript":"Number 2. Look at the picture.\\n(A) Two colleagues are collaborating at a table.\\n(B) A technician is replacing a ceiling bulb.\\n(C) Chairs are stacked near the window.\\n(D) A delivery driver is unloading boxes."}}],"published":true,"version":1,"seedKey":"seed-toeic-practice-12"}', '{"l12_01":"A"}', 1, 100, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), INTERVAL 20 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 5 DAY)),
    (910013, 910013, @seed_u14, 'EXAM', NULL, 'GRADED', '{"slug":"seed-toeic-practice-13","title":"TOEIC Listening Practice 03 · Client Services & Travel","description":"Luyện nghe đủ 4 phần Part 1–4 về tư vấn khách hàng, đặt lịch và hướng dẫn tham quan.","durationMinutes":20,"sourceLabel":"ChitChatGo TOEIC Listening · Set 03","lessons":[{"id":"lesson-guide-13","title":"Chiến thuật Listening Part 1–4 · TOEIC Listening Practice 03 · Client Services & Travel","content":"MỤC TIÊU\\nLuyện đủ 4 phần TOEIC Listening (Part 1, Part 2, Part 3, Part 4) kèm transcript và đáp án chi tiết."}],"questions":[{"id":"l13_01","number":1,"part":1,"passage":null,"prompt":"","imageUrl":"/toeic-assets/ets2024-listening/test01/question-003.webp","passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""},{"id":"D","text":""}],"correctOptionId":"A","explanation":"Nghe mô tả đúng hành động/khung cảnh trong hình.","source":"ChitChatGo TOEIC Listening · Set 03 · Câu 1","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-003.mp3","transcript":"Number 3. Look at the picture.\\n(A) A display shelf is neatly organized.\\n(B) Customers are exiting a bookstore.\\n(C) A clerk is sweeping the sidewalk.\\n(D) Bicycles are lined up beside a fence."}},{"id":"l13_07","number":7,"part":2,"passage":null,"prompt":"","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""}],"correctOptionId":"A","explanation":"Chọn câu phản hồi trực tiếp đúng từ để hỏi.","source":"ChitChatGo TOEIC Listening · Set 03 · Câu 7","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-009.mp3","transcript":"Number 9. When will the revised design proposal be sent to the client?\\n(A) By Thursday afternoon at the latest.\\n(B) To the marketing department.\\n(C) Yes, the colors look much brighter."}},{"id":"l13_32","number":32,"part":3,"passage":null,"prompt":"Where is the conversation taking place?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"At a hotel front desk"},{"id":"B","text":"At a car rental counter"},{"id":"C","text":"Inside a travel agency"},{"id":"D","text":"At a conference registration booth"}],"correctOptionId":"A","explanation":"Đối chiếu câu mở đầu trong đoạn hội thoại Part 3.","source":"ChitChatGo TOEIC Listening · Set 03 · Câu 32","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-038-040.mp3","transcript":"Man: Welcome to Riverside Hotel. Your executive room on the eighth floor is ready.\\nWoman: Thank you! Could you tell me when the breakfast buffet opens tomorrow and whether shuttle vouchers are available here?"}},{"id":"l13_33","number":33,"part":3,"passage":null,"prompt":"What does the woman inquire about?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Breakfast hours and shuttle vouchers"},{"id":"B","text":"Gym membership discounts"},{"id":"C","text":"Conference hall audio equipment"},{"id":"D","text":"Nearby dry-cleaning shops"}],"correctOptionId":"A","explanation":"Đối chiếu hành động tiếp theo trong đoạn hội thoại Part 3.","source":"ChitChatGo TOEIC Listening · Set 03 · Câu 33","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-038-040.mp3","transcript":"Man: Welcome to Riverside Hotel. Your executive room on the eighth floor is ready.\\nWoman: Thank you! Could you tell me when the breakfast buffet opens tomorrow and whether shuttle vouchers are available here?"}},{"id":"l13_71","number":71,"part":4,"passage":null,"prompt":"Who is most likely speaking?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"A museum tour guide"},{"id":"B","text":"An airline flight attendant"},{"id":"C","text":"A university librarian"},{"id":"D","text":"A theater ticket manager"}],"correctOptionId":"A","explanation":"Xác định bối cảnh/mục đích của bài nói ngắn Part 4.","source":"ChitChatGo TOEIC Listening · Set 03 · Câu 71","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-077-079.mp3","transcript":"Welcome to the Harbor Design Museum. Before we begin our guided tour of the Modern Architecture wing, please silence mobile phones and note that flash photography is not permitted inside the galleries."}},{"id":"l13_72","number":72,"part":4,"passage":null,"prompt":"What restriction does the speaker mention?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Flash photography is prohibited in the galleries"},{"id":"B","text":"Water bottles cannot be brought into the lobby"},{"id":"C","text":"The tour group cannot exceed five visitors"},{"id":"D","text":"The gift shop closes before noon"}],"correctOptionId":"A","explanation":"Bắt thông tin chi tiết được nhấn mạnh trong bài nói Part 4.","source":"ChitChatGo TOEIC Listening · Set 03 · Câu 72","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-077-079.mp3","transcript":"Welcome to the Harbor Design Museum. Before we begin our guided tour of the Modern Architecture wing, please silence mobile phones and note that flash photography is not permitted inside the galleries."}}],"published":true,"version":1,"seedKey":"seed-toeic-practice-13"}', '{"l13_01":"A","l13_07":"A","l13_32":"A","l13_33":"A","l13_71":"A","l13_72":"A"}', 6, 100, 6, DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), INTERVAL 20 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 4 DAY)),
    (910014, 910014, @seed_u15, 'PRACTICE', 1, 'GRADED', '{"slug":"seed-toeic-practice-14","title":"TOEIC Listening Practice 04 · Retail & Logistics","description":"Luyện nghe đủ 4 phần Part 1–4 chủ đề đặt hàng, kho vận và bản tin doanh nghiệp.","durationMinutes":20,"sourceLabel":"ChitChatGo TOEIC Listening · Set 04","lessons":[{"id":"lesson-guide-14","title":"Chiến thuật Listening Part 1–4 · TOEIC Listening Practice 04 · Retail & Logistics","content":"MỤC TIÊU\\nLuyện đủ 4 phần TOEIC Listening (Part 1, Part 2, Part 3, Part 4) kèm transcript và đáp án chi tiết."}],"questions":[{"id":"l14_01","number":1,"part":1,"passage":null,"prompt":"","imageUrl":"/toeic-assets/ets2024-listening/test01/question-004.webp","passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""},{"id":"D","text":""}],"correctOptionId":"A","explanation":"Nghe mô tả đúng hành động/khung cảnh trong hình.","source":"ChitChatGo TOEIC Listening · Set 04 · Câu 1","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-004.mp3","transcript":"Number 4. Look at the picture.\\n(A) Workers are inspecting items in a workspace.\\n(B) A chef is slicing vegetables.\\n(C) Shoppers are carrying grocery bags.\\n(D) A painter is climbing a ladder."}}],"published":true,"version":1,"seedKey":"seed-toeic-practice-14"}', '{"l14_01":"A"}', 1, 100, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY), INTERVAL 20 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 3 DAY)),
    (910015, 910015, @seed_u16, 'PRACTICE', 1, 'GRADED', '{"slug":"seed-toeic-practice-15","title":"TOEIC Listening Practice 05 · Tech & Corporate Events","description":"Luyện nghe đủ 4 phần Part 1–4 chủ đề hội thảo công nghệ, văn phòng và đào tạo.","durationMinutes":20,"sourceLabel":"ChitChatGo TOEIC Listening · Set 05","lessons":[{"id":"lesson-guide-15","title":"Chiến thuật Listening Part 1–4 · TOEIC Listening Practice 05 · Tech & Corporate Events","content":"MỤC TIÊU\\nLuyện đủ 4 phần TOEIC Listening (Part 1, Part 2, Part 3, Part 4) kèm transcript và đáp án chi tiết."}],"questions":[{"id":"l15_01","number":1,"part":1,"passage":null,"prompt":"","imageUrl":"/toeic-assets/ets2024-listening/test01/question-005.webp","passageImageUrls":null,"options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""},{"id":"D","text":""}],"correctOptionId":"A","explanation":"Nghe mô tả đúng hành động/khung cảnh trong hình.","source":"ChitChatGo TOEIC Listening · Set 05 · Câu 1","listening":{"audioUrl":"/toeic-assets/ets2024-listening/test01/audio-005.mp3","transcript":"Number 5. Look at the picture.\\n(A) People are gathered in a bright indoor space.\\n(B) Boats are docked along a pier.\\n(C) A bus is parked outside a stadium.\\n(D) Trees are being trimmed along a pathway."}}],"published":true,"version":1,"seedKey":"seed-toeic-practice-15"}', '{"l15_01":"A"}', 1, 100, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY), INTERVAL 20 MINUTE), DATE_SUB('2026-10-20 08:25:00', INTERVAL 2 DAY)),
    (910016, 910001, @seed_u17, 'EXAM', NULL, 'IN_PROGRESS', '{"slug":"seed-toeic-practice-01","title":"TOEIC Practice Set 01 · Word Forms & Office Notices","description":"Bộ đề luyện Reading đầy đủ Part 5–7 tập trung phân tích từ loại, email văn phòng và thông báo sự kiện.","durationMinutes":25,"sourceLabel":"ChitChatGo TOEIC Reading · Set 01","lessons":[{"id":"lesson-guide-01","title":"Chiến thuật Reading Part 5–7 · TOEIC Practice Set 01 · Word Forms & Office Notices","content":"MỤC TIÊU\\nLuyện đầy đủ 3 phần TOEIC Reading (Part 5, Part 6, Part 7) với chiến lược phân tích câu nhanh và tìm bằng chứng trực tiếp trong đoạn đọc."}],"questions":[{"id":"r1_101","number":101,"part":5,"passage":null,"prompt":"The marketing team will _____ the new campaign brochure before Monday.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"finalize"},{"id":"B","text":"final"},{"id":"C","text":"finally"},{"id":"D","text":"finality"}],"correctOptionId":"A","explanation":"Sau trợ động từ \\"will\\" cần động từ nguyên mẫu (finalize).","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 101","listening":null},{"id":"r1_102","number":102,"part":5,"passage":null,"prompt":"Customers who register early receive a _____ twenty-percent discount.","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"substantial"},{"id":"B","text":"substance"},{"id":"C","text":"substantially"},{"id":"D","text":"substantiate"}],"correctOptionId":"A","explanation":"Trước cụm danh từ \\"twenty-percent discount\\" cần tính từ (substantial).","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 102","listening":null},{"id":"r1_131","number":131,"part":6,"passage":"Memo: Onboarding Schedule Update\\nWelcome to Northstar Solutions! All new hires should arrive at Lobby B by 8:45 A.M. on Monday. (131) _____ Light refreshments will be served before the orientation begins at 9:15 A.M. Please contact HR (132) _____ you need parking validation.","prompt":"Choose the best sentence for blank (131).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Please bring a photo ID to receive your access badge."},{"id":"B","text":"The cafeteria closes early every Friday."},{"id":"C","text":"Parking permits expired last autumn."},{"id":"D","text":"Several flights were delayed due to fog."}],"correctOptionId":"A","explanation":"Câu (A) nối tiếp hợp lý quy trình nhận thẻ nhân viên mới trong buổi onboarding.","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 131","listening":null},{"id":"r1_132","number":132,"part":6,"passage":"Memo: Onboarding Schedule Update\\nWelcome to Northstar Solutions! All new hires should arrive at Lobby B by 8:45 A.M. on Monday. (131) _____ Light refreshments will be served before the orientation begins at 9:15 A.M. Please contact HR (132) _____ you need parking validation.","prompt":"Choose the best word for blank (132).","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"if"},{"id":"B","text":"despite"},{"id":"C","text":"during"},{"id":"D","text":"unless of"}],"correctOptionId":"A","explanation":"Cần liên từ điều kiện \\"if\\" trước mệnh đề \\"you need parking validation\\".","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 132","listening":null},{"id":"r1_147","number":147,"part":7,"passage":"NOTICE: Central Library Community Workshop\\nLearn practical digital productivity tools this Saturday from 10:00 A.M. to 12:30 P.M. in Room 204. Admission is free for all library cardholders. To reserve a seat, complete the registration form on the library web portal before Thursday at 5:00 P.M.","prompt":"How can residents register for the community workshop?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"By completing the online form on the library portal"},{"id":"B","text":"By mailing a printed postcard"},{"id":"C","text":"By visiting city hall on Sunday"},{"id":"D","text":"By calling the local radio station"}],"correctOptionId":"A","explanation":"Thông báo ghi rõ đăng ký qua biểu mẫu trực tuyến trên cổng thông tin thư viện.","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 147","listening":null},{"id":"r1_148","number":148,"part":7,"passage":"NOTICE: Central Library Community Workshop\\nLearn practical digital productivity tools this Saturday from 10:00 A.M. to 12:30 P.M. in Room 204. Admission is free for all library cardholders. To reserve a seat, complete the registration form on the library web portal before Thursday at 5:00 P.M.","prompt":"What is required for free admission?","imageUrl":null,"passageImageUrls":null,"options":[{"id":"A","text":"Holding a valid library card"},{"id":"B","text":"Bringing a personal projector"},{"id":"C","text":"Paying a materials deposit"},{"id":"D","text":"Attending an orientation on Friday"}],"correctOptionId":"A","explanation":"Câu \\"Admission is free for all library cardholders\\" khẳng định đáp án (A).","source":"ChitChatGo TOEIC Reading · Set 01 · Câu 148","listening":null}],"published":true,"version":1,"seedKey":"seed-toeic-practice-01"}', '{"r1_101":"","r1_102":"","r1_131":"","r1_132":"","r1_147":"","r1_148":""}', 6, NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_ADD(DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY), INTERVAL 25 MINUTE), NULL)
    ON DUPLICATE KEY UPDATE status = VALUES(status), snapshot_json = VALUES(snapshot_json), answers_json = VALUES(answers_json), total_questions = VALUES(total_questions), score = VALUES(score), correct_count = VALUES(correct_count);

    INSERT INTO learning_db.toeic_lesson_progress (id, user_id, exam_id, lesson_id, exam_version, completed_at) VALUES
    (910001, @seed_u02, 910001, 'lesson-guide-01', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (910002, @seed_u03, 910002, 'lesson-guide-02', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (910003, @seed_u04, 910003, 'lesson-guide-03', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (910004, @seed_u05, 910004, 'lesson-guide-04', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (910005, @seed_u06, 910005, 'lesson-guide-05', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (910006, @seed_u07, 910006, 'lesson-guide-06', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (910007, @seed_u08, 910007, 'lesson-guide-07', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (910008, @seed_u09, 910008, 'lesson-guide-08', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (910009, @seed_u10, 910009, 'lesson-guide-09', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (910010, @seed_u11, 910010, 'lesson-guide-10', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (910011, @seed_u12, 910011, 'lesson-guide-11', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (910012, @seed_u13, 910012, 'lesson-guide-12', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (910013, @seed_u14, 910013, 'lesson-guide-13', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    (910014, @seed_u15, 910014, 'lesson-guide-14', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (910015, @seed_u16, 910015, 'lesson-guide-15', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY)),
    (910016, @seed_u17, 910001, 'lesson-guide-01', 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE completed_at = VALUES(completed_at);

    INSERT INTO learning_db.toeic_notes (id, user_id, exam_id, attempt_id, question_number, part, exam_title, selected_text, note_content, color, created_at, updated_at) VALUES
    (910001, @seed_u02, 910001, 910001, 101, 5, 'TOEIC Practice Set 01 · Word Forms & Office Notices', 'finalize the brochure', 'finalize (v): hoàn thiện bản cuối; thường đi với proposal, contract, brochure.', 'yellow', DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY)),
    (910002, @seed_u03, 910002, 910002, 101, 5, 'TOEIC Practice Set 02 · Conjunctions & Logistics', 'Once the revised budget was approved', 'Once + S + V: ngay khi... (liên từ nối mệnh đề thời gian).', 'blue', DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY)),
    (910003, @seed_u04, 910003, 910003, 101, 5, 'TOEIC Practice Set 03 · Verb Tenses & IT Policies', 'must be submitted within ten business days', 'business days: ngày làm việc (không tính thứ 7, Chủ nhật).', 'green', DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (910004, @seed_u05, 910004, 910004, 101, 5, 'TOEIC Practice Set 04 · Business Emails & Hospitality', 'onboarding memo', 'onboarding (n): quy trình hội nhập dành cho nhân viên mới.', 'pink', DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (910005, @seed_u06, 910005, 910005, 101, 5, 'TOEIC Practice Set 05 · HR & Recruitment Reading', 'undergo maintenance', 'undergo + N: trải qua quá trình (maintenance, renovation, training).', 'yellow', DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (910006, @seed_u07, 910006, 910006, 101, 5, 'TOEIC Practice Set 06 · Finance & Budgeting', 'community workshop', 'workshop (n): buổi hội thảo thực hành tương tác.', 'blue', DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (910007, @seed_u08, 910007, 910007, 101, 5, 'TOEIC Practice Set 07 · Marketing & Product Launch', 'delayed equipment shipment', 'equipment là danh từ không đếm được, không thêm -s.', 'green', DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (910008, @seed_u09, 910008, 910008, 101, 5, 'TOEIC Practice Set 08 · Contracts & Agreements', 'Data Privacy Compliance', 'compliance (n): sự tuân thủ quy định; cụm in compliance with.', 'pink', DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (910009, @seed_u10, 910009, 910009, 101, 5, 'TOEIC Practice Set 09 · Corporate Training & Events', 'software update released yesterday', 'Rút gọn mệnh đề quan hệ bị động bằng V3/ed (released).', 'yellow', DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (910010, @seed_u11, 910010, 910010, 101, 5, 'TOEIC Practice Set 10 · Retail & Customer Support', 'Airport shuttle service', 'shuttle (n): xe trung chuyển đưa đón theo tuyến cố định.', 'blue', DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (910011, @seed_u12, 910011, 910011, 1, 1, 'TOEIC Listening Practice 01 · Office & Daily Routines', 'reviewing documents beside a laptop', 'Part 1 chú ý giới từ vị trí: beside, next to, across from.', 'green', DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (910012, @seed_u13, 910012, 910012, 1, 1, 'TOEIC Listening Practice 02 · Meetings & Schedules', 'Conference Room 4B', 'Câu hỏi Where ưu tiên bắt tên phòng, tầng hoặc khu vực cụ thể.', 'pink', DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (910013, @seed_u14, 910013, 910013, 1, 1, 'TOEIC Listening Practice 03 · Client Services & Travel', 'HDMI cable is missing', 'missing (adj): bị thiếu, thất lạc; phân biệt với broken (hỏng).', 'yellow', DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (910014, @seed_u15, 910014, 910014, 1, 1, 'TOEIC Listening Practice 04 · Retail & Logistics', 'boarding pass and ID ready', 'have + O + ready: chuẩn bị sẵn sàng thứ gì đó.', 'blue', DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (910015, @seed_u16, 910015, 910015, 1, 1, 'TOEIC Listening Practice 05 · Tech & Corporate Events', 'revised design proposal', 'revised (adj): đã được chỉnh sửa, cập nhật lại.', 'green', DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    (910016, @seed_u17, 910001, 910001, 101, 5, 'TOEIC Practice Set 01 · Word Forms & Office Notices', 'quarterly sales review', 'quarterly (adj/adv): hàng quý (3 tháng một lần).', 'pink', DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (910017, @seed_u02, 910002, 910002, 101, 5, 'TOEIC Practice Set 02 · Conjunctions & Logistics', 'free of charge', 'free of charge = complimentary = miễn phí (rất hay gặp ở Part 7).', 'yellow', DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY)),
    (910018, @seed_u03, 910003, 910003, 101, 5, 'TOEIC Practice Set 03 · Verb Tenses & IT Policies', 'proceeded on schedule', 'on schedule: đúng tiến độ; ahead of schedule: vượt tiến độ.', 'blue', DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE note_content = VALUES(note_content);

    INSERT INTO learning_db.toeic_media (id, object_key, original_name, media_kind, content_type, size_bytes, cloud_copy, version, created_at) VALUES
    ('seed-toeic-media-01', 'seed-audio-01.mp3', 'toeic-listening-track-01.mp3', 'AUDIO', 'audio/mpeg', 425000, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    ('seed-toeic-media-02', 'seed-audio-02.mp3', 'toeic-listening-track-02.mp3', 'AUDIO', 'audio/mpeg', 443500, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    ('seed-toeic-media-03', 'seed-audio-03.mp3', 'toeic-listening-track-03.mp3', 'AUDIO', 'audio/mpeg', 462000, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    ('seed-toeic-media-04', 'seed-audio-04.mp3', 'toeic-listening-track-04.mp3', 'AUDIO', 'audio/mpeg', 480500, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    ('seed-toeic-media-05', 'seed-audio-05.mp3', 'toeic-listening-track-05.mp3', 'AUDIO', 'audio/mpeg', 499000, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    ('seed-toeic-media-06', 'seed-audio-06.mp3', 'toeic-listening-track-06.mp3', 'AUDIO', 'audio/mpeg', 517500, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    ('seed-toeic-media-07', 'seed-audio-07.mp3', 'toeic-listening-track-07.mp3', 'AUDIO', 'audio/mpeg', 536000, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    ('seed-toeic-media-08', 'seed-audio-08.mp3', 'toeic-listening-track-08.mp3', 'AUDIO', 'audio/mpeg', 554500, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    ('seed-toeic-media-09', 'seed-audio-09.mp3', 'toeic-listening-track-09.mp3', 'AUDIO', 'audio/mpeg', 573000, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    ('seed-toeic-media-10', 'seed-audio-10.mp3', 'toeic-listening-track-10.mp3', 'AUDIO', 'audio/mpeg', 591500, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    ('seed-toeic-media-11', 'seed-image-11.webp', 'toeic-part1-photo-11.webp', 'IMAGE', 'image/webp', 130000, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    ('seed-toeic-media-12', 'seed-image-12.webp', 'toeic-part1-photo-12.webp', 'IMAGE', 'image/webp', 134200, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    ('seed-toeic-media-13', 'seed-image-13.webp', 'toeic-part1-photo-13.webp', 'IMAGE', 'image/webp', 138400, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    ('seed-toeic-media-14', 'seed-image-14.webp', 'toeic-part1-photo-14.webp', 'IMAGE', 'image/webp', 142600, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY)),
    ('seed-toeic-media-15', 'seed-image-15.webp', 'toeic-part1-photo-15.webp', 'IMAGE', 'image/webp', 146800, FALSE, 1, DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE original_name = VALUES(original_name);

    INSERT INTO learning_db.dictation_audio (audio_key, original_name, duration_seconds) VALUES
    ('seed-dict-audio-01', 'dictation-track-01.mp3', 18.5),
    ('seed-dict-audio-02', 'dictation-track-02.mp3', 19.9),
    ('seed-dict-audio-03', 'dictation-track-03.mp3', 21.3),
    ('seed-dict-audio-04', 'dictation-track-04.mp3', 22.7),
    ('seed-dict-audio-05', 'dictation-track-05.mp3', 24.1),
    ('seed-dict-audio-06', 'dictation-track-06.mp3', 25.5),
    ('seed-dict-audio-07', 'dictation-track-07.mp3', 26.9),
    ('seed-dict-audio-08', 'dictation-track-08.mp3', 28.3),
    ('seed-dict-audio-09', 'dictation-track-09.mp3', 29.7),
    ('seed-dict-audio-10', 'dictation-track-10.mp3', 31.1),
    ('seed-dict-audio-11', 'dictation-track-11.mp3', 32.5),
    ('seed-dict-audio-12', 'dictation-track-12.mp3', 33.9),
    ('seed-dict-audio-13', 'dictation-track-13.mp3', 35.3),
    ('seed-dict-audio-14', 'dictation-track-14.mp3', 36.7),
    ('seed-dict-audio-15', 'dictation-track-15.mp3', 38.1)
    ON DUPLICATE KEY UPDATE original_name = VALUES(original_name);

    INSERT INTO learning_db.dictation_exercises (id, current_version, published_version, archived, updated_at) VALUES
    ('seed-dict-ex-01', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    ('seed-dict-ex-02', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    ('seed-dict-ex-03', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    ('seed-dict-ex-04', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    ('seed-dict-ex-05', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    ('seed-dict-ex-06', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    ('seed-dict-ex-07', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    ('seed-dict-ex-08', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    ('seed-dict-ex-09', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    ('seed-dict-ex-10', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    ('seed-dict-ex-11', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    ('seed-dict-ex-12', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    ('seed-dict-ex-13', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    ('seed-dict-ex-14', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY)),
    ('seed-dict-ex-15', 1, 1, FALSE, DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE published_version = VALUES(published_version), archived = VALUES(archived);

    INSERT INTO learning_db.dictation_revisions (exercise_id, version, title, topic, level, duration_seconds, toeic_test, definition) VALUES
    ('seed-dict-ex-01', 1, 'Morning Stand-up Check-in', 'Workplace', 'B1', 18.5, NULL, '{"title":"Morning Stand-up Check-in","description":"Bài luyện nghe chép chính tả chủ đề Workplace (B1) trên ChitChatGo.","topic":"Workplace","level":"B1","audioKey":"seed-dict-audio-01","sentences":[{"text":"Good morning everyone, let us start our daily stand-up meeting.","start":0,"end":9.3},{"text":"Yesterday I finished testing the login workflow and fixed two minor bugs.","start":9.5,"end":18.5}]}'),
    ('seed-dict-ex-02', 1, 'Rescheduling a Client Call', 'Workplace', 'B1', 19.9, NULL, '{"title":"Rescheduling a Client Call","description":"Bài luyện nghe chép chính tả chủ đề Workplace (B1) trên ChitChatGo.","topic":"Workplace","level":"B1","audioKey":"seed-dict-audio-02","sentences":[{"text":"Thanks for reaching out about Thursday afternoon.","start":0,"end":9.9},{"text":"Would it be possible to move our call to Friday at ten?","start":10.1,"end":19.9}]}'),
    ('seed-dict-ex-03', 1, 'Ordering Coffee Before Work', 'Daily Life', 'A2', 21.3, NULL, '{"title":"Ordering Coffee Before Work","description":"Bài luyện nghe chép chính tả chủ đề Daily Life (A2) trên ChitChatGo.","topic":"Daily Life","level":"A2","audioKey":"seed-dict-audio-03","sentences":[{"text":"Could I have a medium iced latte with oat milk, please?","start":0,"end":10.7},{"text":"Sure, would you like to add a warm croissant with that?","start":10.9,"end":21.3}]}'),
    ('seed-dict-ex-04', 1, 'Checking In at the Airport', 'Travel', 'A2', 22.7, NULL, '{"title":"Checking In at the Airport","description":"Bài luyện nghe chép chính tả chủ đề Travel (A2) trên ChitChatGo.","topic":"Travel","level":"A2","audioKey":"seed-dict-audio-04","sentences":[{"text":"May I see your passport and booking confirmation, please?","start":0,"end":11.3},{"text":"Here you go, and I only have one carry-on bag today.","start":11.5,"end":22.7}]}'),
    ('seed-dict-ex-05', 1, 'Hotel Front Desk Request', 'Travel', 'B1', 24.1, NULL, '{"title":"Hotel Front Desk Request","description":"Bài luyện nghe chép chính tả chủ đề Travel (B1) trên ChitChatGo.","topic":"Travel","level":"B1","audioKey":"seed-dict-audio-05","sentences":[{"text":"Welcome to Riverside Hotel, your room on the eighth floor is ready.","start":0,"end":12.1},{"text":"Could you also let me know what time breakfast starts tomorrow?","start":12.3,"end":24.1}]}'),
    ('seed-dict-ex-06', 1, 'Discussing Sprint Priorities', 'Technology', 'B2', 25.5, NULL, '{"title":"Discussing Sprint Priorities","description":"Bài luyện nghe chép chính tả chủ đề Technology (B2) trên ChitChatGo.","topic":"Technology","level":"B2","audioKey":"seed-dict-audio-06","sentences":[{"text":"Before we freeze the release branch, we need to verify database latency.","start":0,"end":12.8},{"text":"Agreed, let us run one more load test on staging this afternoon.","start":13,"end":25.5}]}'),
    ('seed-dict-ex-07', 1, 'Handling a Shipping Delay', 'Customer Service', 'B1', 26.9, NULL, '{"title":"Handling a Shipping Delay","description":"Bài luyện nghe chép chính tả chủ đề Customer Service (B1) trên ChitChatGo.","topic":"Customer Service","level":"B1","audioKey":"seed-dict-audio-07","sentences":[{"text":"I apologize for the unexpected delay with your recent order.","start":0,"end":13.4},{"text":"We have upgraded your parcel to express delivery at no extra cost.","start":13.6,"end":26.9}]}'),
    ('seed-dict-ex-08', 1, 'Preparing for a Job Interview', 'Career', 'B2', 28.3, NULL, '{"title":"Preparing for a Job Interview","description":"Bài luyện nghe chép chính tả chủ đề Career (B2) trên ChitChatGo.","topic":"Career","level":"B2","audioKey":"seed-dict-audio-08","sentences":[{"text":"Could you share a challenging project where you led a cross-functional team?","start":0,"end":14.2},{"text":"Certainly, last quarter I coordinated engineers and designers to launch our mobile app.","start":14.4,"end":28.3}]}'),
    ('seed-dict-ex-09', 1, 'Library Study Room Booking', 'Academic', 'A2', 29.7, NULL, '{"title":"Library Study Room Booking","description":"Bài luyện nghe chép chính tả chủ đề Academic (A2) trên ChitChatGo.","topic":"Academic","level":"A2","audioKey":"seed-dict-audio-09","sentences":[{"text":"Hi, I would like to reserve a quiet study room for two hours.","start":0,"end":14.8},{"text":"Room three is available right now until five o clock.","start":15,"end":29.7}]}'),
    ('seed-dict-ex-10', 1, 'Weekly Marketing Sync', 'Workplace', 'B2', 31.1, NULL, '{"title":"Weekly Marketing Sync","description":"Bài luyện nghe chép chính tả chủ đề Workplace (B2) trên ChitChatGo.","topic":"Workplace","level":"B2","audioKey":"seed-dict-audio-10","sentences":[{"text":"Our organic search traffic grew by eighteen percent over the past month.","start":0,"end":15.6},{"text":"That is encouraging news, let us double down on video tutorials next quarter.","start":15.8,"end":31.1}]}'),
    ('seed-dict-ex-11', 1, 'TOEIC Test 1 · Office Relocation', 'Test 1', 'B1', 32.5, 1, '{"title":"TOEIC Test 1 · Office Relocation","description":"Bài luyện nghe chép chính tả chủ đề Test 1 (B1) trên ChitChatGo.","topic":"Test 1","level":"B1","audioKey":"seed-dict-audio-11","sentences":[{"text":"Please pack your desk items in the labeled boxes before Friday evening.","start":0,"end":16.3},{"text":"The moving crew will transfer all equipment to the new building over the weekend.","start":16.5,"end":32.5}]}'),
    ('seed-dict-ex-12', 1, 'TOEIC Test 2 · Conference Registration', 'Test 2', 'B1', 33.9, 2, '{"title":"TOEIC Test 2 · Conference Registration","description":"Bài luyện nghe chép chính tả chủ đề Test 2 (B1) trên ChitChatGo.","topic":"Test 2","level":"B1","audioKey":"seed-dict-audio-12","sentences":[{"text":"Early bird registration for the annual design summit closes tonight.","start":0,"end":16.9},{"text":"Attendees who register online will receive digital access to all keynote slides.","start":17.1,"end":33.9}]}'),
    ('seed-dict-ex-13', 1, 'TOEIC Test 3 · Factory Tour Guidelines', 'Test 3', 'B2', 35.3, 3, '{"title":"TOEIC Test 3 · Factory Tour Guidelines","description":"Bài luyện nghe chép chính tả chủ đề Test 3 (B2) trên ChitChatGo.","topic":"Test 3","level":"B2","audioKey":"seed-dict-audio-13","sentences":[{"text":"For your safety, please wear protective eyewear inside the assembly area.","start":0,"end":17.6},{"text":"Photography is permitted only in the main lobby and exhibition hall.","start":17.8,"end":35.3}]}'),
    ('seed-dict-ex-14', 1, 'TOEIC Test 4 · Restaurant Reservation', 'Test 4', 'A2', 36.7, 4, '{"title":"TOEIC Test 4 · Restaurant Reservation","description":"Bài luyện nghe chép chính tả chủ đề Test 4 (A2) trên ChitChatGo.","topic":"Test 4","level":"A2","audioKey":"seed-dict-audio-14","sentences":[{"text":"We have reserved a quiet corner table for six guests at seven thirty.","start":0,"end":18.4},{"text":"Please let our server know if anyone in your group has food allergies.","start":18.6,"end":36.7}]}'),
    ('seed-dict-ex-15', 1, 'TOEIC Test 5 · Budget Review Feedback', 'Test 5', 'B2', 38.1, 5, '{"title":"TOEIC Test 5 · Budget Review Feedback","description":"Bài luyện nghe chép chính tả chủ đề Test 5 (B2) trên ChitChatGo.","topic":"Test 5","level":"B2","audioKey":"seed-dict-audio-15","sentences":[{"text":"The finance committee requested updated figures for the third quarter forecast.","start":0,"end":19.1},{"text":"I will revise the spreadsheet and circulate the final draft before noon.","start":19.3,"end":38.1}]}')
    ON DUPLICATE KEY UPDATE title = VALUES(title), definition = VALUES(definition);

    INSERT INTO learning_db.dictation_attempts (id, user_id, exercise_id, version, current_index, scoring_mode, request_id, started_at, completed_at) VALUES
    ('seed-dict-att-01', @seed_u02, 'seed-dict-ex-01', 1, 1, 'LIVE', 'seed-dict-req-01', DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 16 DAY)),
    ('seed-dict-att-02', @seed_u03, 'seed-dict-ex-02', 1, 1, 'LIVE', 'seed-dict-req-02', DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 15 DAY)),
    ('seed-dict-att-03', @seed_u04, 'seed-dict-ex-03', 1, 1, 'LIVE', 'seed-dict-req-03', DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 14 DAY)),
    ('seed-dict-att-04', @seed_u05, 'seed-dict-ex-04', 1, 1, 'LIVE', 'seed-dict-req-04', DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 13 DAY)),
    ('seed-dict-att-05', @seed_u06, 'seed-dict-ex-05', 1, 1, 'LIVE', 'seed-dict-req-05', DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 12 DAY)),
    ('seed-dict-att-06', @seed_u07, 'seed-dict-ex-06', 1, 1, 'LIVE', 'seed-dict-req-06', DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 11 DAY)),
    ('seed-dict-att-07', @seed_u08, 'seed-dict-ex-07', 1, 1, 'LIVE', 'seed-dict-req-07', DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 10 DAY)),
    ('seed-dict-att-08', @seed_u09, 'seed-dict-ex-08', 1, 1, 'LIVE', 'seed-dict-req-08', DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 9 DAY)),
    ('seed-dict-att-09', @seed_u10, 'seed-dict-ex-09', 1, 1, 'LIVE', 'seed-dict-req-09', DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 8 DAY)),
    ('seed-dict-att-10', @seed_u11, 'seed-dict-ex-10', 1, 1, 'LIVE', 'seed-dict-req-10', DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 7 DAY)),
    ('seed-dict-att-11', @seed_u12, 'seed-dict-ex-11', 1, 1, 'LIVE', 'seed-dict-req-11', DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 6 DAY)),
    ('seed-dict-att-12', @seed_u13, 'seed-dict-ex-12', 1, 1, 'LIVE', 'seed-dict-req-12', DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 5 DAY)),
    ('seed-dict-att-13', @seed_u14, 'seed-dict-ex-13', 1, 1, 'LIVE', 'seed-dict-req-13', DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 4 DAY)),
    ('seed-dict-att-14', @seed_u15, 'seed-dict-ex-14', 1, 1, 'LIVE', 'seed-dict-req-14', DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 3 DAY)),
    ('seed-dict-att-15', @seed_u16, 'seed-dict-ex-15', 1, 0, 'LIVE', 'seed-dict-req-15', DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY), NULL),
    ('seed-dict-att-16', @seed_u17, 'seed-dict-ex-01', 1, 1, 'LEGACY', 'seed-dict-req-16', DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:15:00', INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE current_index = VALUES(current_index), completed_at = VALUES(completed_at);

    INSERT INTO learning_db.dictation_responses (attempt_id, sentence_index, answer_text, revealed, skipped, first_grade, latest_grade, hint_indices, earned_indices) VALUES
    ('seed-dict-att-01', 0, 'Good morning everyone, let us start our daily stand-up meeting.', FALSE, FALSE, '{"correct":11,"total":11,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"good","actual":"good"},{"type":"correct","expected":"morning","actual":"morning"},{"type":"correct","expected":"everyone","actual":"everyone"},{"type":"correct","expected":"let","actual":"let"},{"type":"correct","expected":"us","actual":"us"},{"type":"correct","expected":"start","actual":"start"},{"type":"correct","expected":"our","actual":"our"},{"type":"correct","expected":"daily","actual":"daily"},{"type":"correct","expected":"stand","actual":"stand"},{"type":"correct","expected":"up","actual":"up"},{"type":"correct","expected":"meeting","actual":"meeting"}]}', '{"correct":11,"total":11,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"good","actual":"good"},{"type":"correct","expected":"morning","actual":"morning"},{"type":"correct","expected":"everyone","actual":"everyone"},{"type":"correct","expected":"let","actual":"let"},{"type":"correct","expected":"us","actual":"us"},{"type":"correct","expected":"start","actual":"start"},{"type":"correct","expected":"our","actual":"our"},{"type":"correct","expected":"daily","actual":"daily"},{"type":"correct","expected":"stand","actual":"stand"},{"type":"correct","expected":"up","actual":"up"},{"type":"correct","expected":"meeting","actual":"meeting"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10]'),
    ('seed-dict-att-01', 1, 'Yesterday I finished testing the login workflow and fixed two minor bugs.', FALSE, FALSE, '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"yesterday","actual":"yesterday"},{"type":"correct","expected":"i","actual":"i"},{"type":"correct","expected":"finished","actual":"finished"},{"type":"correct","expected":"testing","actual":"testing"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"login","actual":"login"},{"type":"correct","expected":"workflow","actual":"workflow"},{"type":"correct","expected":"and","actual":"and"},{"type":"correct","expected":"fixed","actual":"fixed"},{"type":"correct","expected":"two","actual":"two"},{"type":"correct","expected":"minor","actual":"minor"},{"type":"correct","expected":"bugs","actual":"bugs"}]}', '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"yesterday","actual":"yesterday"},{"type":"correct","expected":"i","actual":"i"},{"type":"correct","expected":"finished","actual":"finished"},{"type":"correct","expected":"testing","actual":"testing"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"login","actual":"login"},{"type":"correct","expected":"workflow","actual":"workflow"},{"type":"correct","expected":"and","actual":"and"},{"type":"correct","expected":"fixed","actual":"fixed"},{"type":"correct","expected":"two","actual":"two"},{"type":"correct","expected":"minor","actual":"minor"},{"type":"correct","expected":"bugs","actual":"bugs"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10,11]'),
    ('seed-dict-att-02', 0, 'Thanks for reaching out about Thursday afternoon.', FALSE, FALSE, '{"correct":7,"total":7,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"thanks","actual":"thanks"},{"type":"correct","expected":"for","actual":"for"},{"type":"correct","expected":"reaching","actual":"reaching"},{"type":"correct","expected":"out","actual":"out"},{"type":"correct","expected":"about","actual":"about"},{"type":"correct","expected":"thursday","actual":"thursday"},{"type":"correct","expected":"afternoon","actual":"afternoon"}]}', '{"correct":7,"total":7,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"thanks","actual":"thanks"},{"type":"correct","expected":"for","actual":"for"},{"type":"correct","expected":"reaching","actual":"reaching"},{"type":"correct","expected":"out","actual":"out"},{"type":"correct","expected":"about","actual":"about"},{"type":"correct","expected":"thursday","actual":"thursday"},{"type":"correct","expected":"afternoon","actual":"afternoon"}]}', '[]', '[0,1,2,3,4,5,6]'),
    ('seed-dict-att-02', 1, 'Would it be possible to move our call to Friday at ten?', FALSE, FALSE, '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"would","actual":"would"},{"type":"correct","expected":"it","actual":"it"},{"type":"correct","expected":"be","actual":"be"},{"type":"correct","expected":"possible","actual":"possible"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"move","actual":"move"},{"type":"correct","expected":"our","actual":"our"},{"type":"correct","expected":"call","actual":"call"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"friday","actual":"friday"},{"type":"correct","expected":"at","actual":"at"},{"type":"correct","expected":"ten","actual":"ten"}]}', '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"would","actual":"would"},{"type":"correct","expected":"it","actual":"it"},{"type":"correct","expected":"be","actual":"be"},{"type":"correct","expected":"possible","actual":"possible"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"move","actual":"move"},{"type":"correct","expected":"our","actual":"our"},{"type":"correct","expected":"call","actual":"call"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"friday","actual":"friday"},{"type":"correct","expected":"at","actual":"at"},{"type":"correct","expected":"ten","actual":"ten"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10,11]'),
    ('seed-dict-att-03', 0, 'Could I have a medium iced latte with oat milk, please?', FALSE, FALSE, '{"correct":11,"total":11,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"could","actual":"could"},{"type":"correct","expected":"i","actual":"i"},{"type":"correct","expected":"have","actual":"have"},{"type":"correct","expected":"a","actual":"a"},{"type":"correct","expected":"medium","actual":"medium"},{"type":"correct","expected":"iced","actual":"iced"},{"type":"correct","expected":"latte","actual":"latte"},{"type":"correct","expected":"with","actual":"with"},{"type":"correct","expected":"oat","actual":"oat"},{"type":"correct","expected":"milk","actual":"milk"},{"type":"correct","expected":"please","actual":"please"}]}', '{"correct":11,"total":11,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"could","actual":"could"},{"type":"correct","expected":"i","actual":"i"},{"type":"correct","expected":"have","actual":"have"},{"type":"correct","expected":"a","actual":"a"},{"type":"correct","expected":"medium","actual":"medium"},{"type":"correct","expected":"iced","actual":"iced"},{"type":"correct","expected":"latte","actual":"latte"},{"type":"correct","expected":"with","actual":"with"},{"type":"correct","expected":"oat","actual":"oat"},{"type":"correct","expected":"milk","actual":"milk"},{"type":"correct","expected":"please","actual":"please"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10]'),
    ('seed-dict-att-03', 1, 'Sure, would you like to add a warm croissant with that?', FALSE, FALSE, '{"correct":11,"total":11,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"sure","actual":"sure"},{"type":"correct","expected":"would","actual":"would"},{"type":"correct","expected":"you","actual":"you"},{"type":"correct","expected":"like","actual":"like"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"add","actual":"add"},{"type":"correct","expected":"a","actual":"a"},{"type":"correct","expected":"warm","actual":"warm"},{"type":"correct","expected":"croissant","actual":"croissant"},{"type":"correct","expected":"with","actual":"with"},{"type":"correct","expected":"that","actual":"that"}]}', '{"correct":11,"total":11,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"sure","actual":"sure"},{"type":"correct","expected":"would","actual":"would"},{"type":"correct","expected":"you","actual":"you"},{"type":"correct","expected":"like","actual":"like"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"add","actual":"add"},{"type":"correct","expected":"a","actual":"a"},{"type":"correct","expected":"warm","actual":"warm"},{"type":"correct","expected":"croissant","actual":"croissant"},{"type":"correct","expected":"with","actual":"with"},{"type":"correct","expected":"that","actual":"that"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10]'),
    ('seed-dict-att-04', 0, 'May I see your passport and booking confirmation, please?', FALSE, FALSE, '{"correct":9,"total":9,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"may","actual":"may"},{"type":"correct","expected":"i","actual":"i"},{"type":"correct","expected":"see","actual":"see"},{"type":"correct","expected":"your","actual":"your"},{"type":"correct","expected":"passport","actual":"passport"},{"type":"correct","expected":"and","actual":"and"},{"type":"correct","expected":"booking","actual":"booking"},{"type":"correct","expected":"confirmation","actual":"confirmation"},{"type":"correct","expected":"please","actual":"please"}]}', '{"correct":9,"total":9,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"may","actual":"may"},{"type":"correct","expected":"i","actual":"i"},{"type":"correct","expected":"see","actual":"see"},{"type":"correct","expected":"your","actual":"your"},{"type":"correct","expected":"passport","actual":"passport"},{"type":"correct","expected":"and","actual":"and"},{"type":"correct","expected":"booking","actual":"booking"},{"type":"correct","expected":"confirmation","actual":"confirmation"},{"type":"correct","expected":"please","actual":"please"}]}', '[]', '[0,1,2,3,4,5,6,7,8]'),
    ('seed-dict-att-04', 1, 'Here you go, and I only have one carry-on bag today.', FALSE, FALSE, '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"here","actual":"here"},{"type":"correct","expected":"you","actual":"you"},{"type":"correct","expected":"go","actual":"go"},{"type":"correct","expected":"and","actual":"and"},{"type":"correct","expected":"i","actual":"i"},{"type":"correct","expected":"only","actual":"only"},{"type":"correct","expected":"have","actual":"have"},{"type":"correct","expected":"one","actual":"one"},{"type":"correct","expected":"carry","actual":"carry"},{"type":"correct","expected":"on","actual":"on"},{"type":"correct","expected":"bag","actual":"bag"},{"type":"correct","expected":"today","actual":"today"}]}', '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"here","actual":"here"},{"type":"correct","expected":"you","actual":"you"},{"type":"correct","expected":"go","actual":"go"},{"type":"correct","expected":"and","actual":"and"},{"type":"correct","expected":"i","actual":"i"},{"type":"correct","expected":"only","actual":"only"},{"type":"correct","expected":"have","actual":"have"},{"type":"correct","expected":"one","actual":"one"},{"type":"correct","expected":"carry","actual":"carry"},{"type":"correct","expected":"on","actual":"on"},{"type":"correct","expected":"bag","actual":"bag"},{"type":"correct","expected":"today","actual":"today"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10,11]'),
    ('seed-dict-att-05', 0, 'Welcome to Riverside Hotel, your room on the eighth floor is ready.', FALSE, FALSE, '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"welcome","actual":"welcome"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"riverside","actual":"riverside"},{"type":"correct","expected":"hotel","actual":"hotel"},{"type":"correct","expected":"your","actual":"your"},{"type":"correct","expected":"room","actual":"room"},{"type":"correct","expected":"on","actual":"on"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"eighth","actual":"eighth"},{"type":"correct","expected":"floor","actual":"floor"},{"type":"correct","expected":"is","actual":"is"},{"type":"correct","expected":"ready","actual":"ready"}]}', '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"welcome","actual":"welcome"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"riverside","actual":"riverside"},{"type":"correct","expected":"hotel","actual":"hotel"},{"type":"correct","expected":"your","actual":"your"},{"type":"correct","expected":"room","actual":"room"},{"type":"correct","expected":"on","actual":"on"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"eighth","actual":"eighth"},{"type":"correct","expected":"floor","actual":"floor"},{"type":"correct","expected":"is","actual":"is"},{"type":"correct","expected":"ready","actual":"ready"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10,11]'),
    ('seed-dict-att-05', 1, 'Could you also let me know what time breakfast starts tomorrow?', FALSE, FALSE, '{"correct":11,"total":11,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"could","actual":"could"},{"type":"correct","expected":"you","actual":"you"},{"type":"correct","expected":"also","actual":"also"},{"type":"correct","expected":"let","actual":"let"},{"type":"correct","expected":"me","actual":"me"},{"type":"correct","expected":"know","actual":"know"},{"type":"correct","expected":"what","actual":"what"},{"type":"correct","expected":"time","actual":"time"},{"type":"correct","expected":"breakfast","actual":"breakfast"},{"type":"correct","expected":"starts","actual":"starts"},{"type":"correct","expected":"tomorrow","actual":"tomorrow"}]}', '{"correct":11,"total":11,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"could","actual":"could"},{"type":"correct","expected":"you","actual":"you"},{"type":"correct","expected":"also","actual":"also"},{"type":"correct","expected":"let","actual":"let"},{"type":"correct","expected":"me","actual":"me"},{"type":"correct","expected":"know","actual":"know"},{"type":"correct","expected":"what","actual":"what"},{"type":"correct","expected":"time","actual":"time"},{"type":"correct","expected":"breakfast","actual":"breakfast"},{"type":"correct","expected":"starts","actual":"starts"},{"type":"correct","expected":"tomorrow","actual":"tomorrow"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10]'),
    ('seed-dict-att-06', 0, 'Before we freeze the release branch, we need to verify database latency.', FALSE, FALSE, '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"before","actual":"before"},{"type":"correct","expected":"we","actual":"we"},{"type":"correct","expected":"freeze","actual":"freeze"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"release","actual":"release"},{"type":"correct","expected":"branch","actual":"branch"},{"type":"correct","expected":"we","actual":"we"},{"type":"correct","expected":"need","actual":"need"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"verify","actual":"verify"},{"type":"correct","expected":"database","actual":"database"},{"type":"correct","expected":"latency","actual":"latency"}]}', '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"before","actual":"before"},{"type":"correct","expected":"we","actual":"we"},{"type":"correct","expected":"freeze","actual":"freeze"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"release","actual":"release"},{"type":"correct","expected":"branch","actual":"branch"},{"type":"correct","expected":"we","actual":"we"},{"type":"correct","expected":"need","actual":"need"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"verify","actual":"verify"},{"type":"correct","expected":"database","actual":"database"},{"type":"correct","expected":"latency","actual":"latency"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10,11]'),
    ('seed-dict-att-06', 1, 'Agreed, let us run one more load test on staging this afternoon.', FALSE, FALSE, '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"agreed","actual":"agreed"},{"type":"correct","expected":"let","actual":"let"},{"type":"correct","expected":"us","actual":"us"},{"type":"correct","expected":"run","actual":"run"},{"type":"correct","expected":"one","actual":"one"},{"type":"correct","expected":"more","actual":"more"},{"type":"correct","expected":"load","actual":"load"},{"type":"correct","expected":"test","actual":"test"},{"type":"correct","expected":"on","actual":"on"},{"type":"correct","expected":"staging","actual":"staging"},{"type":"correct","expected":"this","actual":"this"},{"type":"correct","expected":"afternoon","actual":"afternoon"}]}', '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"agreed","actual":"agreed"},{"type":"correct","expected":"let","actual":"let"},{"type":"correct","expected":"us","actual":"us"},{"type":"correct","expected":"run","actual":"run"},{"type":"correct","expected":"one","actual":"one"},{"type":"correct","expected":"more","actual":"more"},{"type":"correct","expected":"load","actual":"load"},{"type":"correct","expected":"test","actual":"test"},{"type":"correct","expected":"on","actual":"on"},{"type":"correct","expected":"staging","actual":"staging"},{"type":"correct","expected":"this","actual":"this"},{"type":"correct","expected":"afternoon","actual":"afternoon"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10,11]'),
    ('seed-dict-att-07', 0, 'I apologize for the unexpected delay with your recent order.', FALSE, FALSE, '{"correct":10,"total":10,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"i","actual":"i"},{"type":"correct","expected":"apologize","actual":"apologize"},{"type":"correct","expected":"for","actual":"for"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"unexpected","actual":"unexpected"},{"type":"correct","expected":"delay","actual":"delay"},{"type":"correct","expected":"with","actual":"with"},{"type":"correct","expected":"your","actual":"your"},{"type":"correct","expected":"recent","actual":"recent"},{"type":"correct","expected":"order","actual":"order"}]}', '{"correct":10,"total":10,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"i","actual":"i"},{"type":"correct","expected":"apologize","actual":"apologize"},{"type":"correct","expected":"for","actual":"for"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"unexpected","actual":"unexpected"},{"type":"correct","expected":"delay","actual":"delay"},{"type":"correct","expected":"with","actual":"with"},{"type":"correct","expected":"your","actual":"your"},{"type":"correct","expected":"recent","actual":"recent"},{"type":"correct","expected":"order","actual":"order"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9]'),
    ('seed-dict-att-07', 1, 'We have upgraded your parcel to express delivery at no extra cost.', FALSE, FALSE, '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"we","actual":"we"},{"type":"correct","expected":"have","actual":"have"},{"type":"correct","expected":"upgraded","actual":"upgraded"},{"type":"correct","expected":"your","actual":"your"},{"type":"correct","expected":"parcel","actual":"parcel"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"express","actual":"express"},{"type":"correct","expected":"delivery","actual":"delivery"},{"type":"correct","expected":"at","actual":"at"},{"type":"correct","expected":"no","actual":"no"},{"type":"correct","expected":"extra","actual":"extra"},{"type":"correct","expected":"cost","actual":"cost"}]}', '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"we","actual":"we"},{"type":"correct","expected":"have","actual":"have"},{"type":"correct","expected":"upgraded","actual":"upgraded"},{"type":"correct","expected":"your","actual":"your"},{"type":"correct","expected":"parcel","actual":"parcel"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"express","actual":"express"},{"type":"correct","expected":"delivery","actual":"delivery"},{"type":"correct","expected":"at","actual":"at"},{"type":"correct","expected":"no","actual":"no"},{"type":"correct","expected":"extra","actual":"extra"},{"type":"correct","expected":"cost","actual":"cost"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10,11]'),
    ('seed-dict-att-08', 0, 'Could you share a challenging project where you led a cross-functional team?', FALSE, FALSE, '{"correct":13,"total":13,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"could","actual":"could"},{"type":"correct","expected":"you","actual":"you"},{"type":"correct","expected":"share","actual":"share"},{"type":"correct","expected":"a","actual":"a"},{"type":"correct","expected":"challenging","actual":"challenging"},{"type":"correct","expected":"project","actual":"project"},{"type":"correct","expected":"where","actual":"where"},{"type":"correct","expected":"you","actual":"you"},{"type":"correct","expected":"led","actual":"led"},{"type":"correct","expected":"a","actual":"a"},{"type":"correct","expected":"cross","actual":"cross"},{"type":"correct","expected":"functional","actual":"functional"},{"type":"correct","expected":"team","actual":"team"}]}', '{"correct":13,"total":13,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"could","actual":"could"},{"type":"correct","expected":"you","actual":"you"},{"type":"correct","expected":"share","actual":"share"},{"type":"correct","expected":"a","actual":"a"},{"type":"correct","expected":"challenging","actual":"challenging"},{"type":"correct","expected":"project","actual":"project"},{"type":"correct","expected":"where","actual":"where"},{"type":"correct","expected":"you","actual":"you"},{"type":"correct","expected":"led","actual":"led"},{"type":"correct","expected":"a","actual":"a"},{"type":"correct","expected":"cross","actual":"cross"},{"type":"correct","expected":"functional","actual":"functional"},{"type":"correct","expected":"team","actual":"team"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10,11,12]'),
    ('seed-dict-att-08', 1, 'Certainly, last quarter I coordinated engineers and designers to launch our mobile app.', FALSE, FALSE, '{"correct":13,"total":13,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"certainly","actual":"certainly"},{"type":"correct","expected":"last","actual":"last"},{"type":"correct","expected":"quarter","actual":"quarter"},{"type":"correct","expected":"i","actual":"i"},{"type":"correct","expected":"coordinated","actual":"coordinated"},{"type":"correct","expected":"engineers","actual":"engineers"},{"type":"correct","expected":"and","actual":"and"},{"type":"correct","expected":"designers","actual":"designers"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"launch","actual":"launch"},{"type":"correct","expected":"our","actual":"our"},{"type":"correct","expected":"mobile","actual":"mobile"},{"type":"correct","expected":"app","actual":"app"}]}', '{"correct":13,"total":13,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"certainly","actual":"certainly"},{"type":"correct","expected":"last","actual":"last"},{"type":"correct","expected":"quarter","actual":"quarter"},{"type":"correct","expected":"i","actual":"i"},{"type":"correct","expected":"coordinated","actual":"coordinated"},{"type":"correct","expected":"engineers","actual":"engineers"},{"type":"correct","expected":"and","actual":"and"},{"type":"correct","expected":"designers","actual":"designers"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"launch","actual":"launch"},{"type":"correct","expected":"our","actual":"our"},{"type":"correct","expected":"mobile","actual":"mobile"},{"type":"correct","expected":"app","actual":"app"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10,11,12]'),
    ('seed-dict-att-09', 0, 'Hi, I would like to reserve a quiet study room for two hours.', FALSE, FALSE, '{"correct":13,"total":13,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"hi","actual":"hi"},{"type":"correct","expected":"i","actual":"i"},{"type":"correct","expected":"would","actual":"would"},{"type":"correct","expected":"like","actual":"like"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"reserve","actual":"reserve"},{"type":"correct","expected":"a","actual":"a"},{"type":"correct","expected":"quiet","actual":"quiet"},{"type":"correct","expected":"study","actual":"study"},{"type":"correct","expected":"room","actual":"room"},{"type":"correct","expected":"for","actual":"for"},{"type":"correct","expected":"two","actual":"two"},{"type":"correct","expected":"hours","actual":"hours"}]}', '{"correct":13,"total":13,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"hi","actual":"hi"},{"type":"correct","expected":"i","actual":"i"},{"type":"correct","expected":"would","actual":"would"},{"type":"correct","expected":"like","actual":"like"},{"type":"correct","expected":"to","actual":"to"},{"type":"correct","expected":"reserve","actual":"reserve"},{"type":"correct","expected":"a","actual":"a"},{"type":"correct","expected":"quiet","actual":"quiet"},{"type":"correct","expected":"study","actual":"study"},{"type":"correct","expected":"room","actual":"room"},{"type":"correct","expected":"for","actual":"for"},{"type":"correct","expected":"two","actual":"two"},{"type":"correct","expected":"hours","actual":"hours"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10,11,12]'),
    ('seed-dict-att-10', 0, 'Our organic search traffic grew by eighteen percent over the past month.', FALSE, FALSE, '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"our","actual":"our"},{"type":"correct","expected":"organic","actual":"organic"},{"type":"correct","expected":"search","actual":"search"},{"type":"correct","expected":"traffic","actual":"traffic"},{"type":"correct","expected":"grew","actual":"grew"},{"type":"correct","expected":"by","actual":"by"},{"type":"correct","expected":"eighteen","actual":"eighteen"},{"type":"correct","expected":"percent","actual":"percent"},{"type":"correct","expected":"over","actual":"over"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"past","actual":"past"},{"type":"correct","expected":"month","actual":"month"}]}', '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"our","actual":"our"},{"type":"correct","expected":"organic","actual":"organic"},{"type":"correct","expected":"search","actual":"search"},{"type":"correct","expected":"traffic","actual":"traffic"},{"type":"correct","expected":"grew","actual":"grew"},{"type":"correct","expected":"by","actual":"by"},{"type":"correct","expected":"eighteen","actual":"eighteen"},{"type":"correct","expected":"percent","actual":"percent"},{"type":"correct","expected":"over","actual":"over"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"past","actual":"past"},{"type":"correct","expected":"month","actual":"month"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10,11]'),
    ('seed-dict-att-11', 0, 'Please pack your desk items in the labeled boxes before Friday evening.', FALSE, FALSE, '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"please","actual":"please"},{"type":"correct","expected":"pack","actual":"pack"},{"type":"correct","expected":"your","actual":"your"},{"type":"correct","expected":"desk","actual":"desk"},{"type":"correct","expected":"items","actual":"items"},{"type":"correct","expected":"in","actual":"in"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"labeled","actual":"labeled"},{"type":"correct","expected":"boxes","actual":"boxes"},{"type":"correct","expected":"before","actual":"before"},{"type":"correct","expected":"friday","actual":"friday"},{"type":"correct","expected":"evening","actual":"evening"}]}', '{"correct":12,"total":12,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"please","actual":"please"},{"type":"correct","expected":"pack","actual":"pack"},{"type":"correct","expected":"your","actual":"your"},{"type":"correct","expected":"desk","actual":"desk"},{"type":"correct","expected":"items","actual":"items"},{"type":"correct","expected":"in","actual":"in"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"labeled","actual":"labeled"},{"type":"correct","expected":"boxes","actual":"boxes"},{"type":"correct","expected":"before","actual":"before"},{"type":"correct","expected":"friday","actual":"friday"},{"type":"correct","expected":"evening","actual":"evening"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10,11]'),
    ('seed-dict-att-12', 0, 'Early bird registration for the annual design summit closes tonight.', FALSE, FALSE, '{"correct":10,"total":10,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"early","actual":"early"},{"type":"correct","expected":"bird","actual":"bird"},{"type":"correct","expected":"registration","actual":"registration"},{"type":"correct","expected":"for","actual":"for"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"annual","actual":"annual"},{"type":"correct","expected":"design","actual":"design"},{"type":"correct","expected":"summit","actual":"summit"},{"type":"correct","expected":"closes","actual":"closes"},{"type":"correct","expected":"tonight","actual":"tonight"}]}', '{"correct":10,"total":10,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"early","actual":"early"},{"type":"correct","expected":"bird","actual":"bird"},{"type":"correct","expected":"registration","actual":"registration"},{"type":"correct","expected":"for","actual":"for"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"annual","actual":"annual"},{"type":"correct","expected":"design","actual":"design"},{"type":"correct","expected":"summit","actual":"summit"},{"type":"correct","expected":"closes","actual":"closes"},{"type":"correct","expected":"tonight","actual":"tonight"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9]'),
    ('seed-dict-att-13', 0, 'For your safety, please wear protective eyewear inside the assembly area.', FALSE, FALSE, '{"correct":11,"total":11,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"for","actual":"for"},{"type":"correct","expected":"your","actual":"your"},{"type":"correct","expected":"safety","actual":"safety"},{"type":"correct","expected":"please","actual":"please"},{"type":"correct","expected":"wear","actual":"wear"},{"type":"correct","expected":"protective","actual":"protective"},{"type":"correct","expected":"eyewear","actual":"eyewear"},{"type":"correct","expected":"inside","actual":"inside"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"assembly","actual":"assembly"},{"type":"correct","expected":"area","actual":"area"}]}', '{"correct":11,"total":11,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"for","actual":"for"},{"type":"correct","expected":"your","actual":"your"},{"type":"correct","expected":"safety","actual":"safety"},{"type":"correct","expected":"please","actual":"please"},{"type":"correct","expected":"wear","actual":"wear"},{"type":"correct","expected":"protective","actual":"protective"},{"type":"correct","expected":"eyewear","actual":"eyewear"},{"type":"correct","expected":"inside","actual":"inside"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"assembly","actual":"assembly"},{"type":"correct","expected":"area","actual":"area"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10]'),
    ('seed-dict-att-14', 0, 'We have reserved a quiet corner table for six guests at seven thirty.', FALSE, FALSE, '{"correct":13,"total":13,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"we","actual":"we"},{"type":"correct","expected":"have","actual":"have"},{"type":"correct","expected":"reserved","actual":"reserved"},{"type":"correct","expected":"a","actual":"a"},{"type":"correct","expected":"quiet","actual":"quiet"},{"type":"correct","expected":"corner","actual":"corner"},{"type":"correct","expected":"table","actual":"table"},{"type":"correct","expected":"for","actual":"for"},{"type":"correct","expected":"six","actual":"six"},{"type":"correct","expected":"guests","actual":"guests"},{"type":"correct","expected":"at","actual":"at"},{"type":"correct","expected":"seven","actual":"seven"},{"type":"correct","expected":"thirty","actual":"thirty"}]}', '{"correct":13,"total":13,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"we","actual":"we"},{"type":"correct","expected":"have","actual":"have"},{"type":"correct","expected":"reserved","actual":"reserved"},{"type":"correct","expected":"a","actual":"a"},{"type":"correct","expected":"quiet","actual":"quiet"},{"type":"correct","expected":"corner","actual":"corner"},{"type":"correct","expected":"table","actual":"table"},{"type":"correct","expected":"for","actual":"for"},{"type":"correct","expected":"six","actual":"six"},{"type":"correct","expected":"guests","actual":"guests"},{"type":"correct","expected":"at","actual":"at"},{"type":"correct","expected":"seven","actual":"seven"},{"type":"correct","expected":"thirty","actual":"thirty"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10,11,12]'),
    ('seed-dict-att-15', 0, 'The finance committee requested updated figures for the third quarter forecast.', FALSE, FALSE, '{"correct":11,"total":11,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"finance","actual":"finance"},{"type":"correct","expected":"committee","actual":"committee"},{"type":"correct","expected":"requested","actual":"requested"},{"type":"correct","expected":"updated","actual":"updated"},{"type":"correct","expected":"figures","actual":"figures"},{"type":"correct","expected":"for","actual":"for"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"third","actual":"third"},{"type":"correct","expected":"quarter","actual":"quarter"},{"type":"correct","expected":"forecast","actual":"forecast"}]}', '{"correct":11,"total":11,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"finance","actual":"finance"},{"type":"correct","expected":"committee","actual":"committee"},{"type":"correct","expected":"requested","actual":"requested"},{"type":"correct","expected":"updated","actual":"updated"},{"type":"correct","expected":"figures","actual":"figures"},{"type":"correct","expected":"for","actual":"for"},{"type":"correct","expected":"the","actual":"the"},{"type":"correct","expected":"third","actual":"third"},{"type":"correct","expected":"quarter","actual":"quarter"},{"type":"correct","expected":"forecast","actual":"forecast"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10]'),
    ('seed-dict-att-16', 0, 'Good morning everyone, let us start our daily stand-up meeting.', FALSE, FALSE, '{"correct":11,"total":11,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"good","actual":"good"},{"type":"correct","expected":"morning","actual":"morning"},{"type":"correct","expected":"everyone","actual":"everyone"},{"type":"correct","expected":"let","actual":"let"},{"type":"correct","expected":"us","actual":"us"},{"type":"correct","expected":"start","actual":"start"},{"type":"correct","expected":"our","actual":"our"},{"type":"correct","expected":"daily","actual":"daily"},{"type":"correct","expected":"stand","actual":"stand"},{"type":"correct","expected":"up","actual":"up"},{"type":"correct","expected":"meeting","actual":"meeting"}]}', '{"correct":11,"total":11,"extra":0,"accuracy":100,"words":[{"type":"correct","expected":"good","actual":"good"},{"type":"correct","expected":"morning","actual":"morning"},{"type":"correct","expected":"everyone","actual":"everyone"},{"type":"correct","expected":"let","actual":"let"},{"type":"correct","expected":"us","actual":"us"},{"type":"correct","expected":"start","actual":"start"},{"type":"correct","expected":"our","actual":"our"},{"type":"correct","expected":"daily","actual":"daily"},{"type":"correct","expected":"stand","actual":"stand"},{"type":"correct","expected":"up","actual":"up"},{"type":"correct","expected":"meeting","actual":"meeting"}]}', '[]', '[0,1,2,3,4,5,6,7,8,9,10]')
    ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text), latest_grade = VALUES(latest_grade);

    INSERT INTO learning_db.dictation_workbook_imports (content_sha256, exercise_id) VALUES
    ('b1f10e3a1492784ae5938510c7ee695f4fcb082ac16d2e24a182e62850cb3af3', 'seed-dict-ex-01'),
    ('e2bb319840425667689459e091ee0a12f2257a191108da6cbd9c5e10b336ead6', 'seed-dict-ex-02'),
    ('5b96dd6857c0c16d27b8540120447912c6b1784d52d39a4c74cc20110b169258', 'seed-dict-ex-03'),
    ('5c584e0495156010bf02225cf8304f9ab51edc550172d1f5a199bf780fa43da2', 'seed-dict-ex-04'),
    ('39fe4f9e9e923a472a7ba9ec28b69010de72ee413700391bddec4b7b3b7a8b85', 'seed-dict-ex-05'),
    ('cfdf9ea60052b6d86b345a85d13f752f17b77758e71ece45d28aa5d921736d3d', 'seed-dict-ex-06'),
    ('b9b9c1ef0358b34d1224db6ad96aeee37b31241b62762fcf99c1855995b3e97d', 'seed-dict-ex-07'),
    ('cc2c292608c8ea7f5b67b8569385c731228c05a999a8bde47ee2ef666a07ec82', 'seed-dict-ex-08'),
    ('0b39f4986bb03354a232c4798080f68d4529c8db559d2fbdc51a9628184c5047', 'seed-dict-ex-09'),
    ('77e0279128833c765c451ecb2b98814f74a47a57827fe7859da69bf7729d7e56', 'seed-dict-ex-10'),
    ('a77d1b790ba0d35056ea87b6962864d0649109fa9058ebaac07c328086b3cdc8', 'seed-dict-ex-11'),
    ('c21eb5b29d9b6554f119950c6dd3619e17f6bdad9ff0d429b1e7fce632e69100', 'seed-dict-ex-12'),
    ('76e7d222e27396f8da9d4858cf97616b57170ba649f18820e13cf3fbd5fe48f0', 'seed-dict-ex-13'),
    ('469823e9108f51047cf3c435f8560e007193784e88b5bed5f1de41c76e7bc89e', 'seed-dict-ex-14'),
    ('7af9c396b0477e0ccc0051fdde07bc0c3fe71c899882a072e0b545babdd1dab1', 'seed-dict-ex-15')
    ON DUPLICATE KEY UPDATE exercise_id = VALUES(exercise_id);

    INSERT INTO learning_db.dictation_workbook_sync (exercise_id, version, pending) VALUES
    ('seed-dict-ex-01', 1, FALSE),
    ('seed-dict-ex-02', 1, FALSE),
    ('seed-dict-ex-03', 1, FALSE),
    ('seed-dict-ex-04', 1, FALSE),
    ('seed-dict-ex-05', 1, FALSE),
    ('seed-dict-ex-06', 1, FALSE),
    ('seed-dict-ex-07', 1, FALSE),
    ('seed-dict-ex-08', 1, FALSE),
    ('seed-dict-ex-09', 1, FALSE),
    ('seed-dict-ex-10', 1, FALSE),
    ('seed-dict-ex-11', 1, FALSE),
    ('seed-dict-ex-12', 1, FALSE),
    ('seed-dict-ex-13', 1, FALSE),
    ('seed-dict-ex-14', 1, FALSE),
    ('seed-dict-ex-15', 1, FALSE)
    ON DUPLICATE KEY UPDATE version = VALUES(version), pending = VALUES(pending);

    INSERT INTO learning_db.dictation_workbook_sources (exercise_id, storage, object_key, content_sha256) VALUES
    ('seed-dict-ex-01', 'local', 'seed-workbook-01.xlsx', 'b1f10e3a1492784ae5938510c7ee695f4fcb082ac16d2e24a182e62850cb3af3'),
    ('seed-dict-ex-02', 'local', 'seed-workbook-02.xlsx', 'e2bb319840425667689459e091ee0a12f2257a191108da6cbd9c5e10b336ead6'),
    ('seed-dict-ex-03', 'local', 'seed-workbook-03.xlsx', '5b96dd6857c0c16d27b8540120447912c6b1784d52d39a4c74cc20110b169258'),
    ('seed-dict-ex-04', 'local', 'seed-workbook-04.xlsx', '5c584e0495156010bf02225cf8304f9ab51edc550172d1f5a199bf780fa43da2'),
    ('seed-dict-ex-05', 'local', 'seed-workbook-05.xlsx', '39fe4f9e9e923a472a7ba9ec28b69010de72ee413700391bddec4b7b3b7a8b85'),
    ('seed-dict-ex-06', 'local', 'seed-workbook-06.xlsx', 'cfdf9ea60052b6d86b345a85d13f752f17b77758e71ece45d28aa5d921736d3d'),
    ('seed-dict-ex-07', 'local', 'seed-workbook-07.xlsx', 'b9b9c1ef0358b34d1224db6ad96aeee37b31241b62762fcf99c1855995b3e97d'),
    ('seed-dict-ex-08', 'local', 'seed-workbook-08.xlsx', 'cc2c292608c8ea7f5b67b8569385c731228c05a999a8bde47ee2ef666a07ec82'),
    ('seed-dict-ex-09', 'local', 'seed-workbook-09.xlsx', '0b39f4986bb03354a232c4798080f68d4529c8db559d2fbdc51a9628184c5047'),
    ('seed-dict-ex-10', 'local', 'seed-workbook-10.xlsx', '77e0279128833c765c451ecb2b98814f74a47a57827fe7859da69bf7729d7e56'),
    ('seed-dict-ex-11', 'local', 'seed-workbook-11.xlsx', 'a77d1b790ba0d35056ea87b6962864d0649109fa9058ebaac07c328086b3cdc8'),
    ('seed-dict-ex-12', 'local', 'seed-workbook-12.xlsx', 'c21eb5b29d9b6554f119950c6dd3619e17f6bdad9ff0d429b1e7fce632e69100'),
    ('seed-dict-ex-13', 'local', 'seed-workbook-13.xlsx', '76e7d222e27396f8da9d4858cf97616b57170ba649f18820e13cf3fbd5fe48f0'),
    ('seed-dict-ex-14', 'local', 'seed-workbook-14.xlsx', '469823e9108f51047cf3c435f8560e007193784e88b5bed5f1de41c76e7bc89e'),
    ('seed-dict-ex-15', 'local', 'seed-workbook-15.xlsx', '7af9c396b0477e0ccc0051fdde07bc0c3fe71c899882a072e0b545babdd1dab1')
    ON DUPLICATE KEY UPDATE object_key = VALUES(object_key), content_sha256 = VALUES(content_sha256);

    -- =========================================================================
    -- 4. PAYMENT_DB
    -- =========================================================================
    INSERT INTO payment_db.pro_plans (code, name, duration_months, price, active) VALUES
    ('PRO_STUDENT_1M', 'ChitChatGo Pro Sinh viên · 1 tháng', 1, 39000.00, FALSE),
    ('PRO_STUDENT_3M', 'ChitChatGo Pro Sinh viên · 3 tháng', 3, 99000.00, FALSE),
    ('PRO_STUDENT_12M', 'ChitChatGo Pro Sinh viên · 1 năm', 12, 399000.00, FALSE),
    ('PRO_SUMMER_3M', 'Ưu đãi Hè Bứt Phá · 3 tháng', 3, 105000.00, FALSE),
    ('PRO_BACKTOSCHOOL_12M', 'Ưu đãi Tựu Trường · 1 năm', 12, 429000.00, FALSE),
    ('PRO_IELTS_SPRINT_3M', 'Gói Tăng Tốc IELTS · 3 tháng', 3, 115000.00, FALSE),
    ('PRO_TOEIC_BOOST_1M', 'Gói Về Đích TOEIC · 1 tháng', 1, 45000.00, FALSE),
    ('PRO_TEAM_12M', 'Gói Doanh nghiệp & Nhóm · 1 năm', 12, 450000.00, FALSE),
    ('PRO_NEWYEAR_12M', 'Ưu đãi Năm Mới · 1 năm', 12, 449000.00, FALSE),
    ('PRO_TRIAL_1M', 'Gói Trải Nghiệm Đầu Tiên · 1 tháng', 1, 29000.00, FALSE),
    ('PRO_ALUMNI_3M', 'Ưu đãi Cựu Học Viên · 3 tháng', 3, 109000.00, FALSE),
    ('PRO_EARLYBIRD_12M', 'Ưu đãi Early Bird · 1 năm', 12, 419000.00, FALSE)
    ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), active = VALUES(active);

    IF EXISTS (SELECT 1 FROM payment_db.orders
        WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36)
            AND NOT ((id <=> 1 AND order_code <=> 'ORD-2026-0001' AND user_id <=> @seed_u02)
                OR (id <=> 2 AND order_code <=> 'ORD-2026-0002' AND user_id <=> @seed_u03)
                OR (id <=> 3 AND order_code <=> 'ORD-2026-0003' AND user_id <=> @seed_u04)
                OR (id <=> 4 AND order_code <=> 'ORD-2026-0004' AND user_id <=> @seed_u06)
                OR (id <=> 5 AND order_code <=> 'ORD-2026-0005' AND user_id <=> @seed_u02)
                OR (id <=> 6 AND order_code <=> 'ORD-2026-0006' AND user_id <=> @seed_u07)
                OR (id <=> 7 AND order_code <=> 'ORD-2026-0007' AND user_id <=> @seed_u08)
                OR (id <=> 8 AND order_code <=> 'ORD-2026-0008' AND user_id <=> @seed_u09)
                OR (id <=> 9 AND order_code <=> 'ORD-2026-0009' AND user_id <=> @seed_u10)
                OR (id <=> 10 AND order_code <=> 'ORD-2026-0010' AND user_id <=> @seed_u11)
                OR (id <=> 11 AND order_code <=> 'ORD-2026-0011' AND user_id <=> @seed_u12)
                OR (id <=> 12 AND order_code <=> 'ORD-2026-0012' AND user_id <=> @seed_u14)
                OR (id <=> 13 AND order_code <=> 'ORD-2026-0013' AND user_id <=> @seed_u15)
                OR (id <=> 14 AND order_code <=> 'ORD-2026-0014' AND user_id <=> @seed_u17)
                OR (id <=> 15 AND order_code <=> 'ORD-2026-0015' AND user_id <=> @seed_u18)
                OR (id <=> 16 AND order_code <=> 'ORD-2026-0016' AND user_id <=> @seed_u10)
                OR (id <=> 17 AND order_code <=> 'ORD-2026-0017' AND user_id <=> @seed_u08)
                OR (id <=> 18 AND order_code <=> 'ORD-PRO-2026-0001' AND user_id <=> @seed_u02)
                OR (id <=> 19 AND order_code <=> 'ORD-PRO-2026-0002' AND user_id <=> @seed_u03)
                OR (id <=> 20 AND order_code <=> 'ORD-PRO-2026-0003' AND user_id <=> @seed_u06)
                OR (id <=> 21 AND order_code <=> 'ORD-PRO-2026-0004' AND user_id <=> @seed_u09)
                OR (id <=> 22 AND order_code <=> 'ORD-GEM-2026-0001' AND user_id <=> @seed_u02)
                OR (id <=> 23 AND order_code <=> 'ORD-GEM-2026-0002' AND user_id <=> @seed_u03)
                OR (id <=> 24 AND order_code <=> 'ORD-GEM-2026-0003' AND user_id <=> @seed_u04)
                OR (id <=> 25 AND order_code <=> 'ORD-GEM-2026-0004' AND user_id <=> @seed_u06)
                OR (id <=> 26 AND order_code <=> 'ORD-GEM-2026-0005' AND user_id <=> @seed_u07)
                OR (id <=> 27 AND order_code <=> 'ORD-GEM-2026-0006' AND user_id <=> @seed_u08)
                OR (id <=> 28 AND order_code <=> 'ORD-GEM-2026-0007' AND user_id <=> @seed_u09)
                OR (id <=> 29 AND order_code <=> 'ORD-GEM-2026-0008' AND user_id <=> @seed_u10)
                OR (id <=> 30 AND order_code <=> 'ORD-GEM-2026-0009' AND user_id <=> @seed_u11)
                OR (id <=> 31 AND order_code <=> 'ORD-GEM-2026-0010' AND user_id <=> @seed_u12)
                OR (id <=> 32 AND order_code <=> 'ORD-GEM-2026-0011' AND user_id <=> @seed_u13)
                OR (id <=> 33 AND order_code <=> 'ORD-GEM-2026-0012' AND user_id <=> @seed_u14)
                OR (id <=> 34 AND order_code <=> 'ORD-GEM-2026-0013' AND user_id <=> @seed_u15)
                OR (id <=> 35 AND order_code <=> 'ORD-GEM-2026-0014' AND user_id <=> @seed_u16)
                OR (id <=> 36 AND order_code <=> 'ORD-GEM-2026-0015' AND user_id <=> @seed_u17))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in payment_db.orders; no data was changed';
    END IF;

    IF EXISTS (SELECT 1 FROM payment_db.orders WHERE (order_code <=> 'ORD-2026-0001' AND id <> 1)
        OR (order_code <=> 'ORD-2026-0002' AND id <> 2)
        OR (order_code <=> 'ORD-2026-0003' AND id <> 3)
        OR (order_code <=> 'ORD-2026-0004' AND id <> 4)
        OR (order_code <=> 'ORD-2026-0005' AND id <> 5)
        OR (order_code <=> 'ORD-2026-0006' AND id <> 6)
        OR (order_code <=> 'ORD-2026-0007' AND id <> 7)
        OR (order_code <=> 'ORD-2026-0008' AND id <> 8)
        OR (order_code <=> 'ORD-2026-0009' AND id <> 9)
        OR (order_code <=> 'ORD-2026-0010' AND id <> 10)
        OR (order_code <=> 'ORD-2026-0011' AND id <> 11)
        OR (order_code <=> 'ORD-2026-0012' AND id <> 12)
        OR (order_code <=> 'ORD-2026-0013' AND id <> 13)
        OR (order_code <=> 'ORD-2026-0014' AND id <> 14)
        OR (order_code <=> 'ORD-2026-0015' AND id <> 15)
        OR (order_code <=> 'ORD-2026-0016' AND id <> 16)
        OR (order_code <=> 'ORD-2026-0017' AND id <> 17)
        OR (order_code <=> 'ORD-PRO-2026-0001' AND id <> 18)
        OR (order_code <=> 'ORD-PRO-2026-0002' AND id <> 19)
        OR (order_code <=> 'ORD-PRO-2026-0003' AND id <> 20)
        OR (order_code <=> 'ORD-PRO-2026-0004' AND id <> 21)
        OR (order_code <=> 'ORD-GEM-2026-0001' AND id <> 22)
        OR (order_code <=> 'ORD-GEM-2026-0002' AND id <> 23)
        OR (order_code <=> 'ORD-GEM-2026-0003' AND id <> 24)
        OR (order_code <=> 'ORD-GEM-2026-0004' AND id <> 25)
        OR (order_code <=> 'ORD-GEM-2026-0005' AND id <> 26)
        OR (order_code <=> 'ORD-GEM-2026-0006' AND id <> 27)
        OR (order_code <=> 'ORD-GEM-2026-0007' AND id <> 28)
        OR (order_code <=> 'ORD-GEM-2026-0008' AND id <> 29)
        OR (order_code <=> 'ORD-GEM-2026-0009' AND id <> 30)
        OR (order_code <=> 'ORD-GEM-2026-0010' AND id <> 31)
        OR (order_code <=> 'ORD-GEM-2026-0011' AND id <> 32)
        OR (order_code <=> 'ORD-GEM-2026-0012' AND id <> 33)
        OR (order_code <=> 'ORD-GEM-2026-0013' AND id <> 34)
        OR (order_code <=> 'ORD-GEM-2026-0014' AND id <> 35)
        OR (order_code <=> 'ORD-GEM-2026-0015' AND id <> 36)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed natural key collision in payment_db.orders; no data was changed';
    END IF;

    INSERT INTO payment_db.orders (id, order_code, user_id, idempotency_key, product_type, plan_code, plan_duration_months, gem_package_code, gem_amount, status, total_amount, currency, expires_at, created_at, updated_at) VALUES
    (1, 'ORD-2026-0001', @seed_u02, 'seed-idem-order-0001', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 1490000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY)),
    (2, 'ORD-2026-0002', @seed_u03, 'seed-idem-order-0002', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 990000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY)),
    (3, 'ORD-2026-0003', @seed_u04, 'seed-idem-order-0003', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 790000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY)),
    (4, 'ORD-2026-0004', @seed_u06, 'seed-idem-order-0004', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 890000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY)),
    (5, 'ORD-2026-0005', @seed_u02, 'seed-idem-order-0005', 'COURSE', NULL, NULL, NULL, NULL, 'PENDING_PAYMENT', 790000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY)),
    (6, 'ORD-2026-0006', @seed_u07, 'seed-idem-order-0006', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 490000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY)),
    (7, 'ORD-2026-0007', @seed_u08, 'seed-idem-order-0007', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 1190000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (8, 'ORD-2026-0008', @seed_u09, 'seed-idem-order-0008', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 690000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (9, 'ORD-2026-0009', @seed_u10, 'seed-idem-order-0009', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 850000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (10, 'ORD-2026-0010', @seed_u11, 'seed-idem-order-0010', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 750000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (11, 'ORD-2026-0011', @seed_u12, 'seed-idem-order-0011', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 1090000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (12, 'ORD-2026-0012', @seed_u14, 'seed-idem-order-0012', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 1290000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (13, 'ORD-2026-0013', @seed_u15, 'seed-idem-order-0013', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 390000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (14, 'ORD-2026-0014', @seed_u17, 'seed-idem-order-0014', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 890000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (15, 'ORD-2026-0015', @seed_u18, 'seed-idem-order-0015', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 750000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (16, 'ORD-2026-0016', @seed_u10, 'seed-idem-order-0016', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 590000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (17, 'ORD-2026-0017', @seed_u08, 'seed-idem-order-0017', 'COURSE', NULL, NULL, NULL, NULL, 'PAID', 1490000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (18, 'ORD-PRO-2026-0001', @seed_u02, 'seed-idem-order-0018', 'PRO', 'PRO_YEAR', 12, NULL, NULL, 'PAID', 499000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (19, 'ORD-PRO-2026-0002', @seed_u03, 'seed-idem-order-0019', 'PRO', 'PRO_QUARTER', 3, NULL, NULL, 'PAID', 120000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (20, 'ORD-PRO-2026-0003', @seed_u06, 'seed-idem-order-0020', 'PRO', 'PRO_MONTH', 1, NULL, NULL, 'PAID', 50000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (21, 'ORD-PRO-2026-0004', @seed_u09, 'seed-idem-order-0021', 'PRO', 'PRO_QUARTER', 3, NULL, NULL, 'PAID', 120000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (22, 'ORD-GEM-2026-0001', @seed_u02, 'seed-idem-order-0022', 'GEM_TOPUP', NULL, NULL, 'GEM_200', 200, 'PAID', 19000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (23, 'ORD-GEM-2026-0002', @seed_u03, 'seed-idem-order-0023', 'GEM_TOPUP', NULL, NULL, 'GEM_500', 500, 'PAID', 45000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (24, 'ORD-GEM-2026-0003', @seed_u04, 'seed-idem-order-0024', 'GEM_TOPUP', NULL, NULL, 'GEM_1200', 1200, 'PAID', 99000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (25, 'ORD-GEM-2026-0004', @seed_u06, 'seed-idem-order-0025', 'GEM_TOPUP', NULL, NULL, 'GEM_200', 200, 'PAID', 19000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (26, 'ORD-GEM-2026-0005', @seed_u07, 'seed-idem-order-0026', 'GEM_TOPUP', NULL, NULL, 'GEM_500', 500, 'PAID', 45000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (27, 'ORD-GEM-2026-0006', @seed_u08, 'seed-idem-order-0027', 'GEM_TOPUP', NULL, NULL, 'GEM_1200', 1200, 'PAID', 99000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (28, 'ORD-GEM-2026-0007', @seed_u09, 'seed-idem-order-0028', 'GEM_TOPUP', NULL, NULL, 'GEM_200', 200, 'PAID', 19000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (29, 'ORD-GEM-2026-0008', @seed_u10, 'seed-idem-order-0029', 'GEM_TOPUP', NULL, NULL, 'GEM_500', 500, 'PAID', 45000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (30, 'ORD-GEM-2026-0009', @seed_u11, 'seed-idem-order-0030', 'GEM_TOPUP', NULL, NULL, 'GEM_1200', 1200, 'PAID', 99000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (31, 'ORD-GEM-2026-0010', @seed_u12, 'seed-idem-order-0031', 'GEM_TOPUP', NULL, NULL, 'GEM_200', 200, 'PAID', 19000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (32, 'ORD-GEM-2026-0011', @seed_u13, 'seed-idem-order-0032', 'GEM_TOPUP', NULL, NULL, 'GEM_500', 500, 'PAID', 45000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (33, 'ORD-GEM-2026-0012', @seed_u14, 'seed-idem-order-0033', 'GEM_TOPUP', NULL, NULL, 'GEM_1200', 1200, 'PAID', 99000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (34, 'ORD-GEM-2026-0013', @seed_u15, 'seed-idem-order-0034', 'GEM_TOPUP', NULL, NULL, 'GEM_200', 200, 'PAID', 19000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    (35, 'ORD-GEM-2026-0014', @seed_u16, 'seed-idem-order-0035', 'GEM_TOPUP', NULL, NULL, 'GEM_500', 500, 'PAID', 45000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (36, 'ORD-GEM-2026-0015', @seed_u17, 'seed-idem-order-0036', 'GEM_TOPUP', NULL, NULL, 'GEM_1200', 1200, 'PAID', 99000.00, 'VND', DATE_ADD('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY))
    ON DUPLICATE KEY UPDATE status = VALUES(status), total_amount = VALUES(total_amount);

    IF EXISTS (SELECT 1 FROM payment_db.order_items
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND order_id <=> 1 AND course_id <=> 1)
                OR (id <=> 2 AND order_id <=> 2 AND course_id <=> 2)
                OR (id <=> 3 AND order_id <=> 3 AND course_id <=> 3)
                OR (id <=> 4 AND order_id <=> 4 AND course_id <=> 4)
                OR (id <=> 5 AND order_id <=> 5 AND course_id <=> 3))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in payment_db.order_items; no data was changed';
    END IF;

    INSERT INTO payment_db.order_items (id, order_id, course_id, course_title, unit_price, discount_amount, final_price, created_at) VALUES
    (1, 1, 1, 'IELTS Masterclass 7.5+ Toàn Diện', 2490000.00, 1000000.00, 1490000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY)),
    (2, 2, 2, 'TOEIC Đột Phá 850+ Cấp Tốc', 1690000.00, 700000.00, 990000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY)),
    (3, 3, 3, 'Tiếng Anh Giao Tiếp Phản Xạ Đi Làm', 1290000.00, 500000.00, 790000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY)),
    (4, 4, 4, 'English for Software Engineers & IT', 1490000.00, 600000.00, 890000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY)),
    (5, 5, 3, 'Tiếng Anh Giao Tiếp Phản Xạ Đi Làm', 1290000.00, 500000.00, 790000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY)),
    (6, 6, 6, 'Chuẩn Hóa Phát Âm 44 Âm IPA Trong 30 Ngày', 890000.00, 400000.00, 490000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY)),
    (7, 7, 7, 'IELTS Writing Task 1 & 2: Tư Duy Lập Luận Band 7.0+', 1890000.00, 700000.00, 1190000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (8, 8, 10, 'Viết Email & Thuyết Trình Thương Mại Quốc Tế', 1190000.00, 500000.00, 690000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (9, 9, 9, 'TOEIC 4 Kỹ Năng Cho Người Đi Làm (650+)', 1390000.00, 540000.00, 850000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (10, 10, 13, 'Chinh Phục Phỏng Vấn Tiếng Anh & Viết CV Chuẩn ATS', 1250000.00, 500000.00, 750000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (11, 11, 8, 'IELTS Speaking Thực Chiến: Trôi Chảy & Tự Nhiên', 1690000.00, 600000.00, 1090000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (12, 12, 15, 'Hồ Sơ Du Học: Viết Essay & Phỏng Vấn Học Bổng', 1990000.00, 700000.00, 1290000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (13, 13, 14, 'Tiếng Anh Giao Tiếp Du Lịch & Công Tác Nước Ngoài', 690000.00, 300000.00, 390000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (14, 14, 4, 'English for Software Engineers & IT', 1490000.00, 600000.00, 890000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (15, 15, 13, 'Chinh Phục Phỏng Vấn Tiếng Anh & Viết CV Chuẩn ATS', 1250000.00, 500000.00, 750000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (16, 16, 12, 'Đọc Hiểu Báo Kinh Tế & Tài Liệu Học Thuật', 990000.00, 400000.00, 590000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (17, 17, 1, 'IELTS Masterclass 7.5+ Toàn Diện', 2490000.00, 1000000.00, 1490000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (18, 18, NULL, 'ChitChatGo Pro · 1 năm', 600000.00, 101000.00, 499000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (19, 19, NULL, 'ChitChatGo Pro · 3 tháng', 150000.00, 30000.00, 120000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (20, 20, NULL, 'ChitChatGo Pro · 1 tháng', 50000.00, 0.00, 50000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (21, 21, NULL, 'ChitChatGo Pro · 3 tháng', 150000.00, 30000.00, 120000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (22, 22, NULL, 'Gói nạp 200 Gems ChitChatGo', 19000.00, 0.00, 19000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (23, 23, NULL, 'Gói nạp 500 Gems ChitChatGo', 45000.00, 0.00, 45000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (24, 24, NULL, 'Gói nạp 1200 Gems ChitChatGo', 99000.00, 0.00, 99000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (25, 25, NULL, 'Gói nạp 200 Gems ChitChatGo', 19000.00, 0.00, 19000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (26, 26, NULL, 'Gói nạp 500 Gems ChitChatGo', 45000.00, 0.00, 45000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (27, 27, NULL, 'Gói nạp 1200 Gems ChitChatGo', 99000.00, 0.00, 99000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (28, 28, NULL, 'Gói nạp 200 Gems ChitChatGo', 19000.00, 0.00, 19000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (29, 29, NULL, 'Gói nạp 500 Gems ChitChatGo', 45000.00, 0.00, 45000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (30, 30, NULL, 'Gói nạp 1200 Gems ChitChatGo', 99000.00, 0.00, 99000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (31, 31, NULL, 'Gói nạp 200 Gems ChitChatGo', 19000.00, 0.00, 19000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (32, 32, NULL, 'Gói nạp 500 Gems ChitChatGo', 45000.00, 0.00, 45000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (33, 33, NULL, 'Gói nạp 1200 Gems ChitChatGo', 99000.00, 0.00, 99000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (34, 34, NULL, 'Gói nạp 200 Gems ChitChatGo', 19000.00, 0.00, 19000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    (35, 35, NULL, 'Gói nạp 500 Gems ChitChatGo', 45000.00, 0.00, 45000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (36, 36, NULL, 'Gói nạp 1200 Gems ChitChatGo', 99000.00, 0.00, 99000.00, DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY))
    ON DUPLICATE KEY UPDATE final_price = VALUES(final_price), course_title = VALUES(course_title);

    IF EXISTS (SELECT 1 FROM payment_db.payments
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND order_id <=> 1 AND provider_transaction_code <=> 'SEED_MOCK_TXN_1')
                OR (id <=> 2 AND order_id <=> 2 AND provider_transaction_code <=> 'SEED_MOCK_TXN_2')
                OR (id <=> 3 AND order_id <=> 3 AND provider_transaction_code <=> 'SEED_MOCK_TXN_3')
                OR (id <=> 4 AND order_id <=> 4 AND provider_transaction_code <=> 'SEED_MOCK_TXN_4')
                OR (id <=> 5 AND order_id <=> 5 AND provider_transaction_code <=> 'SEED_MOCK_TXN_5'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in payment_db.payments; no data was changed';
    END IF;

    INSERT INTO payment_db.payments (id, order_id, provider, status, amount, currency, checkout_url, provider_transaction_code, failure_code, failure_message, paid_at, enrollment_activated_at, created_at, updated_at) VALUES
    (1, 1, 'MOCK', 'SUCCESS', 1490000.00, 'VND', NULL, 'SEED_MOCK_TXN_1', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY)),
    (2, 2, 'MOCK', 'SUCCESS', 990000.00, 'VND', NULL, 'SEED_MOCK_TXN_2', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY)),
    (3, 3, 'MOCK', 'SUCCESS', 790000.00, 'VND', NULL, 'SEED_MOCK_TXN_3', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY)),
    (4, 4, 'MOCK', 'SUCCESS', 890000.00, 'VND', NULL, 'SEED_MOCK_TXN_4', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY)),
    (5, 5, 'MOCK', 'PENDING', 790000.00, 'VND', NULL, 'SEED_MOCK_TXN_5', NULL, NULL, NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY)),
    (6, 6, 'MOCK', 'SUCCESS', 490000.00, 'VND', NULL, 'SEED_MOCK_TXN_6', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY)),
    (7, 7, 'MOCK', 'SUCCESS', 1190000.00, 'VND', NULL, 'SEED_MOCK_TXN_7', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (8, 8, 'MOCK', 'SUCCESS', 690000.00, 'VND', NULL, 'SEED_MOCK_TXN_8', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (9, 9, 'MOCK', 'SUCCESS', 850000.00, 'VND', NULL, 'SEED_MOCK_TXN_9', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (10, 10, 'MOCK', 'SUCCESS', 750000.00, 'VND', NULL, 'SEED_MOCK_TXN_10', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (11, 11, 'MOCK', 'SUCCESS', 1090000.00, 'VND', NULL, 'SEED_MOCK_TXN_11', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (12, 12, 'MOCK', 'SUCCESS', 1290000.00, 'VND', NULL, 'SEED_MOCK_TXN_12', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (13, 13, 'MOCK', 'SUCCESS', 390000.00, 'VND', NULL, 'SEED_MOCK_TXN_13', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (14, 14, 'MOCK', 'SUCCESS', 890000.00, 'VND', NULL, 'SEED_MOCK_TXN_14', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (15, 15, 'MOCK', 'SUCCESS', 750000.00, 'VND', NULL, 'SEED_MOCK_TXN_15', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (16, 16, 'MOCK', 'SUCCESS', 590000.00, 'VND', NULL, 'SEED_MOCK_TXN_16', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (17, 17, 'MOCK', 'SUCCESS', 1490000.00, 'VND', NULL, 'SEED_MOCK_TXN_17', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (18, 18, 'MOCK', 'SUCCESS', 499000.00, 'VND', NULL, 'SEED_MOCK_TXN_18', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (19, 19, 'MOCK', 'SUCCESS', 120000.00, 'VND', NULL, 'SEED_MOCK_TXN_19', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (20, 20, 'MOCK', 'SUCCESS', 50000.00, 'VND', NULL, 'SEED_MOCK_TXN_20', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (21, 21, 'MOCK', 'SUCCESS', 120000.00, 'VND', NULL, 'SEED_MOCK_TXN_21', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (22, 22, 'MOCK', 'SUCCESS', 19000.00, 'VND', NULL, 'SEED_MOCK_TXN_22', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (23, 23, 'MOCK', 'SUCCESS', 45000.00, 'VND', NULL, 'SEED_MOCK_TXN_23', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (24, 24, 'MOCK', 'SUCCESS', 99000.00, 'VND', NULL, 'SEED_MOCK_TXN_24', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (25, 25, 'MOCK', 'SUCCESS', 19000.00, 'VND', NULL, 'SEED_MOCK_TXN_25', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (26, 26, 'MOCK', 'SUCCESS', 45000.00, 'VND', NULL, 'SEED_MOCK_TXN_26', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (27, 27, 'MOCK', 'SUCCESS', 99000.00, 'VND', NULL, 'SEED_MOCK_TXN_27', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (28, 28, 'MOCK', 'SUCCESS', 19000.00, 'VND', NULL, 'SEED_MOCK_TXN_28', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (29, 29, 'MOCK', 'SUCCESS', 45000.00, 'VND', NULL, 'SEED_MOCK_TXN_29', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (30, 30, 'MOCK', 'SUCCESS', 99000.00, 'VND', NULL, 'SEED_MOCK_TXN_30', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (31, 31, 'MOCK', 'SUCCESS', 19000.00, 'VND', NULL, 'SEED_MOCK_TXN_31', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (32, 32, 'MOCK', 'SUCCESS', 45000.00, 'VND', NULL, 'SEED_MOCK_TXN_32', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (33, 33, 'MOCK', 'SUCCESS', 99000.00, 'VND', NULL, 'SEED_MOCK_TXN_33', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (34, 34, 'MOCK', 'SUCCESS', 19000.00, 'VND', NULL, 'SEED_MOCK_TXN_34', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    (35, 35, 'MOCK', 'SUCCESS', 45000.00, 'VND', NULL, 'SEED_MOCK_TXN_35', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (36, 36, 'MOCK', 'SUCCESS', 99000.00, 'VND', NULL, 'SEED_MOCK_TXN_36', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY), DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY))
    ON DUPLICATE KEY UPDATE status = VALUES(status), amount = VALUES(amount);

    IF EXISTS (SELECT 1 FROM payment_db.payment_transactions
        WHERE id IN (1, 2, 3, 4, 5)
            AND NOT ((id <=> 1 AND payment_id <=> 1 AND provider_transaction_code <=> 'SEED_MOCK_TXN_1')
                OR (id <=> 2 AND payment_id <=> 2 AND provider_transaction_code <=> 'SEED_MOCK_TXN_2')
                OR (id <=> 3 AND payment_id <=> 3 AND provider_transaction_code <=> 'SEED_MOCK_TXN_3')
                OR (id <=> 4 AND payment_id <=> 4 AND provider_transaction_code <=> 'SEED_MOCK_TXN_4')
                OR (id <=> 5 AND payment_id <=> 5 AND provider_transaction_code <=> 'SEED_MOCK_TXN_5'))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seed ID collision in payment_db.payment_transactions; no data was changed';
    END IF;

    INSERT INTO payment_db.payment_transactions (id, payment_id, event_type, provider, status, amount, currency, provider_transaction_code, payload_checksum, created_at) VALUES
    (1, 1, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 1490000.00, 'VND', 'SEED_MOCK_TXN_1', 'chk_mock_001_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 25 DAY)),
    (2, 2, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 990000.00, 'VND', 'SEED_MOCK_TXN_2', 'chk_mock_002_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 22 DAY)),
    (3, 3, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 790000.00, 'VND', 'SEED_MOCK_TXN_3', 'chk_mock_003_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 20 DAY)),
    (4, 4, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 890000.00, 'VND', 'SEED_MOCK_TXN_4', 'chk_mock_004_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 18 DAY)),
    (5, 5, 'CREATED', 'MOCK', 'PENDING', 790000.00, 'VND', 'SEED_MOCK_TXN_5', 'chk_mock_005_pending', DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY)),
    (6, 6, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 490000.00, 'VND', 'SEED_MOCK_TXN_6', 'chk_mock_006_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 17 DAY)),
    (7, 7, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 1190000.00, 'VND', 'SEED_MOCK_TXN_7', 'chk_mock_007_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (8, 8, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 690000.00, 'VND', 'SEED_MOCK_TXN_8', 'chk_mock_008_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (9, 9, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 850000.00, 'VND', 'SEED_MOCK_TXN_9', 'chk_mock_009_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (10, 10, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 750000.00, 'VND', 'SEED_MOCK_TXN_10', 'chk_mock_010_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (11, 11, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 1090000.00, 'VND', 'SEED_MOCK_TXN_11', 'chk_mock_011_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (12, 12, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 1290000.00, 'VND', 'SEED_MOCK_TXN_12', 'chk_mock_012_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (13, 13, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 390000.00, 'VND', 'SEED_MOCK_TXN_13', 'chk_mock_013_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (14, 14, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 890000.00, 'VND', 'SEED_MOCK_TXN_14', 'chk_mock_014_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (15, 15, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 750000.00, 'VND', 'SEED_MOCK_TXN_15', 'chk_mock_015_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (16, 16, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 590000.00, 'VND', 'SEED_MOCK_TXN_16', 'chk_mock_016_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (17, 17, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 1490000.00, 'VND', 'SEED_MOCK_TXN_17', 'chk_mock_017_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (18, 18, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 499000.00, 'VND', 'SEED_MOCK_TXN_18', 'chk_mock_018_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (19, 19, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 120000.00, 'VND', 'SEED_MOCK_TXN_19', 'chk_mock_019_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (20, 20, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 50000.00, 'VND', 'SEED_MOCK_TXN_20', 'chk_mock_020_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (21, 21, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 120000.00, 'VND', 'SEED_MOCK_TXN_21', 'chk_mock_021_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (22, 22, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 19000.00, 'VND', 'SEED_MOCK_TXN_22', 'chk_mock_022_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY)),
    (23, 23, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 45000.00, 'VND', 'SEED_MOCK_TXN_23', 'chk_mock_023_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (24, 24, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 99000.00, 'VND', 'SEED_MOCK_TXN_24', 'chk_mock_024_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (25, 25, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 19000.00, 'VND', 'SEED_MOCK_TXN_25', 'chk_mock_025_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (26, 26, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 45000.00, 'VND', 'SEED_MOCK_TXN_26', 'chk_mock_026_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (27, 27, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 99000.00, 'VND', 'SEED_MOCK_TXN_27', 'chk_mock_027_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (28, 28, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 19000.00, 'VND', 'SEED_MOCK_TXN_28', 'chk_mock_028_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (29, 29, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 45000.00, 'VND', 'SEED_MOCK_TXN_29', 'chk_mock_029_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (30, 30, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 99000.00, 'VND', 'SEED_MOCK_TXN_30', 'chk_mock_030_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (31, 31, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 19000.00, 'VND', 'SEED_MOCK_TXN_31', 'chk_mock_031_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (32, 32, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 45000.00, 'VND', 'SEED_MOCK_TXN_32', 'chk_mock_032_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (33, 33, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 99000.00, 'VND', 'SEED_MOCK_TXN_33', 'chk_mock_033_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (34, 34, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 19000.00, 'VND', 'SEED_MOCK_TXN_34', 'chk_mock_034_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    (35, 35, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 45000.00, 'VND', 'SEED_MOCK_TXN_35', 'chk_mock_035_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (36, 36, 'STATUS_CHANGED', 'MOCK', 'SUCCESS', 99000.00, 'VND', 'SEED_MOCK_TXN_36', 'chk_mock_036_success', DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY))
    ON DUPLICATE KEY UPDATE status = VALUES(status);

    INSERT INTO payment_db.payment_admin_audit (id, actor_id, action, target, description, created_at) VALUES
    (1, @seed_u01, 'PRO_PLAN_CREATE', 'plan:PRO_STUDENT_1M', 'Tạo gói ChitChatGo Pro Sinh viên 1 tháng (39.000 VND).', DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY)),
    (2, @seed_u01, 'PRO_PLAN_CREATE', 'plan:PRO_STUDENT_3M', 'Tạo gói ChitChatGo Pro Sinh viên 3 tháng (99.000 VND).', DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY)),
    (3, @seed_u01, 'PRO_PLAN_CREATE', 'plan:PRO_STUDENT_12M', 'Tạo gói ChitChatGo Pro Sinh viên 1 năm (399.000 VND).', DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY)),
    (4, @seed_u01, 'PRO_PLAN_CREATE', 'plan:PRO_SUMMER_3M', 'Tạo gói chiến dịch Ưu đãi Hè Bứt Phá 3 tháng.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY)),
    (5, @seed_u01, 'PRO_PLAN_CREATE', 'plan:PRO_BACKTOSCHOOL_12M', 'Tạo gói chiến dịch Ưu đãi Tựu Trường 1 năm.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY)),
    (6, @seed_u01, 'PRO_PLAN_UPDATE', 'plan:PRO_SUMMER_3M', 'Đóng mở bán gói Ưu đãi Hè Bứt Phá sau khi hết hạn chiến dịch.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY)),
    (7, @seed_u01, 'PRO_PLAN_UPDATE', 'plan:PRO_YEAR', 'Xác nhận giá niêm yết chuẩn gói Pro 1 năm 499.000 VND.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY)),
    (8, @seed_u01, 'PAYMENT_VERIFY', 'order:ORD-2026-0001', 'Đối soát thành công giao dịch khóa học IELTS Masterclass 7.5+.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY)),
    (9, @seed_u01, 'PAYMENT_VERIFY', 'order:ORD-2026-0002', 'Đối soát thành công giao dịch khóa học TOEIC Đột Phá 850+.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY)),
    (10, @seed_u01, 'PAYMENT_VERIFY', 'order:ORD-2026-0004', 'Đối soát thành công giao dịch khóa học English for Software Engineers.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY)),
    (11, @seed_u01, 'PAYMENT_VERIFY', 'order:ORD-PRO-2026-0001', 'Xác nhận kích hoạt thành công gói ChitChatGo Pro 1 năm.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY)),
    (12, @seed_u01, 'PAYMENT_VERIFY', 'order:ORD-GEM-2026-0001', 'Xác nhận cộng 200 Gems cho đơn hàng nạp Gems đầu tiên.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY)),
    (13, @seed_u01, 'PAYMENT_REPORT_VIEW', 'report:2026-10', 'Xuất báo cáo doanh thu tháng 10/2026 cho khóa học, Pro và Gems.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY)),
    (14, @seed_u01, 'PRO_PLAN_CREATE', 'plan:PRO_TEAM_12M', 'Khởi tạo gói doanh nghiệp & nhóm học tập 1 năm.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY)),
    (15, @seed_u01, 'PRO_PLAN_UPDATE', 'plan:PRO_TRIAL_1M', 'Tạm dừng gói trải nghiệm sau khi hoàn tất đợt thử nghiệm.', DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE description = VALUES(description);

    -- =========================================================================
    -- 5. AI_DB
    -- =========================================================================
    INSERT INTO ai_db.ai_conversations (id, user_id, title, course_id, lesson_id, context_title, active_request_id, active_until, created_at, updated_at) VALUES
    (1, @seed_u02, 'Phân biệt False và Not Given IELTS Reading', 1, 910102, 'IELTS Reading: Xử lý dạng True / False / Not Given', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 16 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 16 DAY)),
    (2, @seed_u03, 'Cấu trúc giả định trong TOEIC Part 5', 2, 910201, 'TOEIC Part 5: Phân tích từ loại & cấu trúc bẫy', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 15 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 15 DAY)),
    (3, @seed_u04, 'Cách từ chối lịch họp lịch sự bằng tiếng Anh', 3, 910301, 'Chào hỏi chuyên nghiệp và từ chối lịch hẹn tinh tế', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 14 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 14 DAY)),
    (4, @seed_u06, 'Luyện báo cáo Daily Stand-up cho Backend Dev', 4, 910401, 'Báo cáo Daily Stand-up & Mô tả Blocker', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 13 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 13 DAY)),
    (5, @seed_u07, 'Phân biệt cặp nguyên âm /iː/ và /ɪ/', 6, 910601, 'Cặp nguyên âm dễ nhầm: /iː/ vs /ɪ/', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 12 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 12 DAY)),
    (6, @seed_u08, 'Góp ý câu Overview cho biểu đồ đường IELTS Task 1', 7, 910701, 'Viết Overview sắc nét cho biểu đồ đường', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 11 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 11 DAY)),
    (7, @seed_u09, 'Viết lại email nhắc deadline theo chuẩn BLUF', 10, 911001, 'Cấu trúc Email chuẩn BLUF', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 10 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 10 DAY)),
    (8, @seed_u10, 'Phân biệt "in charge of" và "responsible for"', 9, 910901, 'Từ vựng cốt lõi chủ đề Hợp đồng & Nhân sự', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 9 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 9 DAY)),
    (9, @seed_u11, 'Nâng cấp câu mô tả kinh nghiệm trên CV chuẩn ATS', 13, 911301, 'Viết Bullet Point thành tích bằng động từ hành động', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 8 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 8 DAY)),
    (10, @seed_u12, 'Mở rộng ý tưởng IELTS Speaking Part 1 chủ đề Reading', 8, 910801, 'Công thức mở rộng câu trả lời Part 1', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 7 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 7 DAY)),
    (11, @seed_u13, 'Khi nào dùng Do/Does và khi nào dùng Am/Is/Are?', 16, 911601, 'Trật tự câu S–V–O và động từ To Be', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 6 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 6 DAY)),
    (12, @seed_u14, 'Mở đầu Statement of Purpose du học sao cho ấn tượng', 15, 911501, 'Tìm sợi chỉ đỏ trong SOP', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 5 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 5 DAY)),
    (13, @seed_u15, 'Mẫu câu hỏi đường và bắt taxi khi đi công tác', 14, 911401, 'Sân bay, Hải quan & Di chuyển quốc tế', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 4 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 4 DAY)),
    (14, @seed_u16, 'Cách nghe rõ nối âm trong bài Dictation', 11, 911101, 'Giải mã Weak Forms & Connected Speech', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 3 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 3 DAY)),
    (15, @seed_u17, 'Giải thích thuật ngữ Idempotency bằng tiếng Anh', 4, 910403, 'Trình bày Trade-offs trong System Design', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 2 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 2 DAY)),
    (16, @seed_u18, 'Trả lời câu hỏi điểm yếu trong phỏng vấn tiếng Anh', 13, 911303, 'Mô hình STAR & Đặt câu hỏi ngược', NULL, NULL, DATE_SUB('2026-10-20 08:00:00', INTERVAL 1 DAY), DATE_SUB('2026-10-20 08:05:00', INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE title = VALUES(title), context_title = VALUES(context_title);

    INSERT INTO ai_db.ai_messages (id, conversation_id, sender, content, truncated, request_id, created_at) VALUES
    (1, 1, 'USER', 'Mình hay bị nhầm giữa FALSE và NOT GIVEN trong IELTS Reading. Bạn giải thích mẹo nhanh giúp mình với?', FALSE, 'seed-ai-req-0001', DATE_SUB('2026-10-20 08:01:00', INTERVAL 16 DAY)),
    (2, 1, 'AI', 'Rất đơn giản: hãy thử đặt câu phủ định của câu hỏi. Nếu bài đọc **chứng minh rõ ràng điều ngược lại**, chọn **FALSE**. Nếu bài đọc không đề cập hoặc không đủ dữ kiện để kết luận đúng hay sai, chọn **NOT GIVEN**. Luôn gạch chân các từ giới hạn như *only, always, first* vì chúng thường là điểm bẫy!', FALSE, 'seed-ai-req-0001', DATE_SUB('2026-10-20 08:02:00', INTERVAL 16 DAY)),
    (3, 2, 'USER', 'Tại sao câu "The manager requested that all employees attend" lại dùng "attend" mà không chia quá khứ?', FALSE, 'seed-ai-req-0002', DATE_SUB('2026-10-20 08:01:00', INTERVAL 15 DAY)),
    (4, 2, 'AI', 'Đây là cấu trúc **Thức giả định (Subjunctive)** rất hay ra trong TOEIC Part 5: sau các động từ như *request, suggest, recommend, insist + that*, động từ theo sau luôn ở dạng **nguyên mẫu không "to"** bất kể chủ ngữ số ít hay thì quá khứ.', FALSE, 'seed-ai-req-0002', DATE_SUB('2026-10-20 08:02:00', INTERVAL 15 DAY)),
    (5, 3, 'USER', 'Cho mình 3 mẫu câu từ chối cuộc họp trùng lịch với đối tác nước ngoài thật lịch sự nhé.', FALSE, 'seed-ai-req-0003', DATE_SUB('2026-10-20 08:01:00', INTERVAL 14 DAY)),
    (6, 3, 'AI', 'Bạn có thể dùng:\n1. *"I appreciate the invitation, though I have a prior commitment at that time. Could we reschedule for Friday?"*\n2. *"Unfortunately I am double-booked at 2 PM—would 4 PM work instead?"*\n3. *"Thank you for looping me in. I won''t be able to make that slot, so here are two alternatives."*', FALSE, 'seed-ai-req-0003', DATE_SUB('2026-10-20 08:02:00', INTERVAL 14 DAY)),
    (7, 4, 'USER', 'Giúp mình chỉnh câu stand-up: "Yesterday I fix bug login and today I do API payment".', FALSE, 'seed-ai-req-0004', DATE_SUB('2026-10-20 08:01:00', INTERVAL 13 DAY)),
    (8, 4, 'AI', 'Bạn sửa lại cho tự nhiên và đúng thì như sau:\n*"Yesterday I resolved the login token expiration bug and added unit tests. Today I am implementing the payment webhook handler. No blockers so far."*\nLưu ý dùng thì **Quá khứ đơn** cho việc hôm qua và **Hiện tại tiếp diễn** cho việc đang làm hôm nay.', FALSE, 'seed-ai-req-0004', DATE_SUB('2026-10-20 08:02:00', INTERVAL 13 DAY)),
    (9, 5, 'USER', 'Làm sao phát âm rõ "sheet" và "shit" hay "leave" và "live" để không bị hiểu nhầm?', FALSE, 'seed-ai-req-0005', DATE_SUB('2026-10-20 08:01:00', INTERVAL 12 DAY)),
    (10, 5, 'AI', 'Với **/iː/** (*leave, sheep*): kéo khóe miệng sang hai bên như đang cười và giữ âm hơi dài. Với **/ɪ/** (*live, ship*): thả lỏng môi và lưỡi, âm ngắn và dứt khoát hơn (hơi ngả nhẹ giữa "i" và "ê"). Hãy luyện cặp *sheep–ship, feel–fill, seat–sit* mỗi ngày 5 phút!', FALSE, 'seed-ai-req-0005', DATE_SUB('2026-10-20 08:02:00', INTERVAL 12 DAY)),
    (11, 6, 'USER', 'Trong Overview của Writing Task 1 mình có nên đưa phần trăm cụ thể vào không?', FALSE, 'seed-ai-req-0006', DATE_SUB('2026-10-20 08:01:00', INTERVAL 11 DAY)),
    (12, 6, 'AI', 'Không nên bạn nhé! Đoạn **Overview** chỉ cần khái quát 2–3 đặc điểm nổi bật nhất (xu hướng chung tăng/giảm, hạng mục cao nhất hoặc thay đổi rõ nhất). Số liệu phần trăm chi tiết hãy để sang hai đoạn **Body 1 & Body 2** để bài viết có cấu trúc chuẩn Band 7.5+.', FALSE, 'seed-ai-req-0006', DATE_SUB('2026-10-20 08:02:00', INTERVAL 11 DAY)),
    (13, 7, 'USER', 'Mình muốn viết email nhắc khách hàng gửi tài liệu thiết kế trước thứ Sáu mà không bị gắt.', FALSE, 'seed-ai-req-0007', DATE_SUB('2026-10-20 08:01:00', INTERVAL 10 DAY)),
    (14, 7, 'AI', 'Gợi ý chuẩn **BLUF**:\n*Subject: Action needed by Friday – Final design assets for Q4 launch*\n*Hi Alex, Could you please share the final design assets by Friday 3 PM so we stay on track for Monday''s release? Let me know if you need any support from our side. Best regards,*', FALSE, 'seed-ai-req-0007', DATE_SUB('2026-10-20 08:02:00', INTERVAL 10 DAY)),
    (15, 8, 'USER', '"In charge of" và "responsible for" trong TOEIC có dùng thay thế nhau được không?', FALSE, 'seed-ai-req-0008', DATE_SUB('2026-10-20 08:01:00', INTERVAL 9 DAY)),
    (16, 8, 'AI', 'Về nghĩa cơ bản cả hai đều diễn tả việc phụ trách một nhiệm vụ và đều cộng **Danh từ / V-ing**. Tuy nhiên *in charge of* nhấn mạnh quyền quản lý trực tiếp (ví dụ: *in charge of the regional office*), còn *responsible for* dùng rộng hơn cho mọi trách nhiệm công việc.', FALSE, 'seed-ai-req-0008', DATE_SUB('2026-10-20 08:02:00', INTERVAL 9 DAY)),
    (17, 9, 'USER', 'Sửa giúp mình dòng CV: "Worked on React frontend and made pages load faster".', FALSE, 'seed-ai-req-0009', DATE_SUB('2026-10-20 08:01:00', INTERVAL 8 DAY)),
    (18, 9, 'AI', 'Bản nâng cấp chuẩn ATS:\n*"Refactored React product pages with code-splitting and memoization, improving initial page load time by 35%."*\nLuôn mở đầu bằng **động từ hành động mạnh** (*Refactored, Built, Automated*) và kèm **kết quả đo lường được**.', FALSE, 'seed-ai-req-0009', DATE_SUB('2026-10-20 08:02:00', INTERVAL 8 DAY)),
    (19, 10, 'USER', 'Nếu giám khảo hỏi "Do you like reading books?", trả lời thế nào để tự nhiên đạt Band 7+?', FALSE, 'seed-ai-req-0010', DATE_SUB('2026-10-20 08:01:00', INTERVAL 7 DAY)),
    (20, 10, 'AI', 'Áp dụng công thức **Answer + Reason + Mini Example**:\n*"Definitely, I''m quite an avid reader whenever my schedule allows. Reading non-fiction helps me unwind after long hours staring at a screen—in fact, I''m currently halfway through a great book on behavioral psychology."*', FALSE, 'seed-ai-req-0010', DATE_SUB('2026-10-20 08:02:00', INTERVAL 7 DAY)),
    (21, 11, 'USER', 'Em hay viết nhầm "Are you live in Hanoi?" thay vì "Do you live in Hanoi?". Làm sao nhớ nhanh ạ?', FALSE, 'seed-ai-req-0011', DATE_SUB('2026-10-20 08:01:00', INTERVAL 6 DAY)),
    (22, 11, 'AI', 'Quy tắc vàng cực dễ nhớ: nếu câu có **động từ hành động thường** (*live, work, study, eat*) ở thì hiện tại đơn thì dùng **Do/Does** để hỏi. Chỉ dùng **Am/Is/Are** khi theo sau là **danh từ, tính từ hoặc địa điểm** (*Are you a student? Is she busy?*).', FALSE, 'seed-ai-req-0011', DATE_SUB('2026-10-20 08:02:00', INTERVAL 6 DAY)),
    (23, 12, 'USER', 'Mình nên tránh kiểu mở bài nào khi viết SOP xin học bổng thạc sĩ?', FALSE, 'seed-ai-req-0012', DATE_SUB('2026-10-20 08:01:00', INTERVAL 5 DAY)),
    (24, 12, 'AI', 'Hãy tránh mở đầu bằng những câu sáo rỗng như *"Since I was a child, I have always loved..."*. Thay vào đó, mở đầu bằng **một bài toán cụ thể** bạn từng gặp trong nghiên cứu hoặc công việc thực tế, rồi dẫn sang lý do chương trình thạc sĩ này giúp bạn giải quyết nó.', FALSE, 'seed-ai-req-0012', DATE_SUB('2026-10-20 08:02:00', INTERVAL 5 DAY)),
    (25, 13, 'USER', 'Cho mình vài câu giao tiếp ngắn gọn khi cần bắt taxi đến khách sạn từ sân bay nhé.', FALSE, 'seed-ai-req-0013', DATE_SUB('2026-10-20 08:01:00', INTERVAL 4 DAY)),
    (26, 13, 'AI', 'Bạn có thể nói:\n- *"Hi, could you take me to the Marina Bay Hotel, please?"*\n- *"About how long will it take with current traffic?"*\n- *"Do you accept credit cards, or is cash preferred?"*', FALSE, 'seed-ai-req-0013', DATE_SUB('2026-10-20 08:02:00', INTERVAL 4 DAY)),
    (27, 14, 'USER', 'Mình nghe cụm "kind of" và "want to" trong video bản xứ cứ bị dính lại rất khó nhận ra.', FALSE, 'seed-ai-req-0014', DATE_SUB('2026-10-20 08:01:00', INTERVAL 3 DAY)),
    (28, 14, 'AI', 'Đúng rồi! Trong giao tiếp tự nhiên, *kind of* thường giảm âm thành **/ˈkaɪndə/** ("kinda") và *want to* thành **/ˈwɒnə/** ("wanna"). Khi luyện Dictation, hãy chú ý ngữ cảnh ngữ pháp xung quanh để suy ra cụm đầy đủ và nghe lặp lại đoạn đó 3 lần.', FALSE, 'seed-ai-req-0014', DATE_SUB('2026-10-20 08:02:00', INTERVAL 3 DAY)),
    (29, 15, 'USER', 'Mình muốn giải thích ngắn gọn "Idempotency" trong API thanh toán bằng tiếng Anh khi phỏng vấn.', FALSE, 'seed-ai-req-0015', DATE_SUB('2026-10-20 08:01:00', INTERVAL 2 DAY)),
    (30, 15, 'AI', 'Bạn có thể diễn đạt gọn như sau:\n*"Idempotency means that retrying the exact same payment request with the same idempotency key produces the same result without charging the customer twice."*', FALSE, 'seed-ai-req-0015', DATE_SUB('2026-10-20 08:02:00', INTERVAL 2 DAY)),
    (31, 16, 'USER', 'Nên trả lời câu "What is your greatest weakness?" thế nào cho chân thật mà vẫn ghi điểm?', FALSE, 'seed-ai-req-0016', DATE_SUB('2026-10-20 08:01:00', INTERVAL 1 DAY)),
    (32, 16, 'AI', 'Chọn một điểm yếu thật nhưng không chí mạng với vị trí ứng tuyển, rồi nhấn mạnh **hành động cải thiện cụ thể**: *"Earlier in my career, I tended to spend too much time perfecting small details. Now I set clear timeboxes and align on priorities early, which keeps both quality and deadlines on track."*', FALSE, 'seed-ai-req-0016', DATE_SUB('2026-10-20 08:02:00', INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE content = VALUES(content);

    INSERT INTO ai_db.ai_usage_logs (id, user_id, conversation_id, model, outcome, input_tokens, output_tokens, created_at) VALUES
    (1, @seed_u02, 1, 'gemini-2.5-flash', 'SUCCESS', 180, 260, DATE_SUB('2026-10-20 08:02:00', INTERVAL 16 DAY)),
    (2, @seed_u03, 2, 'gemini-2.5-flash', 'SUCCESS', 204, 291, DATE_SUB('2026-10-20 08:02:00', INTERVAL 15 DAY)),
    (3, @seed_u04, 3, 'gemini-2.5-flash', 'SUCCESS', 228, 322, DATE_SUB('2026-10-20 08:02:00', INTERVAL 14 DAY)),
    (4, @seed_u06, 4, 'gemini-2.5-flash', 'SUCCESS', 252, 353, DATE_SUB('2026-10-20 08:02:00', INTERVAL 13 DAY)),
    (5, @seed_u07, 5, 'gemini-2.5-flash', 'SUCCESS', 276, 384, DATE_SUB('2026-10-20 08:02:00', INTERVAL 12 DAY)),
    (6, @seed_u08, 6, 'gemini-2.5-flash', 'SUCCESS', 300, 415, DATE_SUB('2026-10-20 08:02:00', INTERVAL 11 DAY)),
    (7, @seed_u09, 7, 'gemini-2.5-flash', 'SUCCESS', 324, 446, DATE_SUB('2026-10-20 08:02:00', INTERVAL 10 DAY)),
    (8, @seed_u10, 8, 'gemini-2.5-flash', 'SUCCESS', 348, 477, DATE_SUB('2026-10-20 08:02:00', INTERVAL 9 DAY)),
    (9, @seed_u11, 9, 'gemini-2.5-flash', 'SUCCESS', 372, 508, DATE_SUB('2026-10-20 08:02:00', INTERVAL 8 DAY)),
    (10, @seed_u12, 10, 'gemini-2.5-flash', 'SUCCESS', 396, 539, DATE_SUB('2026-10-20 08:02:00', INTERVAL 7 DAY)),
    (11, @seed_u13, 11, 'gemini-2.5-flash', 'SUCCESS', 420, 570, DATE_SUB('2026-10-20 08:02:00', INTERVAL 6 DAY)),
    (12, @seed_u14, 12, 'gemini-2.5-flash', 'SUCCESS', 444, 601, DATE_SUB('2026-10-20 08:02:00', INTERVAL 5 DAY)),
    (13, @seed_u15, 13, 'gemini-2.5-flash', 'SUCCESS', 468, 632, DATE_SUB('2026-10-20 08:02:00', INTERVAL 4 DAY)),
    (14, @seed_u16, 14, 'gemini-2.5-flash', 'SUCCESS', 492, 663, DATE_SUB('2026-10-20 08:02:00', INTERVAL 3 DAY)),
    (15, @seed_u17, 15, 'gemini-2.5-flash', 'SUCCESS', 516, 694, DATE_SUB('2026-10-20 08:02:00', INTERVAL 2 DAY)),
    (16, @seed_u18, 16, 'gemini-2.5-flash', 'SUCCESS', 540, 725, DATE_SUB('2026-10-20 08:02:00', INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE input_tokens = VALUES(input_tokens), output_tokens = VALUES(output_tokens);

    INSERT INTO ai_db.ai_daily_usage (user_id, usage_date, request_count) VALUES
    (@seed_u02, '2026-10-04', 1),
    (@seed_u03, '2026-10-05', 2),
    (@seed_u04, '2026-10-06', 3),
    (@seed_u06, '2026-10-07', 4),
    (@seed_u07, '2026-10-08', 1),
    (@seed_u08, '2026-10-09', 2),
    (@seed_u09, '2026-10-10', 3),
    (@seed_u10, '2026-10-11', 4),
    (@seed_u11, '2026-10-12', 1),
    (@seed_u12, '2026-10-13', 2),
    (@seed_u13, '2026-10-14', 3),
    (@seed_u14, '2026-10-15', 4),
    (@seed_u15, '2026-10-16', 1),
    (@seed_u16, '2026-10-17', 2),
    (@seed_u17, '2026-10-18', 3),
    (@seed_u18, '2026-10-19', 4)
    ON DUPLICATE KEY UPDATE request_count = VALUES(request_count);

    COMMIT;
END$$
DELIMITER ;
CALL seed_chitchatgo_data();
DROP PROCEDURE seed_chitchatgo_data;

SELECT id, email, status FROM auth_db.users
WHERE email IN ('admin@gmail.com', 'user@gmail.com') ORDER BY email;
SELECT id, title, level, status, price, avg_rating, review_count FROM course_db.courses ORDER BY id;
