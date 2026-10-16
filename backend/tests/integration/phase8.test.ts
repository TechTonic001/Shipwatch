import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import {
  startTestDatabase,
  stopTestDatabase,
  truncateApplicationTables,
  type TestDatabase
} from "../helpers/db.js";

let database: TestDatabase;
let applicationPool: typeof import("../../src/db/pool.js").pool;
let getOperationalStats: typeof import("../../src/services/observability.js").getOperationalStats;
let evaluateOperatorAlerts: typeof import("../../src/services/operatorAlerts.js").evaluateOperatorAlerts;
let env: typeof import("../../src/config/env.js").env;
let app: typeof import("../../src/index.js").default;
let fakeSlack: Server;
const receivedMessages: string[] = [];

describe("Phase 8 observability and operator alerts", () => {
  beforeAll(async () => {
    database = await startTestDatabase();
    process.env.DATABASE_URL = database.url;
    ({ pool: applicationPool } = await import("../../src/db/pool.js"));
    ({ getOperationalStats } = await import("../../src/services/observability.js"));
    ({ evaluateOperatorAlerts } = await import("../../src/services/operatorAlerts.js"));
    ({ env } = await import("../../src/config/env.js"));
    ({ default: app } = await import("../../src/index.js"));

    fakeSlack = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const message = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { text: string };
      receivedMessages.push(message.text);
      response.writeHead(200);
      response.end("ok");
    });
    await new Promise<void>((resolve) => fakeSlack.listen(0, "127.0.0.1", resolve));
    const address = fakeSlack.address();
    if (!address || typeof address === "string") throw new Error("Fake Slack server failed to bind");
    env.OPERATOR_SLACK_WEBHOOK_URL = `http://127.0.0.1:${address.port}/webhook`;
  }, 60_000);

  beforeEach(async () => {
    receivedMessages.length = 0;
    await truncateApplicationTables(database.pool);
  });

  afterAll(async () => {
    if (fakeSlack) {
      await new Promise<void>((resolve, reject) => {
        fakeSlack.close((error) => error ? reject(error) : resolve());
      });
    }
    if (env) env.OPERATOR_SLACK_WEBHOOK_URL = undefined;
    if (applicationPool) await applicationPool.end();
    if (database) await stopTestDatabase(database);
  });

  it("reports queue status, retry rate, and one-hour processing percentiles from PostgreSQL", async () => {
    await database.pool.query(
      `INSERT INTO webhook_deliveries
         (delivery_id, event_type, payload, status, attempts, received_at, processed_at)
       VALUES
         ('11111111-1111-4111-8111-111111111111', 'workflow_run', '{}'::jsonb, 'processed', 2, now()-interval '12 seconds', now()-interval '2 seconds'),
         ('22222222-2222-4222-8222-222222222222', 'workflow_run', '{}'::jsonb, 'dead', 1, now()-interval '20 minutes', NULL)`
    );

    const stats = await getOperationalStats();
    expect(stats.queueDepthByStatus.processed).toBe(1);
    expect(stats.queueDepthByStatus.dead).toBe(1);
    expect(stats.deadDeliveries).toBe(1);
    expect(stats.oldestPendingDeliveryAgeSeconds).toBeNull();
    expect(stats.retryRate).toEqual({ retried: 1, total: 2, value: 0.5 });
    expect(stats.processingLatencySeconds.p50).toBeGreaterThan(0);
    expect(stats.processingLatencySeconds.p95).toBeGreaterThan(0);
    expect(stats.processingLatencySeconds.p99).toBeGreaterThan(0);
  });

  it("protects the stats endpoint with CRON_SECRET and disables caching", async () => {
    await request(app).get("/api/internal/stats").expect(401);
    await request(app)
      .get("/api/internal/stats")
      .set("Authorization", "Bearer wrong-token")
      .expect(401);
    const response = await request(app)
      .get("/api/internal/stats")
      .set("Authorization", `Bearer ${env.CRON_SECRET}`)
      .expect(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toHaveProperty("queueDepthByStatus");
    expect(response.body).toHaveProperty("processingLatencySeconds.p99");
  });

  it("sends one deduplicated firing and one recovery message through fake Slack", async () => {
    await database.pool.query(
      `INSERT INTO webhook_deliveries
         (delivery_id, event_type, payload, status, attempts)
       VALUES ('33333333-3333-4333-8333-333333333333', 'workflow_run', '{}'::jsonb, 'dead', 1)`
    );

    const firingStats = await getOperationalStats();
    await evaluateOperatorAlerts(firingStats);
    await evaluateOperatorAlerts(firingStats);
    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0]).toContain("dead webhook deliveries");

    await database.pool.query(
      `UPDATE webhook_deliveries
          SET status = 'processed', processed_at = now()
        WHERE delivery_id = '33333333-3333-4333-8333-333333333333'`
    );
    await evaluateOperatorAlerts(await getOperationalStats());

    expect(receivedMessages).toHaveLength(2);
    expect(receivedMessages[1]).toContain("Shipwatch recovery");
    const events = await database.pool.query(
      `SELECT event_kind, count(*)::int AS count, bool_and(status = 'sent') AS sent
         FROM operator_alert_events
        WHERE alert_key = 'dead-deliveries'
        GROUP BY event_kind
        ORDER BY event_kind`
    );
    expect(events.rows).toEqual([
      { event_kind: "firing", count: 1, sent: true },
      { event_kind: "recovery", count: 1, sent: true }
    ]);
  });
});
