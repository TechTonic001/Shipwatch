CREATE TABLE IF NOT EXISTS webhook_deliveries (
  delivery_id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  action TEXT,
  github_repo_id BIGINT,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  attempts INTEGER NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_attempt_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS repositories (
  id BIGINT PRIMARY KEY,
  full_name TEXT NOT NULL,
  production_environment TEXT NOT NULL DEFAULT 'production',
  slack_webhook_url TEXT,
  alert_config JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS deployments (
  id BIGINT PRIMARY KEY,
  repo_id BIGINT NOT NULL REFERENCES repositories(id),
  environment TEXT NOT NULL,
  is_production BOOLEAN NOT NULL DEFAULT false,
  state TEXT NOT NULL,
  sha TEXT,
  ref TEXT,
  deployment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deployments_repo_environment_created
  ON deployments (repo_id, environment, created_at DESC);

CREATE TABLE IF NOT EXISTS deployment_statuses (
  id BIGINT PRIMARY KEY,
  deployment_id BIGINT NOT NULL REFERENCES deployments(id),
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

DO $$ BEGIN
  CREATE TYPE incident_status AS ENUM ('open', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY,
  repo_id BIGINT NOT NULL REFERENCES repositories(id),
  environment TEXT NOT NULL,
  status incident_status NOT NULL DEFAULT 'open',
  trigger_deployment_id BIGINT NOT NULL REFERENCES deployments(id),
  trigger_created_at TIMESTAMPTZ NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolving_deployment_id BIGINT REFERENCES deployments(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_incident
  ON incidents (repo_id, environment)
  WHERE status = 'open';

DO $$ BEGIN
  CREATE TYPE alert_status AS ENUM ('pending', 'failed', 'sent', 'suppressed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES incidents(id),
  repo_id BIGINT NOT NULL REFERENCES repositories(id),
  environment TEXT NOT NULL,
  kind TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  status alert_status NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_due
  ON alerts (status, next_attempt_at, created_at);
