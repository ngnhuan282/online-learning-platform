-- V6: Add performance indexes for common query patterns
-- Note: idx_courses_category already exists as FK constraint index from V1.
-- idx_sections_course and idx_lessons_section also exist from V2 (single column).
-- We add new composite/additional indexes with distinct names.

CREATE INDEX IF NOT EXISTS idx_courses_status          ON courses(status);
CREATE INDEX IF NOT EXISTS idx_sections_course_order   ON sections(course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_lessons_section_order   ON lessons(section_id, order_index);
CREATE INDEX IF NOT EXISTS idx_reviews_course          ON reviews(course_id);
