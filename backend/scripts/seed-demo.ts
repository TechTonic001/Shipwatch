import "dotenv/config";

import { randomUUID } from "node:crypto";

import pg from "pg";

import { sign } from "../tests/helpers/sign.js";

type Options = {
  url: string;
  secret: string;
  dbUrl: string;
  seed: number;
  reset: boolean;
};

const repoId = -7000;
const repoName = "demo/storefront";

function option(args: string[], name: string, fallback?: string): string {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith("--") ? args[index + 1] : fallback ?? "";
}

function parseOptions(args: string[]): Options {
  const url = option(args, "--url", "http://localhost:3000/api/webhooks/github");
  const secret = option(args, "--secret", process.env.GITHUB_WEBHOOK_SECRET);
  const dbUrl = option(args, "--db-url", process.env.DATABASE_URL);
  const seed = Number(option(args, "--seed", "1"));
  if (!secret || !dbUrl || !Number.isInteger(seed)) throw new Error("--secret, --db-url, and integer --seed are required");
  return { url, secret, dbUrl, seed, reset: args.includes("--reset") };
}

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function fixture(deploymentId: number, statusId: number, state: string, at: Date): Record<string, unknown> {
  return {
    action: "created",
    repository: { id: repoId, full_name: repoName, production_environment: "production" },
    deployment: {
      id: deploymentId,
      environment: "Production",
      sha: `${deploymentId.toString(16).padStart(8, "0")}${"d".repeat(32)}`,
      created_at: at.toISOString()
    },
    deployment_status: {
      id: statusId,
      state,
      environment: "Production",
      created_at: at.toISOString()
    }
  };
}

async function send(url: string, secret: string, payload: Record<string, unknown>): Promise<void> {
  const body = Buffer.from(JSON.stringify(payload));
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-delivery": randomUUID(),
      "x-github-event": "deployment_status",
      "x-hub-signature-256": sign(body, secret)
    },
    body: new Uint8Array(body)
  });
  if (!response.ok) throw new Error(`Demo fixture ingestion failed with HTTP ${response.status}`);
}

async function reset(pool: pg.Pool): Promise<void> {
  await pool.query(
    `DELETE FROM alerts WHERE repo_id = $1;
     DELETE FROM incidents WHERE repo_id = $1;
     DELETE FROM deployment_statuses
       WHERE deployment_id IN (SELECT id FROM deployments WHERE repo_id = $1);
     DELETE FROM deployments WHERE repo_id = $1;
     DELETE FROM repositories WHERE id = $1;
     DELETE FROM webhook_deliveries WHERE github_repo_id = $1`,
    [repoId]
  );
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const pool = new pg.Pool({ connectionString: options.dbUrl });
  try {
    if (options.reset) await reset(pool);
    const generator = random(options.seed);
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 29);
    start.setUTCHours(9, 0, 0, 0);
    const events: Record<string, unknown>[] = [];
    let deploymentId = 8000;
    let statusId = 9000;

    for (let day = 0; day < 30; day += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + day);
      const weekday = date.getUTCDay();
      const deployCount = weekday === 0 || weekday === 6 ? 1 : 3 + (generator() > 0.7 ? 1 : 0);
      for (let index = 0; index < deployCount; index += 1) {
        const deployAt = new Date(date);
        deployAt.setUTCHours(9 + index * 2, Math.floor(generator() * 45), 0, 0);
        const failed = generator() < 0.12;
        events.push(fixture(deploymentId, statusId, failed ? "failure" : "success", deployAt));
        deploymentId += 1;
        statusId += 1;
        if (failed && generator() < 0.7) {
          const recoveryAt = new Date(deployAt.getTime() + (5 + Math.floor(generator() * 180)) * 60_000);
          events.push(fixture(deploymentId, statusId, "success", recoveryAt));
          deploymentId += 1;
          statusId += 1;
        }
      }
    }

    for (const event of events) await send(options.url, options.secret, event);
    await pool.query(
      `INSERT INTO repositories (id, full_name, production_environment, alert_config)
       VALUES ($1, $2, 'production', '{"muted":true}'::jsonb)
       ON CONFLICT (id) DO UPDATE SET alert_config = '{"muted":true}'::jsonb`,
      [repoId, repoName]
    );

    process.env.DATABASE_URL = options.dbUrl;
    const { processBatch } = await import("../src/services/worker.js");
    for (;;) {
      const summary = await processBatch({ limit: 100, deadlineMs: 15_000 });
      if (summary.claimed === 0) break;
    }
    const result = await pool.query(
      `SELECT
         (SELECT count(*) FROM webhook_deliveries WHERE github_repo_id = $1) AS deliveries,
         (SELECT count(*) FROM deployments WHERE repo_id = $1) AS deployments,
         (SELECT count(*) FROM incidents WHERE repo_id = $1) AS incidents,
         (SELECT count(*) FROM alerts WHERE repo_id = $1 AND status = 'suppressed') AS suppressed_alerts`,
      [repoId]
    );
    process.stdout.write(`Seeded ${repoName}: ${JSON.stringify(result.rows[0])}\n`);
  } finally {
    await pool.end();
  }
}

await main();
