import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  startTestDatabase,
  stopTestDatabase,
  truncateApplicationTables,
  type TestDatabase
} from "../helpers/db.js";

let database: TestDatabase;
let processDeploymentStatus: typeof import("../../src/services/processors/deploymentStatus.js").processDeploymentStatus;
let dispatchAlerts: typeof import("../../src/services/alertDispatcher.js").dispatchAlerts;
let applicationPool: typeof import("../../src/db/pool.js").pool;

function payload(
  deploymentId: number,
  statusId: number,
  state: string,
  createdAt: string,
  environment = "production"
): Record<string, unknown> {
  return {
    repository: {
      id: 9001,
      full_name: "shipwatch/phase3",
      production_environment: "production"
    },
    deployment: {
      id: deploymentId,
      environment,
      sha: `${deploymentId.toString(16).padStart(12, "0")}${"a".repeat(40)}`,
      created_at: createdAt
    },
    deployment_status: {
      id: statusId,
      state,
      environment,
      created_at: createdAt
    }
  };
}

describe("Phase 3 incidents and alert outbox", () => {
  beforeAll(async () => {
    database = await startTestDatabase();
    process.env.DATABASE_URL = database.url;
    ({ processDeploymentStatus } = await import("../../src/services/processors/deploymentStatus.js"));
    ({ dispatchAlerts } = await import("../../src/services/alertDispatcher.js"));
    ({ pool: applicationPool } = await import("../../src/db/pool.js"));
  }, 60_000);

  beforeEach(async () => {
    await truncateApplicationTables(database.pool);
  }, 60_000);

  afterAll(async () => {
    if (applicationPool) await applicationPool.end();
    if (database) await stopTestDatabase(database);
  });

  it("opens one production incident and one pending alert", async () => {
    await processDeploymentStatus(
      payload(100, 1000, "failure", "2026-01-01T00:00:00.000Z")
    );
    const result = await database.pool.query(
      "SELECT (SELECT count(*) FROM incidents) AS incidents, (SELECT count(*) FROM alerts) AS alerts"
    );
    expect(result.rows[0]).toEqual({ incidents: "1", alerts: "1" });
  });

  it("resolves only with a newer production deployment and records duration", async () => {
    await processDeploymentStatus(payload(101, 1001, "failure", "2026-01-01T00:00:00.000Z"));
    await processDeploymentStatus(payload(102, 1002, "success", "2026-01-01T00:23:00.000Z"));
    const result = await database.pool.query(
      "SELECT status, EXTRACT(EPOCH FROM (resolved_at - opened_at))::int AS duration FROM incidents"
    );
    const alerts = await database.pool.query(
      "SELECT kind, payload->>'durationSeconds' AS duration FROM alerts ORDER BY kind"
    );
    expect(result.rows[0]).toEqual({ status: "resolved", duration: 1380 });
    expect(alerts.rows).toContainEqual({ kind: "incident_resolved", duration: "1380" });
  });

  it("ignores stale failures and non-production failures", async () => {
    await processDeploymentStatus(payload(103, 1003, "success", "2026-01-01T00:02:00.000Z"));
    await processDeploymentStatus(payload(104, 1004, "failure", "2026-01-01T00:01:00.000Z"));
    await processDeploymentStatus(payload(105, 1005, "failure", "2026-01-01T00:00:00.000Z", "staging"));
    const result = await database.pool.query("SELECT count(*) FROM incidents");
    expect(result.rows[0].count).toBe("0");
  });

  it("converges under concurrent duplicate failures", async () => {
    const createdAt = "2026-01-01T01:00:00.000Z";
    await Promise.all(
      Array.from({ length: 20 }, () =>
        processDeploymentStatus(payload(106, 1006, "failure", createdAt))
      )
    );
    const result = await database.pool.query(
      "SELECT (SELECT count(*) FROM incidents) AS incidents, (SELECT count(*) FROM alerts) AS alerts"
    );
    expect(result.rows[0]).toEqual({ incidents: "1", alerts: "1" });
  });

  it("rolls back the incident and alert together when the transaction fails", async () => {
    await database.pool.query(`
      CREATE OR REPLACE FUNCTION fail_phase3_alert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced phase 3 transaction failure';
      END $$;
    `);
    await database.pool.query(
      "CREATE TRIGGER phase3_alert_failure BEFORE INSERT ON alerts FOR EACH ROW EXECUTE FUNCTION fail_phase3_alert()"
    );
    await expect(
      processDeploymentStatus(payload(107, 1007, "failure", "2026-01-01T02:00:00.000Z"))
    ).rejects.toThrow("forced phase 3 transaction failure");
    await database.pool.query("DROP TRIGGER phase3_alert_failure ON alerts");
    await database.pool.query("DROP FUNCTION fail_phase3_alert()");
    const result = await database.pool.query("SELECT count(*) FROM incidents");
    expect(result.rows[0].count).toBe("0");
  });

  it("defers a second opened alert during cooldown while its incident remains open", async () => {
    await processDeploymentStatus(payload(108, 1008, "failure", "2026-01-01T03:00:00.000Z"));
    await processDeploymentStatus(payload(109, 1009, "success", "2026-01-01T03:05:00.000Z"));
    await processDeploymentStatus(payload(110, 1010, "failure", "2026-01-01T03:06:00.000Z"));

    const result = await database.pool.query(
      "SELECT kind, status, next_attempt_at > now() AS deferred FROM alerts ORDER BY created_at"
    );
    expect(result.rows).toHaveLength(3);
    expect(result.rows[2]).toMatchObject({ kind: "incident_opened", status: "pending", deferred: true });
    expect(result.rows.some((row) => row.status === "suppressed")).toBe(false);
  });

  it("suppresses both alerts when recovery happens before the opened alert is sent", async () => {
    await processDeploymentStatus(payload(111, 1011, "failure", "2026-01-01T04:00:00.000Z"));
    await processDeploymentStatus(payload(112, 1012, "success", "2026-01-01T04:01:00.000Z"));

    await expect(dispatchAlerts({ deadlineMs: 10_000 })).resolves.toMatchObject({ sent: 0 });
    const result = await database.pool.query(
      "SELECT kind, status, payload->>'suppressedReason' AS reason FROM alerts ORDER BY kind"
    );
    expect(result.rows).toEqual([
      { kind: "incident_opened", status: "suppressed", reason: "resolved_before_send" },
      { kind: "incident_resolved", status: "suppressed", reason: "resolved_before_send" }
    ]);
  });
});
