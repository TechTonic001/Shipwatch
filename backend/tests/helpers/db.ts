import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";

const { Pool } = pg;

export type TestDatabase = {
  url: string;
  pool: pg.Pool;
  container?: StartedPostgreSqlContainer;
};

export function assertSafeTestDatabaseUrl(url: string, productionUrl?: string): void {
  if (productionUrl && url === productionUrl) {
    throw new Error("Refusing to run tests: TEST_DATABASE_URL equals DATABASE_URL.");
  }

  const parsed = new URL(url);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, "")).toLowerCase();
  const isExplicitlyAllowed = process.env.ALLOW_NONLOCAL_TEST_DB === "true";

  if (!databaseName.includes("test") && !url.toLowerCase().includes("test") && !isExplicitlyAllowed) {
    throw new Error(
      "Refusing to run tests against a non-test database. Use a database whose name or URL contains 'test', set ALLOW_NONLOCAL_TEST_DB=true explicitly, or use Docker/Testcontainers."
    );
  }
}

function dockerIsAvailable(): boolean {
  return spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
}

async function applySchema(pool: pg.Pool): Promise<void> {
  const schemaPath = resolve("db/schema.sql");
  const schema = await readFile(schemaPath, "utf8");
  if (schema.trim() !== "" && !schema.includes("I will paste the SQL")) {
    await pool.query(schema);
    return;
  }

  const migrations = ["000_foundation.sql", "001_baseline.sql", "002_phase2.sql", "003_phase3.sql", "004_phase4.sql", "005_phase7.sql"];
  for (const migration of migrations) {
    const sql = await readFile(resolve("db/migrations", migration), "utf8");
    if (sql.replace(/--.*$/gm, "").trim()) {
      await pool.query(sql);
    }
  }
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const configuredUrl = process.env.TEST_DATABASE_URL;
  let url = configuredUrl;
  let container: StartedPostgreSqlContainer | undefined;

  if (url) {
    assertSafeTestDatabaseUrl(url, process.env.DATABASE_URL);
  } else if (dockerIsAvailable()) {
    try {
      container = await new PostgreSqlContainer("postgres:16").start();
      url = container.getConnectionUri();
    } catch (error) {
      throw new Error(
        "Unable to start Docker/Testcontainers for integration tests. Provide TEST_DATABASE_URL for a local or Neon test database, start Docker, or run the CI PostgreSQL service.",
        { cause: error }
      );
    }
  } else {
    throw new Error(
      "No integration-test database is available. Set TEST_DATABASE_URL to a local or Neon test database, start Docker so Testcontainers can launch postgres:16, or run the test job in CI with its PostgreSQL service."
    );
  }

  if (!url) {
    throw new Error("Test database provider did not return a connection URL.");
  }

  const pool = new Pool({ connectionString: url, max: 20 });
  await applySchema(pool);
  return { url, pool, container };
}

export async function truncateApplicationTables(pool: pg.Pool): Promise<void> {
  await pool.query(
    "TRUNCATE TABLE alerts, incidents, deployment_statuses, deployments, repositories, webhook_deliveries RESTART IDENTITY CASCADE"
  );
}

export async function stopTestDatabase(database: TestDatabase): Promise<void> {
  await database.pool.end();
  await database.container?.stop();
}
