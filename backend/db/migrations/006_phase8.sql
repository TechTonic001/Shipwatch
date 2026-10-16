ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS lock_lost_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS operator_alert_state (
  alert_key TEXT PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT false,
  generation INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operator_alert_events (
  id UUID PRIMARY KEY,
  alert_key TEXT NOT NULL REFERENCES operator_alert_state(alert_key),
  generation INTEGER NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('firing', 'recovery')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (alert_key, generation, event_kind)
);

CREATE INDEX IF NOT EXISTS idx_operator_alert_events_due
  ON operator_alert_events (status, next_attempt_at, created_at);
