import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import pg from "pg";

import { sign } from "../tests/helpers/sign.js";

type EventName = "workflow_run" | "deployment" | "deployment_status";
type ScenarioName =
  | "happy-deploy"
  | "failed-deploy-then-recover"
  | "flapping"
  | "out-of-order-run"
  | "status-before-deployment"
  | "duplicate-storm"
  | "burst";

export type ReplayEvent = {
  event: EventName;
  payload: Record<string, unknown>;
  duplicates?: number;
};

export type Scenario = {
  events: ReplayEvent[];
  expected: {
    deliveries: number;
    duplicateAcknowledgements: number;
  };
};

type Options = {
  url: string;
  secret: string;
  file?: string;
  scenario?: ScenarioName;
  count: number;
  duplicates: number;
  concurrency: number;
  dbUrl?: string;
};

type Result = {
  status: number;
  latencyMs: number;
  duplicate: boolean;
};

function objectValue(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Scenario payload must be an object");
  return value as Record<string, unknown>;
}

function payload(event: EventName, id: number, environment = "production", state = "success"): Record<string, unknown> {
  const createdAt = new Date(Date.UTC(2026, 0, 1, 12, Math.floor(id / 10), id % 60)).toISOString();
  const repository = { id: -7000, full_name: "demo/storefront", production_environment: "production" };
  if (event === "workflow_run") {
    return {
      action: state === "success" ? "completed" : "completed",
      repository,
      workflow_run: {
        id,
        run_attempt: 1,
        head_sha: `${id.toString(16).padStart(8, "0")}${"a".repeat(32)}`,
        status: "completed",
        conclusion: state,
        created_at: createdAt,
        updated_at: createdAt,
        completed_at: createdAt
      }
    };
  }
  if (event === "deployment") {
    return {
      action: "created",
      repository,
      deployment: { id, environment, sha: `${id.toString(16).padStart(8, "0")}${"b".repeat(32)}`, created_at: createdAt }
    };
  }
  return {
    action: "created",
    repository,
    deployment: { id, environment, sha: `${id.toString(16).padStart(8, "0")}${"c".repeat(32)}`, created_at: createdAt },
    deployment_status: { id: id + 1_000_000, state, environment, created_at: createdAt }
  };
}

export function scenarios(): Record<ScenarioName, Scenario> {
  return {
    "happy-deploy": {
      events: [{ event: "deployment", payload: payload("deployment", 4101) }, { event: "deployment_status", payload: payload("deployment_status", 4102, "Production", "success") }],
      expected: { deliveries: 2, duplicateAcknowledgements: 0 }
    },
    "failed-deploy-then-recover": {
      events: [{ event: "deployment_status", payload: payload("deployment_status", 4201, "Production", "failure") }, { event: "deployment_status", payload: payload("deployment_status", 4202, "Production", "success") }],
      expected: { deliveries: 2, duplicateAcknowledgements: 0 }
    },
    flapping: {
      events: [
        { event: "deployment_status", payload: payload("deployment_status", 4301, "Production", "failure") },
        { event: "deployment_status", payload: payload("deployment_status", 4302, "Production", "success") },
        { event: "deployment_status", payload: payload("deployment_status", 4303, "Production", "failure") }
      ],
      expected: { deliveries: 3, duplicateAcknowledgements: 0 }
    },
    "out-of-order-run": {
      events: [{ event: "workflow_run", payload: payload("workflow_run", 4402) }, { event: "workflow_run", payload: payload("workflow_run", 4401, "production", "failure") }],
      expected: { deliveries: 2, duplicateAcknowledgements: 0 }
    },
    "status-before-deployment": {
      events: [{ event: "deployment_status", payload: payload("deployment_status", 4501, "Preview", "success") }, { event: "deployment", payload: payload("deployment", 4502, "Preview") }],
      expected: { deliveries: 2, duplicateAcknowledgements: 0 }
    },
    "duplicate-storm": {
      events: [{ event: "deployment_status", payload: payload("deployment_status", 4601, "Production", "failure"), duplicates: 20 }],
      expected: { deliveries: 1, duplicateAcknowledgements: 19 }
    },
    burst: {
      events: Array.from({ length: 10 }, (_, index) => ({
        event: "workflow_run" as const,
        payload: payload("workflow_run", 4700 + index)
      })),
      expected: { deliveries: 10, duplicateAcknowledgements: 0 }
    }
  };
}

function parseOptions(args: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (key?.startsWith("--") && value && !value.startsWith("--")) {
      values.set(key, value);
      index += 1;
    }
  }
  const count = Number(values.get("--count") ?? "1");
  const duplicates = Number(values.get("--duplicates") ?? "1");
  const concurrency = Number(values.get("--concurrency") ?? "1");
  const scenario = values.get("--scenario") as ScenarioName | undefined;
  if (!values.get("--url") || !values.get("--secret") || (!values.get("--file") && !scenario)) {
    throw new Error("--url, --secret, and either --file or --scenario are required");
  }
  if (scenario && !Object.hasOwn(scenarios(), scenario)) throw new Error(`Unknown scenario: ${scenario}`);
  if (![count, duplicates, concurrency].every((value) => Number.isInteger(value) && value > 0)) {
    throw new Error("--count, --duplicates, and --concurrency must be positive integers");
  }
  return {
    url: values.get("--url") as string,
    secret: values.get("--secret") as string,
    file: values.get("--file") ? resolve(values.get("--file") as string) : undefined,
    scenario,
    count,
    duplicates,
    concurrency,
    dbUrl: values.get("--db-url")
  };
}

async function send(url: string, event: ReplayEvent, secret: string, deliveryId: string): Promise<Result> {
  const body = Buffer.from(JSON.stringify(event.payload));
  const started = performance.now();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-delivery": deliveryId,
      "x-github-event": event.event,
      "x-hub-signature-256": sign(body, secret)
    },
    body: new Uint8Array(body)
  });
  const responseBody: unknown = await response.json();
  const duplicate =
    responseBody !== null &&
    typeof responseBody === "object" &&
    !Array.isArray(responseBody) &&
    (responseBody as { duplicate?: unknown }).duplicate === true;
  return { status: response.status, latencyMs: performance.now() - started, duplicate };
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

export function hasHttpFailures(results: Array<Pick<Result, "status">>): boolean {
  return results.some(({ status }) => status < 200 || status >= 300);
}

async function verify(dbUrl: string, expected: Scenario["expected"], duplicateAcknowledgements: number): Promise<boolean> {
  const pool = new pg.Pool({ connectionString: dbUrl });
  try {
    const result = await pool.query<{ deliveries: string; states: string; alerts: string }>(
      `SELECT
         (SELECT count(*)::text FROM webhook_deliveries WHERE github_repo_id = -7000) AS deliveries,
         (SELECT COALESCE(string_agg(status || '=' || status_count, ', ' ORDER BY status), '')
            FROM (
              SELECT status, count(*)::text AS status_count
                FROM webhook_deliveries
               WHERE github_repo_id = -7000
               GROUP BY status
            ) grouped) AS states,
         (SELECT count(*)::text FROM alerts WHERE repo_id = -7000) AS alerts`
    );
    const row = result.rows[0];
    const pass =
      Number(row?.deliveries ?? 0) === expected.deliveries &&
      duplicateAcknowledgements === expected.duplicateAcknowledgements;
    process.stdout.write(
      `\nVerification\n` +
        `| Metric                    | Actual              | Expected            |\n` +
        `| deliveries                | ${row?.deliveries ?? "0"}                 | ${expected.deliveries}                 |\n` +
        `| states                    | ${row?.states || "none"} | received/processed  |\n` +
        `| alerts                    | ${row?.alerts ?? "0"}                 | scenario-dependent  |\n` +
        `| duplicate acknowledgements| ${duplicateAcknowledgements}                 | ${expected.duplicateAcknowledgements}                 |\n` +
        `| result                    | ${pass ? "PASS" : "FAIL"}               |                    |\n`
    );
    return pass;
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const scenario = options.scenario
    ? scenarios()[options.scenario]
    : { events: [{ event: "workflow_run" as const, payload: objectValue(JSON.parse(await readFile(options.file as string, "utf8"))) }], expected: { deliveries: options.count, duplicateAcknowledgements: 0 } };
  const deliveries = options.scenario
    ? scenario.events.flatMap((event) => {
        const deliveryId = randomUUID();
        return Array.from({ length: event.duplicates ?? 1 }, () => ({ event, deliveryId }));
      })
    : Array.from({ length: options.count }, () => ({ event: scenario.events[0], deliveryId: randomUUID() }));
  const results: Result[] = [];
  for (let index = 0; index < deliveries.length; index += options.concurrency) {
    results.push(...(await Promise.all(deliveries.slice(index, index + options.concurrency).map((delivery) => send(options.url, delivery.event, options.secret, delivery.deliveryId)))));
  }
  const latencies = results.map((result) => result.latencyMs);
  const twoHundred = results.filter((result) => result.status >= 200 && result.status < 300).length;
  const fourHundred = results.filter((result) => result.status >= 400 && result.status < 500).length;
  const fiveHundred = results.filter((result) => result.status >= 500).length;
  const duplicateAcknowledgements = results.filter((result) => result.duplicate).length;
  const httpFailed = hasHttpFailures(results);
  process.stdout.write(
    `sent=${results.length} 2xx=${twoHundred} 4xx=${fourHundred} 5xx=${fiveHundred} ` +
      `duplicates_acknowledged=${duplicateAcknowledgements} p50=${percentile(latencies, 0.5).toFixed(1)}ms ` +
      `p99=${percentile(latencies, 0.99).toFixed(1)}ms http_result=${httpFailed ? "FAIL" : "PASS"}\n`
  );
  if (httpFailed) process.exitCode = 1;
  if (options.dbUrl && !(await verify(options.dbUrl, scenario.expected, duplicateAcknowledgements))) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
