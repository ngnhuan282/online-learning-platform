CREATE TABLE lesson_resources (
    id            BIGINT NOT NULL AUTO_INCREMENT,
    lesson_id     BIGINT NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    title         VARCHAR(255) NOT NULL,
    file_name     VARCHAR(255) NOT NULL,
    file_size     BIGINT NOT NULL DEFAULT 0,
    content_type  VARCHAR(100),
    object_key    VARCHAR(500) NOT NULL,
    download_url  VARCHAR(1000),
    created_at    TIMESTAMP(6) NOT NULL,
    updated_at    TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_resources_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
    INDEX idx_resources_lesson_id (lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
