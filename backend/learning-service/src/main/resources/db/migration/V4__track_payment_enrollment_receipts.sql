CREATE TABLE payment_enrollment_receipts (
    order_code VARCHAR(40) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Preserve the identity of orders already processed before this migration.
INSERT INTO payment_enrollment_receipts (order_code, user_id, course_id, created_at)
SELECT source_order_code, user_id, course_id, enrolled_at
FROM enrollments
WHERE source_order_code IS NOT NULL;
