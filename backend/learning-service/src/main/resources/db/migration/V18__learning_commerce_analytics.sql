ALTER TABLE learning_activity_days ADD COLUMN gems_awarded INT NULL;
ALTER TABLE shop_purchases ADD COLUMN item_granted BOOLEAN NULL;

CREATE INDEX idx_learning_activity_report ON learning_activity_days (activity_date);
CREATE INDEX idx_learner_rewards_report ON learner_rewards (claimed_at);
CREATE INDEX idx_gem_topup_report ON gem_topup_receipts (created_at);
CREATE INDEX idx_learner_adjustments_report ON learner_admin_adjustments (created_at);
CREATE INDEX idx_shop_purchases_report ON shop_purchases (created_at);
CREATE INDEX idx_frozen_days_report ON learning_frozen_days (used_at);
CREATE INDEX idx_pro_grants_report ON pro_grants (granted_at);
CREATE INDEX idx_pro_revocations_report ON pro_grants (revoked_at);
CREATE INDEX idx_pro_codes_report ON pro_activation_codes (created_at);
CREATE INDEX idx_pro_codes_redeemed_report ON pro_activation_codes (redeemed_at);
