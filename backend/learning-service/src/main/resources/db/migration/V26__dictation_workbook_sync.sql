CREATE TABLE dictation_workbook_sync (
    exercise_id VARCHAR(36) PRIMARY KEY,
    version INT NULL,
    pending BOOLEAN NOT NULL,
    CONSTRAINT fk_dictation_workbook_sync_exercise
        FOREIGN KEY (exercise_id) REFERENCES dictation_exercises(id) ON DELETE CASCADE,
    INDEX ix_dictation_workbook_sync_pending (pending, exercise_id)
);
