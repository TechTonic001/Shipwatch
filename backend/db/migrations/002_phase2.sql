CREATE OR REPLACE FUNCTION deployment_rank(state TEXT)
RETURNS INT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE state
    WHEN 'pending' THEN 0
    WHEN 'queued' THEN 1
    WHEN 'in_progress' THEN 2
    WHEN 'success' THEN 3
    WHEN 'failure' THEN 3
    WHEN 'error' THEN 3
    WHEN 'inactive' THEN 4
    ELSE 0
  END;
$$;

-- This composite index keeps stale-lock scans bounded to the rows most likely to be re-claimed.
-- It is intentionally narrow: the queue is ordered by status, lock age, and retry schedule.
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_claim_scan
  ON webhook_deliveries (status, locked_at, next_attempt_at, received_at);
