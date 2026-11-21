-- Use the published demo if an admin has already imported this lesson.
INSERT INTO dictation_exercises (id, current_version, published_version, archived, updated_at)
SELECT 'what-day-is-it-today', 1, 1, FALSE, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1
    FROM dictation_exercises e
    LEFT JOIN dictation_revisions r ON r.exercise_id = e.id AND r.version = e.published_version
    WHERE e.id IN ('what-day-is-it-today', 'local-video-what-day-is-it-today')
       OR (LOWER(r.title) = 'what day is it today?'
           AND LOCATE('"https://www.youtube.com/watch?v=_R7nrvhNmrI"', r.definition) > 0)
);

INSERT INTO dictation_revisions (exercise_id, version, title, topic, level, duration_seconds, definition)
SELECT e.id, 1, 'What day is it today?', 'Daily English Conversation', 'A1', 92.0,
'{"title":"What day is it today?","description":"","topic":"Daily English Conversation","level":"A1","audioKey":null,
"sentences":[
{"text":"Can you play baseball this afternoon?","start":7.0,"end":10.0},
{"text":"What day is it today?","start":12.0,"end":14.0},
{"text":"It''s Wednesday.","start":15.0,"end":18.0},
{"text":"Sorry, I can''t.","start":19.0,"end":21.0},
{"text":"I have a piano lesson.","start":21.0,"end":24.0},
{"text":"Let''s play on Friday.","start":27.0,"end":30.0},
{"text":"Sounds good.","start":30.0,"end":34.0}
],"video":{"url":"https://www.youtube.com/watch?v=_R7nrvhNmrI","duration":92.0}}'
FROM dictation_exercises e
WHERE e.id = 'what-day-is-it-today' AND e.current_version = 1 AND e.published_version = 1
  AND NOT EXISTS (
      SELECT 1 FROM dictation_revisions r WHERE r.exercise_id = e.id AND r.version = 1
  );

-- Retire the original example where it has no edits or learners.
UPDATE dictation_exercises
SET archived = TRUE, updated_at = CURRENT_TIMESTAMP
WHERE id = 'ets-2024-company-picnic' AND current_version = 1 AND published_version = 1 AND archived = FALSE
  AND NOT EXISTS (
      SELECT 1 FROM dictation_attempts a WHERE a.exercise_id = dictation_exercises.id
  );
