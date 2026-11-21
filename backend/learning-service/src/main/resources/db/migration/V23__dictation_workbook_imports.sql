CREATE TABLE dictation_workbook_imports (
    content_sha256 CHAR(64) PRIMARY KEY,
    exercise_id VARCHAR(36) NOT NULL,
    CONSTRAINT fk_dictation_workbook_exercise
        FOREIGN KEY (exercise_id) REFERENCES dictation_exercises(id) ON DELETE CASCADE
);
