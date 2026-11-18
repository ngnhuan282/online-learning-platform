CREATE TABLE dictation_audio (
    audio_key VARCHAR(80) PRIMARY KEY,
    original_name VARCHAR(180) NOT NULL,
    duration_seconds DOUBLE NOT NULL
);

CREATE TABLE dictation_exercises (
    id VARCHAR(36) PRIMARY KEY,
    current_version INT NOT NULL,
    published_version INT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP(6) NOT NULL
);

CREATE TABLE dictation_revisions (
    exercise_id VARCHAR(36) NOT NULL,
    version INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    topic VARCHAR(60) NOT NULL,
    level VARCHAR(2) NOT NULL,
    duration_seconds DOUBLE NOT NULL,
    definition MEDIUMTEXT NOT NULL,
    PRIMARY KEY (exercise_id, version),
    CONSTRAINT fk_dictation_revision_exercise FOREIGN KEY (exercise_id) REFERENCES dictation_exercises(id)
);

CREATE TABLE dictation_attempts (
    id VARCHAR(36) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    exercise_id VARCHAR(36) NOT NULL,
    version INT NOT NULL,
    current_index INT NOT NULL DEFAULT 0,
    request_id VARCHAR(80) NOT NULL,
    started_at TIMESTAMP(6) NOT NULL,
    completed_at TIMESTAMP(6) NULL,
    CONSTRAINT uk_dictation_start_request UNIQUE (user_id, request_id),
    CONSTRAINT fk_dictation_attempt_revision FOREIGN KEY (exercise_id, version) REFERENCES dictation_revisions(exercise_id, version),
    INDEX ix_dictation_user_history (user_id, started_at),
    INDEX ix_dictation_user_exercise (user_id, exercise_id, started_at)
);

CREATE TABLE dictation_responses (
    attempt_id VARCHAR(36) NOT NULL,
    sentence_index INT NOT NULL,
    answer_text TEXT NOT NULL,
    revealed BOOLEAN NOT NULL DEFAULT FALSE,
    skipped BOOLEAN NOT NULL DEFAULT FALSE,
    first_grade MEDIUMTEXT NULL,
    latest_grade MEDIUMTEXT NULL,
    PRIMARY KEY (attempt_id, sentence_index),
    CONSTRAINT fk_dictation_response_attempt FOREIGN KEY (attempt_id) REFERENCES dictation_attempts(id)
);

INSERT INTO dictation_audio (audio_key, original_name, duration_seconds)
VALUES ('sample-ets-2024-test-1', 'Audio 1.mp3', 31.479);

INSERT INTO dictation_exercises (id, current_version, published_version, archived, updated_at)
VALUES ('ets-2024-company-picnic', 1, 1, FALSE, CURRENT_TIMESTAMP);

INSERT INTO dictation_revisions (exercise_id, version, title, topic, level, duration_seconds, definition)
VALUES ('ets-2024-company-picnic', 1, 'The company picnic', 'Workplace', 'B1', 31.479,
'{"title":"The company picnic","description":"ETS 2024 · Test 1 · Part 3 · Questions 32–34","topic":"Workplace","level":"B1","audioKey":"sample-ets-2024-test-1","sentences":[
{"text":"Thank you so much for organizing the annual company picnic, Jingdao.","start":0,"end":4.55},
{"text":"Everybody seemed to enjoy it.","start":4.55,"end":6.6},
{"text":"Well, we deserved it after working so hard this year.","start":6.65,"end":10.1},
{"text":"I agree.","start":10.15,"end":11.1},
{"text":"The food was great, by the way.","start":11.45,"end":13.45},
{"text":"Especially the peach pie you made.","start":13.5,"end":15.85},
{"text":"Would you mind sharing the recipe?","start":15.9,"end":17.75},
{"text":"It was delicious.","start":17.8,"end":18.9},
{"text":"I found the recipe online.","start":19.2,"end":21.05},
{"text":"I''ll send you a link to the Web page.","start":21.1,"end":23.65},
{"text":"There''s a really helpful video that walks you through all the steps.","start":23.7,"end":27.55},
{"text":"I recommend you watch it first.","start":27.55,"end":29.7},
{"text":"All right, thanks.","start":29.9,"end":31.4}
]}');
