ALTER TABLE dictation_attempts ADD COLUMN scoring_mode VARCHAR(6) NOT NULL DEFAULT 'LIVE';
UPDATE dictation_attempts SET scoring_mode='LEGACY' WHERE completed_at IS NOT NULL;

-- NULL identifies pre-live responses whose current unassisted matches seed the ledger.
ALTER TABLE dictation_responses ADD COLUMN earned_indices MEDIUMTEXT NULL;
