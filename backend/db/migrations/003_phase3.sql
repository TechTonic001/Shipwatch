-- pgm: no-transaction
-- PostgreSQL does not allow ALTER TYPE ... ADD VALUE inside a transaction
-- on versions/configurations supported by this project. This migration is
-- intentionally non-transactional so node-pg-migrate can apply the enum change.
ALTER TYPE alert_status ADD VALUE IF NOT EXISTS 'dead';

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_alerts_claim
  ON alerts (status, locked_at, next_attempt_at, created_at);
