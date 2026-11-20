ALTER TABLE dictation_revisions ADD COLUMN toeic_test INT NULL;

UPDATE dictation_revisions
SET toeic_test = 1
WHERE exercise_id = 'ets-2024-company-picnic';
