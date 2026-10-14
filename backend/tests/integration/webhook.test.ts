import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  startTestDatabase,
  stopTestDatabase,
  truncateApplicationTables,
  type TestDatabase
} from "../helpers/db.js";
import { sign } from "../helpers/sign.js";

const secret = "integration-secret";
const database: TestDatabase = await startTestDatabase();
let app: typeof import("../../src/index.js").default;
let pool: typeof import("../../src/db/pool.js").pool;

const fixture = async (name: string): Promise<Buffer> =>
  readFile(resolve("tests/fixtures", name));

async function countRows(): Promise<number> {
  const result = await database.pool.query("SELECT count(*)::int AS count FROM webhook_deliveries");
  return result.rows[0].count;
}

function headers(
  body: Buffer,
  delivery = "550e8400-e29b-41d4-a716-446655440000",
  event = "workflow_run"
) {
  return {
    "content-type": "application/json",
    "x-github-delivery": delivery,
    "x-github-event": event,
    "x-hub-signature-256": sign(body, secret)
  };
}

describe("GitHub webhook ingestion", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = database.url;
    process.env.GITHUB_WEBHOOK_SECRET = secret;
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/test";
    process.env.CRON_SECRET = "integration-cron";
    process.env.NODE_ENV = "test";
    ({ default: app } = await import("../../src/index.js"));
    ({ pool } = await import("../../src/db/pool.js"));
  }, 60_000);

  beforeEach(async () => {
    await truncateApplicationTables(database.pool);
  }, 120_000);

  afterAll(async () => {
    if (pool) await pool.end();
    if (database) await stopTestDatabase(database);
  });

  it("rejects bad signatures without writing", async () => {
    const body = await fixture("workflow_run.requested.json");
    const response = await request(app)
      .post("/api/webhooks/github")
      .set({ ...headers(body), "x-hub-signature-256": sign(body, "wrong") })
      .send(body);
    expect(response.status).toBe(401);
    expect(await countRows()).toBe(0);
  });

  it("ingests a workflow run and extracts fields", async () => {
    const body = await fixture("workflow_run.requested.json");
    const response = await request(app).post("/api/webhooks/github").set(headers(body)).send(body);
    expect(response.body).toEqual({ ok: true, duplicate: false });
    const result = await database.pool.query(
      "SELECT event_type, action, github_repo_id, status, payload FROM webhook_deliveries"
    );
    expect(result.rows[0]).toMatchObject({
      event_type: "workflow_run",
      action: "requested",
      github_repo_id: "123456789",
      status: "received"
    });
    expect(result.rows[0].payload).toMatchObject({ action: "requested" });
  });

  it("acknowledges sequential duplicates", async () => {
    const body = await fixture("workflow_run.completed.success.json");
    const delivery = "550e8400-e29b-41d4-a716-446655440004";
    const first = await request(app).post("/api/webhooks/github").set(headers(body, delivery)).send(body);
    const second = await request(app).post("/api/webhooks/github").set(headers(body, delivery)).send(body);
    expect(first.body).toEqual({ ok: true, duplicate: false });
    expect(second.body).toEqual({ ok: true, duplicate: true });
  });

  it("extracts action and repository ids for deployment events", async () => {
    const cases = [
      ["deployment.created.json", "deployment"],
      ["deployment_status.created.success.json", "deployment_status"],
      ["deployment_status.created.failure.json", "deployment_status"]
    ] as const;
    for (const [filename, event] of cases) {
      const body = await fixture(filename);
      const delivery = randomUUID();
      await request(app).post("/api/webhooks/github").set(headers(body, delivery, event)).send(body);
      const result = await database.pool.query(
        "SELECT event_type, action, github_repo_id FROM webhook_deliveries WHERE delivery_id = $1",
        [delivery]
      );
      expect(result.rows[0]).toMatchObject({
        event_type: event,
        action: "created",
        github_repo_id: "123456789"
      });
    }
  });

  it("deduplicates concurrent deliveries", async () => {
    const body = await fixture("workflow_run.in_progress.json");
    const delivery = "550e8400-e29b-41d4-a716-446655440001";
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app).post("/api/webhooks/github").set(headers(body, delivery)).send(body)
      )
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(responses.filter((response) => response.body.duplicate).length).toBe(19);
    expect(await countRows()).toBe(1);

    const backendPids = await Promise.all(
      Array.from({ length: 20 }, async () => {
        const result = await pool.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
        return result.rows[0].pid;
      })
    );
    expect(new Set(backendPids).size).toBeGreaterThan(1);
  });

  it("handles ping and unknown events without storing", async () => {
    const ping = await fixture("ping.json");
    const pingResponse = await request(app)
      .post("/api/webhooks/github")
      .set(headers(ping, "550e8400-e29b-41d4-a716-446655440002", "ping"))
      .send(ping);
    expect(pingResponse.body).toEqual({ ok: true, event: "ping" });
    const unknown = Buffer.from('{"action":"opened"}');
    const unknownResponse = await request(app)
      .post("/api/webhooks/github")
      .set(headers(unknown, "550e8400-e29b-41d4-a716-446655440003", "push"))
      .send(unknown);
    expect(unknownResponse.body).toEqual({ ok: true, ignored: true });
    expect(await countRows()).toBe(0);
  });

  it("rejects malformed headers, JSON, and oversized payloads", async () => {
    const body = await fixture("workflow_run.completed.success.json");
    expect((await request(app).post("/api/webhooks/github").set(headers(body)).unset("x-github-delivery").send(body)).status).toBe(400);
    expect(
      (await request(app).post("/api/webhooks/github").set(headers(body, "not-a-uuid")).send(body)).status
    ).toBe(400);
    const invalid = Buffer.from("{");
    expect(
      (await request(app).post("/api/webhooks/github").set(headers(invalid)).send(invalid)).status
    ).toBe(400);
    const oversized = Buffer.alloc(1024 * 1024 + 1, "a");
    expect(
      (await request(app).post("/api/webhooks/github").set(headers(oversized)).send(oversized)).status
    ).toBe(413);
  });

  it("returns 500 when the database pool is unavailable", async () => {
    await pool.end();
    const body = await fixture("workflow_run.completed.failure.json");
    const response = await request(app)
      .post("/api/webhooks/github")
      .set(headers(body, "550e8400-e29b-41d4-a716-446655440005"))
      .send(body);
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "persist failed" });
  });
});
