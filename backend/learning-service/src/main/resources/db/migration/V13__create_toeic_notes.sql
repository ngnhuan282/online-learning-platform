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
