-- Consolidated initial schema for payment-service (merged from V1..V7).

CREATE TABLE pro_plans (
    code VARCHAR(32) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    duration_months INT NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP(6) NULL,
    CONSTRAINT chk_pro_plan_months CHECK (duration_months IN (1, 3, 12)),
    CONSTRAINT chk_pro_plan_price CHECK (price > 0)
);

INSERT INTO pro_plans (code, name, duration_months, price) VALUES
    ('PRO_MONTH', 'ChitChatGo Pro · 1 tháng', 1, 50000),
    ('PRO_QUARTER', 'ChitChatGo Pro · 3 tháng', 3, 120000),
    ('PRO_YEAR', 'ChitChatGo Pro · 1 năm', 12, 499000);

CREATE TABLE orders (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_code VARCHAR(40) NOT NULL,
    user_id BIGINT NOT NULL,
    idempotency_key VARCHAR(64) NULL,
    product_type VARCHAR(16) NOT NULL DEFAULT 'COURSE',
    plan_code VARCHAR(32) NULL,
    plan_duration_months INT NULL,
    gem_package_code VARCHAR(32) NULL,
    gem_amount INT NULL,
    status VARCHAR(30) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    expires_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_orders_order_code UNIQUE (order_code)
);

CREATE UNIQUE INDEX uk_orders_user_idempotency ON orders (user_id, idempotency_key);
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at);
CREATE INDEX idx_orders_status_created ON orders (status, created_at);

CREATE TABLE order_items (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    course_id BIGINT NULL,
    course_title VARCHAR(255) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    final_price DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id)
);

CREATE INDEX idx_order_items_course ON order_items (course_id);

CREATE TABLE payments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    checkout_url VARCHAR(1024) NULL,
    provider_transaction_code VARCHAR(100) NULL,
    failure_code VARCHAR(100) NULL,
    failure_message VARCHAR(500) NULL,
    paid_at TIMESTAMP(6) NULL,
    enrollment_activated_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id)
);

CREATE INDEX idx_payments_order_created ON payments (order_id, created_at);
CREATE INDEX idx_payments_status_created ON payments (status, created_at);
CREATE INDEX idx_payments_provider_transaction ON payments (provider, provider_transaction_code);
CREATE INDEX idx_payments_activation ON payments (provider, status, enrollment_activated_at);

CREATE TABLE payment_transactions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    payment_id BIGINT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    provider_transaction_code VARCHAR(100) NULL,
    payload_checksum VARCHAR(128) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_payment_transactions_payment FOREIGN KEY (payment_id) REFERENCES payments (id)
);

CREATE INDEX idx_payment_transactions_payment_created ON payment_transactions (payment_id, created_at);
CREATE INDEX idx_payment_transactions_provider_code ON payment_transactions (provider, provider_transaction_code);

CREATE TABLE payment_admin_audit (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    actor_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL
);
