import pg from "pg";

type Mode = "steady" | "burst" | "duplicate-storm" | "mixed-invalid";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseMode(value: string | undefined): Mode {
  if (value === "steady" || value === "burst" || value === "duplicate-storm" || value === "mixed-invalid") {
    return value;
  }
  throw new Error("Use --mode steady|burst|duplicate-storm|mixed-invalid.");
}

async function main(): Promise<void> {
  const dbUrl = argument("--db-url");
  const runId = argument("--run-id")?.toLowerCase();
  const mode = parseMode(argument("--mode"));
  const count = Number(argument("--count"));
  if (!dbUrl || !runId || !/^[0-9a-f]{8}$/.test(runId) || !Number.isSafeInteger(count) || count < 1 || count > 10_000) {
    throw new Error("Usage: --db-url <test branch URL> --run-id <8 hex chars> --mode <mode> --count <iterations or unique IDs>");
  }
  const parsedUrl = new URL(dbUrl);
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, "")).toLowerCase();
  if (!databaseName.includes("test") && process.env.ALLOW_NON_TEST_LOADTEST_DB !== "true") {
    throw new Error("Refusing a database without 'test' in its name; explicitly set ALLOW_NON_TEST_LOADTEST_DB=true for an isolated load-test branch.");
  }
  const expected = mode === "mixed-invalid" ? count - Math.floor(count / 10) : count;
  const runNumber = Number.parseInt(runId, 16);
  const deploymentBase = 200000000000 + runNumber * 10000;
  const pool = new pg.Pool({ connectionString: dbUrl, max: 2 });
  try {
    const result = await pool.query<{
      sent: number;
      missing: number;
      unprocessed: number;
      domain_statuses: number;
      duplicate_domain_rows: number;
      p50: number | null;
      p95: number | null;
      p99: number | null;
    }>(
      `WITH expected AS (
         SELECT i AS sequence,
                ($1::text || '-0000-4000-8000-' || lpad(to_hex(i), 12, '0'))::uuid AS delivery_id
           FROM generate_series(0, $2::int - 1) AS i
          WHERE $3::text <> 'mixed-invalid' OR mod(i, 10) <> 9
       ),
       rows AS (
         SELECT e.sequence, d.delivery_id, d.status, d.received_at, d.processed_at
           FROM expected e
           LEFT JOIN webhook_deliveries d ON d.delivery_id = e.delivery_id
       ),
       domain_duplicates AS (
         SELECT count(*)::int AS count
           FROM (
             SELECT id FROM deployments GROUP BY id HAVING count(*) > 1
             UNION ALL
             SELECT id FROM deployment_statuses GROUP BY id HAVING count(*) > 1
             UNION ALL
             SELECT id FROM workflow_runs GROUP BY id HAVING count(*) > 1
           ) duplicates
       )
       SELECT (SELECT count(*)::int FROM rows WHERE delivery_id IS NOT NULL) AS sent,
              (SELECT count(*)::int FROM rows WHERE delivery_id IS NULL) AS missing,
              (SELECT count(*)::int FROM rows WHERE status IS DISTINCT FROM 'processed') AS unprocessed,
              (SELECT count(*)::int FROM deployment_statuses
                WHERE id >= $4::bigint + 500000000000
                  AND id < $4::bigint + 500000000000 + $2::int) AS domain_statuses,
              (SELECT count FROM domain_duplicates) AS duplicate_domain_rows,
              (SELECT percentile_cont(0.50) WITHIN GROUP
                 (ORDER BY EXTRACT(EPOCH FROM (processed_at - received_at)))
                 FROM rows WHERE processed_at IS NOT NULL) AS p50,
              (SELECT percentile_cont(0.95) WITHIN GROUP
                 (ORDER BY EXTRACT(EPOCH FROM (processed_at - received_at)))
                 FROM rows WHERE processed_at IS NOT NULL) AS p95,
              (SELECT percentile_cont(0.99) WITHIN GROUP
                 (ORDER BY EXTRACT(EPOCH FROM (processed_at - received_at)))
                 FROM rows WHERE processed_at IS NOT NULL) AS p99`,
      [runId, count, mode, deploymentBase]
    );
    const row = result.rows[0];
    const checks = {
      sent: row?.sent === expected,
      missing: row?.missing === 0,
      processed: row?.unprocessed === 0,
      domainRows: row?.domain_statuses === expected,
      noDuplicateDomainRows: row?.duplicate_domain_rows === 0
    };
    process.stdout.write(`Verification: ${JSON.stringify(checks)}\n`);
    process.stdout.write(`End-to-end latency (seconds): ${JSON.stringify({ p50: row?.p50 ?? null, p95: row?.p95 ?? null, p99: row?.p99 ?? null })}\n`);
    if (Object.values(checks).some((passed) => !passed)) {
      throw new Error("Load-test verification failed; inspect the test branch before rerunning.");
    }
    process.stdout.write("PASS: all expected unique deliveries were processed exactly once.\n");
  } finally {
    await pool.end();
  }
}

await main();
