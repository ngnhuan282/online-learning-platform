-- Payment owns its schema; Flyway needs DDL privileges in payment_db only.
-- Existing volumes: apply this file once as a database administrator, then restart Payment.
GRANT CREATE, ALTER, INDEX, REFERENCES ON payment_db.* TO 'payment_app'@'%';
