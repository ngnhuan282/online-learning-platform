CREATE TABLE ai_conversations (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(100) NOT NULL,
    course_id BIGINT NULL,
    lesson_id BIGINT NULL,
    context_title VARCHAR(255) NULL,
    active_request_id VARCHAR(64) NULL,
    active_until DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    INDEX idx_ai_conversations_user_updated (user_id, updated_at, id)
);

CREATE TABLE ai_messages (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    sender VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    request_id VARCHAR(64) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_ai_message_conversation FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id),
    CONSTRAINT uq_ai_message_request_sender UNIQUE (conversation_id, request_id, sender),
    INDEX idx_ai_messages_conversation_id (conversation_id, id)
);

CREATE TABLE ai_usage_logs (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    model VARCHAR(100) NOT NULL,
    outcome VARCHAR(40) NOT NULL,
    input_tokens INT NOT NULL,
    output_tokens INT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    INDEX idx_ai_usage_user_created (user_id, created_at)
);
