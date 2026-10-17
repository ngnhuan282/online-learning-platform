ALTER TABLE enrollments
    ADD COLUMN source_order_code VARCHAR(40) NULL AFTER course_id;

CREATE UNIQUE INDEX uk_enrollments_source_order
    ON enrollments (source_order_code);
