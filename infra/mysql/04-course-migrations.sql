-- Course owns its schema; Flyway needs DDL privileges in course_db only.
-- Existing volumes: apply as a database administrator before starting Course.
GRANT CREATE, ALTER, INDEX, REFERENCES ON course_db.* TO 'course_app'@'%';
