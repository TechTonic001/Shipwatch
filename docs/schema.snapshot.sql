-- Canonical schema snapshot for the migration-safety check.
-- Refresh with:
-- pg_dump "$DATABASE_URL_DIRECT" --schema-only --no-owner --no-privileges --no-comments
-- after applying all migrations to an empty PostgreSQL 16 database.

CREATE TABLE public.alerts (
    id uuid NOT NULL,
    incident_id uuid NOT NULL,
    repo_id bigint NOT NULL,
    environment text NOT NULL,
    kind text NOT NULL,
    dedupe_key text NOT NULL,
    status public.alert_status DEFAULT 'pending'::public.alert_status NOT NULL,
    payload jsonb NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone
);

CREATE TABLE public.deployment_statuses (
    id bigint NOT NULL,
    deployment_id bigint NOT NULL,
    state text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.deployments (
    id bigint NOT NULL,
    repo_id bigint NOT NULL,
    environment text NOT NULL,
    is_production boolean DEFAULT false NOT NULL,
    state text NOT NULL,
    sha text,
    ref text,
    deployment_url text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.incidents (
    id uuid NOT NULL,
    repo_id bigint NOT NULL,
    environment text NOT NULL,
    status public.incident_status DEFAULT 'open'::public.incident_status NOT NULL,
    trigger_deployment_id bigint NOT NULL,
    trigger_created_at timestamp with time zone NOT NULL,
    opened_at timestamp with time zone NOT NULL,
    resolved_at timestamp with time zone,
    resolving_deployment_id bigint
);

CREATE TABLE public.repositories (
    id bigint NOT NULL,
    full_name text NOT NULL,
    production_environment text DEFAULT 'production'::text NOT NULL,
    slack_webhook_url text,
    alert_config jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.webhook_deliveries (
    delivery_id uuid NOT NULL,
    event_type text NOT NULL,
    action text,
    github_repo_id bigint,
    payload jsonb NOT NULL,
    status text DEFAULT 'received'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    next_attempt_at timestamp with time zone,
    locked_at timestamp with time zone,
    processed_at timestamp with time zone,
    last_error text
);
