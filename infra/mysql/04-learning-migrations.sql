-- Learning owns its schema; Flyway needs DDL privileges in learning_db only.
-- Existing volumes: apply this file once as a database administrator, then restart Learning.
GRANT CREATE, ALTER, INDEX, REFERENCES ON learning_db.* TO 'learning_app'@'%';
