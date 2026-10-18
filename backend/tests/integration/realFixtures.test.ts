import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startTestDatabase, stopTestDatabase, truncateApplicationTables, type TestDatabase } from "../helpers/db.js";

const fixturesDirectory = resolve("tests/fixtures/real");
let database: TestDatabase;
let applicationPool: typeof import("../../src/db/pool.js").pool;
let deploymentPayloadSchema: typeof import("../../src/services/processors/deployment.js").deploymentPayloadSchema;
let processDeployment: typeof import("../../src/services/processors/deployment.js").processDeployment;
let processDeploymentStatus: typeof import("../../src/services/processors/deploymentStatus.js").processDeploymentStatus;
let deploymentStatusPayloadSchema: typeof import("../../src/services/processors/deploymentStatus.js").deploymentStatusPayloadSchema;
let processWorkflowRun: typeof import("../../src/services/processors/workflowRun.js").processWorkflowRun;
let workflowRunPayloadSchema: typeof import("../../src/services/processors/workflowRun.js").workflowRunPayloadSchema;
let PermanentProcessingError: typeof import("../../src/services/queue.js").PermanentProcessingError;

async function fixtureFiles(): Promise<string[]> {
  const entries = await readdir(fixturesDirectory);
  return entries
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => resolve(fixturesDirectory, entry))
    .sort();
}

describe("sanitized real fixtures", () => {
  beforeAll(async () => {
    database = await startTestDatabase();
    process.env.DATABASE_URL = database.url;
    ({ deploymentPayloadSchema, processDeployment } = await import("../../src/services/processors/deployment.js"));
    ({ deploymentStatusPayloadSchema, processDeploymentStatus } = await import("../../src/services/processors/deploymentStatus.js"));
    ({ processWorkflowRun, workflowRunPayloadSchema } = await import("../../src/services/processors/workflowRun.js"));
    ({ PermanentProcessingError } = await import("../../src/services/queue.js"));
    ({ pool: applicationPool } = await import("../../src/db/pool.js"));
  }, 60_000);

  beforeEach(async () => {
    await truncateApplicationTables(database.pool);
  }, 60_000);

  afterAll(async () => {
    if (applicationPool) await applicationPool.end();
    if (database) await stopTestDatabase(database);
  });

  it("has captured fixtures and processes every one without permanent errors", async () => {
    const files = await fixtureFiles();
    expect(files.length, "Capture sanitized fixtures into tests/fixtures/real; see scripts/capture-fixtures.md").toBeGreaterThan(0);

    for (const file of files) {
      const payload: unknown = JSON.parse(await readFile(file, "utf8"));
      const name = file.toLowerCase();
      try {
        if (name.includes("workflow_run")) {
          expect(workflowRunPayloadSchema.safeParse(payload).success).toBe(true);
          await processWorkflowRun(payload);
        } else if (name.includes("deployment_status")) {
          expect(deploymentStatusPayloadSchema.safeParse(payload).success).toBe(true);
          await processDeploymentStatus(payload);
        } else if (name.includes("deployment")) {
          expect(deploymentPayloadSchema.safeParse(payload).success).toBe(true);
          await processDeployment(payload);
        } else {
          throw new Error(`Fixture filename must identify its event type: ${file}`);
        }
      } catch (error) {
        expect(error).not.toBeInstanceOf(PermanentProcessingError);
        throw error;
      }
    }
  });
});
