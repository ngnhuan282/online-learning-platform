ALTER TABLE pro_plans ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
CREATE TABLE payment_admin_audit (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    actor_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL
);
