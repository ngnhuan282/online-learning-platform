-- Auth owns its schema; Flyway needs DDL privileges in auth_db only.
-- Existing volumes: apply this file once as a database administrator, then restart Auth.
GRANT CREATE, ALTER, INDEX, REFERENCES ON auth_db.* TO 'auth_app'@'%';
