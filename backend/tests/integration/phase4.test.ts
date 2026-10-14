import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  startTestDatabase,
  stopTestDatabase,
  truncateApplicationTables,
  type TestDatabase
} from "../helpers/db.js";

let database: TestDatabase;
let processDeploymentStatus: typeof import("../../src/services/processors/deploymentStatus.js").processDeploymentStatus;
let applicationPool: typeof import("../../src/db/pool.js").pool;

function payload(deploymentId: number, statusId: number, environment: string): Record<string, unknown> {
  const timestamp = `2026-01-01T05:${String(deploymentId - 200).padStart(2, "0")}:00.000Z`;
  return {
    repository: {
      id: 9100,
      full_name: "shipwatch/phase4",
      production_environment: "production"
    },
    deployment: {
      id: deploymentId,
      environment,
      sha: "a".repeat(40),
      created_at: timestamp
    },
    deployment_status: {
      id: statusId,
      state: "failure",
      environment,
      created_at: timestamp
    }
  };
}

describe("Phase 4 environment matching", () => {
  beforeAll(async () => {
    database = await startTestDatabase();
    process.env.DATABASE_URL = database.url;
    ({ processDeploymentStatus } = await import("../../src/services/processors/deploymentStatus.js"));
    ({ pool: applicationPool } = await import("../../src/db/pool.js"));
  }, 60_000);

  beforeEach(async () => {
    await truncateApplicationTables(database.pool);
  }, 60_000);

  afterAll(async () => {
    await applicationPool.end();
    await stopTestDatabase(database);
  });

  it.each([
    ["Production", true],
    ["Preview", false],
    ["production ", true]
  ])("matches %s against configured production", async (environment, expected) => {
    await processDeploymentStatus(payload(200 + (expected ? 1 : 2), 3000 + (expected ? 1 : 2), environment));
    const result = await database.pool.query(
      "SELECT is_production FROM deployments WHERE id = $1",
      [200 + (expected ? 1 : 2)]
    );
    expect(result.rows[0]?.is_production).toBe(expected);
  });

  it("opens an incident for a case-mismatched Production environment", async () => {
    await processDeploymentStatus(payload(204, 3004, "Production"));
    const result = await database.pool.query("SELECT count(*) FROM incidents");
    expect(result.rows[0].count).toBe("1");
  });
});
