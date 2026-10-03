CREATE TABLE sections (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    course_id   BIGINT NOT NULL,
    title       VARCHAR(255) NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP(6) NOT NULL,
    updated_at  TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_sections_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX idx_sections_course ON sections(course_id);

CREATE TABLE lessons (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    section_id  BIGINT NOT NULL,
    title       VARCHAR(255) NOT NULL,
    lesson_type VARCHAR(20) NOT NULL,
    content     TEXT NULL,
    video_url   VARCHAR(500) NULL,
    duration    INT NULL,
    order_index INT NOT NULL DEFAULT 0,
    is_preview  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP(6) NOT NULL,
    updated_at  TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_lessons_section FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE INDEX idx_lessons_section ON lessons(section_id);
