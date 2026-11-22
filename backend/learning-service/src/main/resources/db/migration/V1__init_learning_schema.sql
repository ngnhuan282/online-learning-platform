-- Consolidated initial schema for learning-service (merged from V1..V27).

CREATE TABLE enrollments (
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
    CONSTRAINT chk_enrollments_status CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED'))
);

CREATE UNIQUE INDEX uk_enrollments_source_order ON enrollments (source_order_code);
CREATE INDEX idx_enrollments_user_status ON enrollments (user_id, status);
CREATE INDEX idx_enrollments_course ON enrollments (course_id);

CREATE TABLE payment_enrollment_receipts (
    order_code VARCHAR(40) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lesson_progress (
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
    CONSTRAINT chk_lesson_progress_percent CHECK (progress_percent BETWEEN 0 AND 100)
);

CREATE INDEX idx_lesson_progress_user_course ON lesson_progress (user_id, course_id);

CREATE TABLE quizzes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    course_id BIGINT NOT NULL,
    lesson_id BIGINT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(1000) NULL,
    passing_score INT NOT NULL DEFAULT 70,
    time_limit_minutes INT NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_quizzes_passing_score CHECK (passing_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_quizzes_course_published ON quizzes (course_id, published);

CREATE TABLE quiz_questions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    quiz_id BIGINT NOT NULL,
    question_text VARCHAR(1000) NOT NULL,
    question_type VARCHAR(32) NOT NULL,
    points INT NOT NULL DEFAULT 1,
    position INT NOT NULL,
    CONSTRAINT fk_quiz_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id),
    CONSTRAINT chk_quiz_questions_type CHECK (question_type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TEXT')),
    CONSTRAINT chk_quiz_questions_points CHECK (points > 0)
);

CREATE INDEX idx_quiz_questions_quiz_position ON quiz_questions (quiz_id, position);

CREATE TABLE quiz_options (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    question_id BIGINT NOT NULL,
    option_text VARCHAR(1000) NOT NULL,
    correct BOOLEAN NOT NULL DEFAULT FALSE,
    position INT NOT NULL,
    CONSTRAINT fk_quiz_options_question FOREIGN KEY (question_id) REFERENCES quiz_questions (id)
);

CREATE INDEX idx_quiz_options_question_position ON quiz_options (question_id, position);

CREATE TABLE quiz_attempts (
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
    CONSTRAINT chk_quiz_attempts_score CHECK (score IS NULL OR score BETWEEN 0 AND 100)
);

CREATE INDEX idx_quiz_attempts_user_quiz ON quiz_attempts (user_id, quiz_id);
CREATE INDEX idx_quiz_attempts_user_course ON quiz_attempts (user_id, course_id);

CREATE TABLE quiz_answers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    attempt_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    selected_option_id BIGINT NULL,
    answer_text VARCHAR(2000) NULL,
    correct BOOLEAN NULL,
    points_awarded INT NULL,
    CONSTRAINT fk_quiz_answers_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts (id),
    CONSTRAINT fk_quiz_answers_question FOREIGN KEY (question_id) REFERENCES quiz_questions (id),
    CONSTRAINT fk_quiz_answers_selected_option FOREIGN KEY (selected_option_id) REFERENCES quiz_options (id)
);

CREATE INDEX idx_quiz_answers_attempt ON quiz_answers (attempt_id);

CREATE TABLE notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body VARCHAR(1000) NOT NULL,
    action_url VARCHAR(500) NULL,
    event_key VARCHAR(200) ${notificationEventKeyCollation} NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_notifications_user_event UNIQUE (user_id, event_key),
    CONSTRAINT chk_notifications_type CHECK (
        type IN (
            'ENROLLMENT', 'PROGRESS', 'QUIZ', 'SYSTEM', 'COURSE_ENROLLED',
            'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED', 'PAYMENT_REFUNDED',
            'LESSON_COMPLETED', 'QUIZ_RESULT_AVAILABLE'
        )
    )
);

CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at);
CREATE INDEX idx_notifications_user_read ON notifications (user_id, read_at);

CREATE TABLE learner_profiles (
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
);

CREATE TABLE learning_xp_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    source_type VARCHAR(16) NOT NULL,
    source_id BIGINT NOT NULL,
    xp INT NOT NULL,
    earned_at TIMESTAMP NOT NULL,
    CONSTRAINT uk_learning_xp_source UNIQUE (user_id, source_type, source_id),
    CONSTRAINT fk_learning_xp_profile FOREIGN KEY (user_id) REFERENCES learner_profiles (user_id),
    CONSTRAINT chk_learning_xp CHECK (xp > 0)
);

CREATE INDEX idx_learning_xp_period ON learning_xp_events (earned_at, user_id);

CREATE TABLE learning_activity_days (
    user_id BIGINT NOT NULL,
    activity_date DATE NOT NULL,
    activity_count INT NOT NULL DEFAULT 1,
    gems_awarded INT NULL,
    PRIMARY KEY (user_id, activity_date),
    CONSTRAINT fk_learning_activity_profile FOREIGN KEY (user_id) REFERENCES learner_profiles (user_id)
);

CREATE INDEX idx_learning_activity_report ON learning_activity_days (activity_date);

CREATE TABLE learner_rewards (
    user_id BIGINT NOT NULL,
    reward_code VARCHAR(32) NOT NULL,
    gems INT NOT NULL,
    claimed_at TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, reward_code),
    CONSTRAINT fk_learner_reward_profile FOREIGN KEY (user_id) REFERENCES learner_profiles (user_id)
);

CREATE INDEX idx_learner_rewards_report ON learner_rewards (claimed_at);

CREATE TABLE community_topics (
    id BIGINT PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    position INT NOT NULL
);

INSERT INTO community_topics (id, code, position) VALUES
    (1, 'learning', 1),
    (2, 'ielts-toeic', 2),
    (3, 'questions', 3),
    (4, 'sharing', 4);

CREATE TABLE community_posts (
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
    CONSTRAINT chk_community_post_kind CHECK (kind IN ('DISCUSSION', 'QUESTION'))
);

CREATE INDEX idx_community_posts_feed ON community_posts (deleted_at, topic_id, created_at, id);
CREATE INDEX idx_community_posts_author ON community_posts (author_id, created_at);

CREATE TABLE community_comments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    body VARCHAR(4000) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP NULL,
    CONSTRAINT fk_community_comment_post FOREIGN KEY (post_id) REFERENCES community_posts (id),
    CONSTRAINT fk_community_comment_author FOREIGN KEY (author_id) REFERENCES learner_profiles (user_id)
);

CREATE INDEX idx_community_comments_post ON community_comments (post_id, deleted_at, created_at, id);
CREATE INDEX idx_community_comments_author ON community_comments (author_id, created_at);

CREATE TABLE shop_items (
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
);

INSERT INTO shop_items (code, name_key, item_type, rarity, price, original_price, asset_key, position) VALUES
    ('STREAK_FREEZE', 'Streak freeze', 'FREEZE', 'RARE', 25, NULL, 'freeze', 0),
    ('BACKGROUND_SKY', 'Bầu trời khởi đầu', 'BACKGROUND', 'RARE', 0, 50, 'sky', 1),
    ('BACKGROUND_CAMPUS', 'Hẹn gặp ở giảng đường', 'BACKGROUND', 'EPIC', 100, NULL, 'campus-sunrise', 2),
    ('BACKGROUND_LIBRARY', 'Thư viện ánh trăng', 'BACKGROUND', 'EPIC', 120, NULL, 'moonlit-library', 3),
    ('FRAME_CLASSIC', 'Vòng sáng khởi đầu', 'FRAME', 'RARE', 0, 30, 'classic', 4),
    ('FRAME_KITTY', 'Mèo nhỏ chăm học', 'FRAME', 'EPIC', 150, NULL, 'kitty-scholar', 5),
    ('FRAME_KOALA', 'Koala vườn xanh', 'FRAME', 'EPIC', 180, NULL, 'koala-garden', 6),
    ('FRAME_OWL', 'Cú mèo phù thủy', 'FRAME', 'EPIC', 250, NULL, 'owl-wizard', 7),
    ('FRAME_BUNNY', 'Thỏ hoa anh đào', 'FRAME', 'EPIC', 180, NULL, 'bunny-bloom', 8);

CREATE TABLE shop_inventory (
    user_id BIGINT NOT NULL,
    item_code VARCHAR(32) NOT NULL,
    acquired_at TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, item_code),
    CONSTRAINT fk_inventory_profile FOREIGN KEY (user_id) REFERENCES learner_profiles (user_id),
    CONSTRAINT fk_inventory_item FOREIGN KEY (item_code) REFERENCES shop_items (code)
);

CREATE TABLE shop_purchases (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    request_id VARCHAR(64) NOT NULL,
    item_code VARCHAR(32) NOT NULL,
    gems_spent INT NOT NULL,
    item_granted BOOLEAN NULL,
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT uk_shop_purchase_request UNIQUE (user_id, request_id),
    CONSTRAINT fk_purchase_profile FOREIGN KEY (user_id) REFERENCES learner_profiles (user_id),
    CONSTRAINT fk_purchase_item FOREIGN KEY (item_code) REFERENCES shop_items (code)
);

CREATE INDEX idx_shop_purchases_report ON shop_purchases (created_at);

CREATE TABLE learning_frozen_days (
    user_id BIGINT NOT NULL,
    frozen_date DATE NOT NULL,
    used_at TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, frozen_date),
    CONSTRAINT fk_frozen_day_profile FOREIGN KEY (user_id) REFERENCES learner_profiles (user_id)
);

CREATE INDEX idx_frozen_days_report ON learning_frozen_days (used_at);

CREATE TABLE pro_memberships (
    user_id BIGINT PRIMARY KEY,
    expires_at TIMESTAMP(6) NULL,
    plan_code VARCHAR(32) NULL,
    suspended BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0
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
    actor_id BIGINT NULL,
    admin_reason VARCHAR(400) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_pro_grant_membership FOREIGN KEY (user_id) REFERENCES pro_memberships (user_id),
    CONSTRAINT chk_pro_grant_months CHECK (duration_months IN (1, 3, 12))
);

CREATE INDEX idx_pro_grants_user ON pro_grants (user_id, granted_at, id);
CREATE INDEX idx_pro_grants_report ON pro_grants (granted_at);
CREATE INDEX idx_pro_revocations_report ON pro_grants (revoked_at);

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
    revoked_at TIMESTAMP(6) NULL,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_pro_codes_report ON pro_activation_codes (created_at);
CREATE INDEX idx_pro_codes_redeemed_report ON pro_activation_codes (redeemed_at);

CREATE TABLE pro_activation_attempts (
    user_id BIGINT PRIMARY KEY,
    window_start TIMESTAMP(6) NOT NULL,
    attempts INT NOT NULL DEFAULT 0
);

CREATE TABLE engagement_settings (
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
);

INSERT INTO engagement_settings (id, lesson_xp, quiz_xp, daily_gems, xp_per_level) VALUES
    (1, 20, 10, 25, 100);

CREATE TABLE engagement_reward_rules (
    code VARCHAR(32) PRIMARY KEY,
    label VARCHAR(120) NOT NULL DEFAULT '',
    metric VARCHAR(20) NOT NULL DEFAULT 'STREAK',
    threshold INT NOT NULL DEFAULT 1,
    gems INT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP(6) NULL,
    CONSTRAINT chk_reward_rule_gems CHECK (gems BETWEEN 0 AND 1000000)
);

INSERT INTO engagement_reward_rules (code, label, metric, threshold, gems) VALUES
    ('FIRST_LESSON', 'Bài học đầu tiên', 'FIRST_LESSON', 1, 20),
    ('STREAK_3', 'Chuỗi 3 ngày', 'STREAK', 3, 30),
    ('STREAK_7', 'Chuỗi 7 ngày', 'STREAK', 7, 70),
    ('STREAK_30', 'Chuỗi 30 ngày', 'STREAK', 30, 300),
    ('LEVEL_5', 'Đạt cấp độ 5', 'LEVEL', 5, 100);

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
    CONSTRAINT fk_admin_adjustment_profile FOREIGN KEY (user_id) REFERENCES learner_profiles (user_id)
);

CREATE INDEX idx_admin_adjustment_user ON learner_admin_adjustments (user_id, created_at);
CREATE INDEX idx_learner_adjustments_report ON learner_admin_adjustments (created_at);

CREATE TABLE learning_admin_actor_locks (
    actor_id BIGINT PRIMARY KEY
);

CREATE TABLE learning_admin_audit (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    actor_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL
);

CREATE INDEX idx_learning_admin_audit_created ON learning_admin_audit (created_at);

CREATE TABLE gem_topup_receipts (
    order_code VARCHAR(64) NOT NULL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    gems INT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT chk_gem_topup_positive CHECK (gems > 0)
);

CREATE INDEX idx_gem_topup_user ON gem_topup_receipts (user_id);
CREATE INDEX idx_gem_topup_report ON gem_topup_receipts (created_at);

CREATE TABLE toeic_exams (
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
    CONSTRAINT chk_toeic_duration CHECK (duration_minutes BETWEEN 1 AND 180)
);

CREATE INDEX idx_toeic_exams_catalog ON toeic_exams (deleted, published, id);

CREATE TABLE toeic_attempts (
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
    CONSTRAINT chk_toeic_attempt_score CHECK (score IS NULL OR score BETWEEN 0 AND 100)
);

CREATE INDEX idx_toeic_attempt_owner ON toeic_attempts (user_id, exam_id, status, id);

CREATE TABLE toeic_lesson_progress (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    exam_id BIGINT NOT NULL,
    lesson_id VARCHAR(80) NOT NULL,
    exam_version BIGINT NOT NULL,
    completed_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_toeic_progress_exam FOREIGN KEY (exam_id) REFERENCES toeic_exams (id),
    CONSTRAINT uk_toeic_progress_owner UNIQUE (user_id, exam_id, lesson_id, exam_version)
);

CREATE TABLE toeic_notes (
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
    CONSTRAINT chk_toeic_notes_color CHECK (color IN ('yellow', 'blue', 'green', 'pink'))
);

CREATE INDEX idx_toeic_notes_user ON toeic_notes (user_id, created_at, id);

CREATE TABLE toeic_media (
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
    CONSTRAINT chk_toeic_media_size CHECK (size_bytes > 0)
);

CREATE INDEX idx_toeic_media_created ON toeic_media (created_at, id);

CREATE TABLE dictation_audio (
    audio_key VARCHAR(80) PRIMARY KEY,
    original_name VARCHAR(180) NOT NULL,
    duration_seconds DOUBLE NOT NULL
);

CREATE TABLE dictation_exercises (
    id VARCHAR(36) PRIMARY KEY,
    current_version INT NOT NULL,
    published_version INT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP(6) NOT NULL
);

CREATE TABLE dictation_revisions (
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
);

CREATE TABLE dictation_attempts (
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
);

CREATE TABLE dictation_responses (
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
);

CREATE TABLE dictation_workbook_imports (
    content_sha256 CHAR(64) PRIMARY KEY,
    exercise_id VARCHAR(36) NOT NULL,
    CONSTRAINT fk_dictation_workbook_exercise
        FOREIGN KEY (exercise_id) REFERENCES dictation_exercises (id) ON DELETE CASCADE
);

CREATE TABLE dictation_workbook_sync (
    exercise_id VARCHAR(36) PRIMARY KEY,
    version INT NULL,
    pending BOOLEAN NOT NULL,
    CONSTRAINT fk_dictation_workbook_sync_exercise
        FOREIGN KEY (exercise_id) REFERENCES dictation_exercises (id) ON DELETE CASCADE,
    INDEX ix_dictation_workbook_sync_pending (pending, exercise_id)
);

CREATE TABLE dictation_workbook_sources (
    exercise_id VARCHAR(36) NOT NULL,
    storage VARCHAR(16) NOT NULL,
    object_key VARCHAR(512) NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    PRIMARY KEY (exercise_id, storage),
    CONSTRAINT uk_dictation_workbook_source_key UNIQUE (storage, object_key),
    CONSTRAINT fk_dictation_workbook_source_exercise
        FOREIGN KEY (exercise_id) REFERENCES dictation_exercises (id) ON DELETE CASCADE
);
