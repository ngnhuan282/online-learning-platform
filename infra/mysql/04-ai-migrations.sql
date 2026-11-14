-- AI owns its schema; Flyway needs DDL privileges in ai_db only.
-- Existing volumes: apply this file once as a database administrator, then restart AI.
GRANT CREATE, ALTER, INDEX, REFERENCES ON ai_db.* TO 'ai_app'@'%';
