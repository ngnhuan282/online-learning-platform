ALTER TABLE toeic_exams ADD COLUMN section VARCHAR(16) NOT NULL DEFAULT 'READING';

ALTER TABLE toeic_attempts DROP ${notificationCheckKeyword} chk_toeic_attempt_part;

ALTER TABLE toeic_attempts ADD CONSTRAINT chk_toeic_attempt_part CHECK (part IS NULL OR part BETWEEN 1 AND 7);
