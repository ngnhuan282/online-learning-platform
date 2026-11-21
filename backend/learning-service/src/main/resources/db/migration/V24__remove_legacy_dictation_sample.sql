-- Remove the two bundled starter exercises and only their learner attempts.
DELETE FROM dictation_responses
WHERE attempt_id IN (
    SELECT id FROM dictation_attempts WHERE exercise_id IN ('ets-2024-company-picnic', 'what-day-is-it-today')
);

DELETE FROM dictation_attempts WHERE exercise_id IN ('ets-2024-company-picnic', 'what-day-is-it-today');
DELETE FROM dictation_revisions WHERE exercise_id IN ('ets-2024-company-picnic', 'what-day-is-it-today');
DELETE FROM dictation_exercises WHERE id IN ('ets-2024-company-picnic', 'what-day-is-it-today');

DELETE FROM dictation_audio
WHERE audio_key = 'sample-ets-2024-test-1'
  AND NOT EXISTS (
      SELECT 1 FROM dictation_revisions
      WHERE LOCATE('"sample-ets-2024-test-1"', definition) > 0
  );
