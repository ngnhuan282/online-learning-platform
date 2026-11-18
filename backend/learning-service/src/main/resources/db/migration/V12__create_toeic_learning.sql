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
    CONSTRAINT chk_toeic_attempt_part CHECK (part IS NULL OR part IN (5, 6, 7)),
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
