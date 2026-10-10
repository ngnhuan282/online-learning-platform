ALTER TABLE orders
    ADD COLUMN idempotency_key VARCHAR(64) NULL AFTER user_id;

CREATE UNIQUE INDEX uk_orders_user_idempotency
    ON orders (user_id, idempotency_key);
