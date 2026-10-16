import pg from "pg";

import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === "test" ? 20 : 5,
  ssl: env.NODE_ENV === "test" ? undefined : { rejectUnauthorized: false }
});

pool.on("error", (error: Error) => {
  logger.error({
    event: "database_pool",
    outcome: "error",
    durationMs: 0,
    requestId: null,
    deliveryId: null,
    errorName: error.name
  }, "Database pool error");
});

function connectionDetails(): { host: string; database: string } {
  const url = new URL(env.DATABASE_URL);
  return {
    host: url.hostname,
    database: decodeURIComponent(url.pathname.replace(/^\/+/, "")) || "unknown"
  };
}

export async function verifyDatabaseConnection(): Promise<boolean> {
  const details = connectionDetails();
  try {
    await pool.query("SELECT 1");
    logger.info({
      ...details,
      event: "database_connection",
      outcome: "connected",
      durationMs: 0,
      requestId: null,
      deliveryId: null
    }, "Database connection successful");
    return true;
  } catch (error) {
    logger.error(
      {
        ...details,
        event: "database_connection",
        outcome: "failed",
        durationMs: 0,
        requestId: null,
        deliveryId: null,
        errorName: error instanceof Error ? error.name : "UnknownError"
      },
      "Database connection failed"
    );
    return false;
  }
}
