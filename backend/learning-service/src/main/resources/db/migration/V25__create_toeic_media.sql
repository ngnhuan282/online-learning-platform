CREATE TABLE toeic_media (
    id VARCHAR(36) PRIMARY KEY,
    object_key VARCHAR(48) NOT NULL UNIQUE,
    original_name VARCHAR(180) NOT NULL,
    media_kind VARCHAR(8) NOT NULL,
    content_type VARCHAR(32) NOT NULL,
    size_bytes BIGINT NOT NULL,
    cloud_copy BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT chk_toeic_media_kind CHECK (media_kind IN ('AUDIO', 'IMAGE')),
    CONSTRAINT chk_toeic_media_size CHECK (size_bytes > 0)
);

CREATE INDEX idx_toeic_media_created ON toeic_media (created_at, id);
