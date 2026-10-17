ALTER TABLE payments ADD COLUMN enrollment_activated_at TIMESTAMP(6) NULL;
CREATE INDEX idx_payments_activation ON payments(provider, status, enrollment_activated_at);
