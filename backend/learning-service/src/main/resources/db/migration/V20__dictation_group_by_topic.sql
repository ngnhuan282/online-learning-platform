UPDATE dictation_revisions
SET topic = CONCAT('Test ', toeic_test)
WHERE toeic_test IS NOT NULL;
