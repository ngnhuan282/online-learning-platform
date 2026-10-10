-- V4: Review/Rating System
CREATE TABLE reviews (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  course_id    BIGINT       NOT NULL,
  user_id      BIGINT       NOT NULL,
  rating       INT          NOT NULL,
  comment      TEXT,
  is_hidden    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   DATETIME(6)  NOT NULL,
  updated_at   DATETIME(6),
  CONSTRAINT fk_review_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT uq_review_user_course UNIQUE (course_id, user_id)
);

ALTER TABLE courses ADD COLUMN avg_rating DOUBLE NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN review_count INT NOT NULL DEFAULT 0;
