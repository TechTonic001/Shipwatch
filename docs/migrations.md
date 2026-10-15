# Migration policy

## Expand/contract

Every schema change follows expand/contract:

1. **Expand**: add nullable columns, tables, indexes, or enum values without
   removing or changing the meaning of existing fields.
2. Deploy application code that can read both old and new shapes.
3. Backfill in bounded, resumable batches when required.
4. **Contract** only after the old code path is no longer deployed: remove
   obsolete indexes/columns in a later migration.

Use one forward-only migration per logical change. Keep statements
parameter-free and idempotent where PostgreSQL permits it (`IF EXISTS` /
`IF NOT EXISTS`). Avoid long table locks and never combine destructive changes
with an application rollout.

## Rollback policy

Applied migrations are immutable and are never edited or deleted. A failed
release is rolled back by reverting application code or adding a new
forward-fix migration. Production migration execution uses the direct Neon
connection, fails closed, and runs before deployment. Database changes are not
rolled back automatically.

The migration-safety workflow applies all migrations to an empty PostgreSQL 16
database, applies them a second time, and compares a schema-only `pg_dump`
against [schema.snapshot.sql](./schema.snapshot.sql).
