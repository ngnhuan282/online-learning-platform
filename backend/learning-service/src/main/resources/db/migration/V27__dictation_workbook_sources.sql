CREATE TABLE dictation_workbook_sources (
    exercise_id VARCHAR(36) NOT NULL,
    storage VARCHAR(16) NOT NULL,
    object_key VARCHAR(512) NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    PRIMARY KEY (exercise_id, storage),
    CONSTRAINT uk_dictation_workbook_source_key UNIQUE (storage, object_key),
    CONSTRAINT fk_dictation_workbook_source_exercise
        FOREIGN KEY (exercise_id) REFERENCES dictation_exercises(id) ON DELETE CASCADE
);
