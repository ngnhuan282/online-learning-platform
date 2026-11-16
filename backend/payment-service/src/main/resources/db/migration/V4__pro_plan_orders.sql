CREATE TABLE pro_plans (
    code VARCHAR(32) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    duration_months INT NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_pro_plan_months CHECK (duration_months IN (1, 3, 12)),
    CONSTRAINT chk_pro_plan_price CHECK (price > 0),
    CONSTRAINT chk_pro_plan_identity CHECK (
        (code = 'PRO_MONTH' AND duration_months = 1) OR
        (code = 'PRO_QUARTER' AND duration_months = 3) OR
        (code = 'PRO_YEAR' AND duration_months = 12)
    )
);
INSERT INTO pro_plans (code, name, duration_months, price) VALUES
    ('PRO_MONTH', 'ChitChatGo Pro · 1 tháng', 1, 50000),
    ('PRO_QUARTER', 'ChitChatGo Pro · 3 tháng', 3, 120000),
    ('PRO_YEAR', 'ChitChatGo Pro · 1 năm', 12, 499000);

ALTER TABLE orders ADD COLUMN product_type VARCHAR(16) NOT NULL DEFAULT 'COURSE';
ALTER TABLE orders ADD COLUMN plan_code VARCHAR(32) NULL;
ALTER TABLE orders ADD COLUMN plan_duration_months INT NULL;
ALTER TABLE order_items MODIFY COLUMN course_id BIGINT NULL;
