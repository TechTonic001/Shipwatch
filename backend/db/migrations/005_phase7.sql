ALTER TABLE repositories
  ADD COLUMN IF NOT EXISTS reconciled_through TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key, window_started_at)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id BIGINT PRIMARY KEY,
  repo_id BIGINT NOT NULL REFERENCES repositories(id),
  name TEXT,
  head_sha TEXT,
  head_branch TEXT,
  event TEXT,
  status TEXT,
  conclusion TEXT,
  run_started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_repo_started
  ON workflow_runs (repo_id, run_started_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limits_prune
  ON rate_limits (window_started_at);
