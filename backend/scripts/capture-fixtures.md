# Capturing sanitized GitHub fixtures

1. Open the repository in GitHub and go to **Settings -> Webhooks**.
2. Open the webhook used by Shipwatch and scroll to **Recent Deliveries**.
3. Open a delivery for `workflow_run`, `deployment`, or `deployment_status`.
4. Copy the **Request body** JSON into `backend/tests/fixtures/real/`.
5. Use a descriptive event filename, for example
   `workflow_run.completed.json` or `deployment_status.created.json`.
6. Run the sanitizer from the backend directory:

   ```powershell
   npm exec tsx scripts/sanitize-fixture.ts `
     --input tests/fixtures/real/workflow_run.completed.json `
     --output tests/fixtures/real/sanitized-workflow_run.completed.json
   ```

7. Inspect the sanitized file and commit only the sanitized output. Never commit
   `X-Hub-Signature-256`, personal access tokens, cookies, or unsanitized payloads.
8. Run `npm run test:integration --workspace backend`. The real-fixture suite
   intentionally fails if `tests/fixtures/real` has no JSON fixtures.

The sanitizer removes credential-like fields, email addresses, avatar noise,
and URL noise while retaining the payload structure needed by the zod schemas.
