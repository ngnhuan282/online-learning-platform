CREATE TABLE gem_topup_receipts (
    order_code VARCHAR(64) NOT NULL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    gems INT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT chk_gem_topup_positive CHECK (gems > 0)
);

CREATE INDEX idx_gem_topup_user ON gem_topup_receipts (user_id);
