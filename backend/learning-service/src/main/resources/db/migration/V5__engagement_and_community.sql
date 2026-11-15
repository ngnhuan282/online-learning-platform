CREATE TABLE learner_profiles (
    user_id BIGINT PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    total_xp BIGINT NOT NULL DEFAULT 0,
    gems INT NOT NULL DEFAULT 0,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    last_activity_date DATE NULL,
    CONSTRAINT chk_learner_points CHECK (total_xp >= 0 AND gems >= 0)
);

CREATE TABLE learning_xp_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    source_type VARCHAR(16) NOT NULL,
    source_id BIGINT NOT NULL,
    xp INT NOT NULL,
    earned_at TIMESTAMP NOT NULL,
    CONSTRAINT uk_learning_xp_source UNIQUE (user_id, source_type, source_id),
    CONSTRAINT fk_learning_xp_profile FOREIGN KEY (user_id) REFERENCES learner_profiles(user_id),
    CONSTRAINT chk_learning_xp CHECK (xp > 0)
);
CREATE INDEX idx_learning_xp_period ON learning_xp_events (earned_at, user_id);

CREATE TABLE learning_activity_days (
    user_id BIGINT NOT NULL,
    activity_date DATE NOT NULL,
    activity_count INT NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, activity_date),
    CONSTRAINT fk_learning_activity_profile FOREIGN KEY (user_id) REFERENCES learner_profiles(user_id)
);

CREATE TABLE learner_rewards (
    user_id BIGINT NOT NULL,
    reward_code VARCHAR(32) NOT NULL,
    gems INT NOT NULL,
    claimed_at TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, reward_code),
    CONSTRAINT fk_learner_reward_profile FOREIGN KEY (user_id) REFERENCES learner_profiles(user_id)
);

CREATE TABLE community_topics (
    id BIGINT PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    position INT NOT NULL
);
INSERT INTO community_topics (id, code, position) VALUES
    (1, 'learning', 1), (2, 'ielts-toeic', 2), (3, 'questions', 3), (4, 'sharing', 4);

CREATE TABLE community_posts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    author_id BIGINT NOT NULL,
    topic_id BIGINT NOT NULL,
    kind VARCHAR(16) NOT NULL,
    title VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_comment_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP NULL,
    CONSTRAINT fk_community_post_author FOREIGN KEY (author_id) REFERENCES learner_profiles(user_id),
    CONSTRAINT fk_community_post_topic FOREIGN KEY (topic_id) REFERENCES community_topics(id),
    CONSTRAINT chk_community_post_kind CHECK (kind IN ('DISCUSSION', 'QUESTION'))
);
CREATE INDEX idx_community_posts_feed ON community_posts (deleted_at, topic_id, created_at, id);
CREATE INDEX idx_community_posts_author ON community_posts (author_id, created_at);

CREATE TABLE community_comments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    body VARCHAR(4000) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP NULL,
    CONSTRAINT fk_community_comment_post FOREIGN KEY (post_id) REFERENCES community_posts(id),
    CONSTRAINT fk_community_comment_author FOREIGN KEY (author_id) REFERENCES learner_profiles(user_id)
);
CREATE INDEX idx_community_comments_post ON community_comments (post_id, deleted_at, created_at, id);
CREATE INDEX idx_community_comments_author ON community_comments (author_id, created_at);
