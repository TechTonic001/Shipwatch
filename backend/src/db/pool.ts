import pg from "pg";

import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === "test" ? 20 : 5,
  ssl: env.NODE_ENV === "test" ? undefined : { rejectUnauthorized: false }
});

pool.on("error", (error: Error) => {
  logger.error({ error: error.message }, "Database pool error");
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
    logger.info(details, "Database connection successful");
    return true;
  } catch (error) {
    logger.error(
      { ...details, error: error instanceof Error ? error.message : "Unknown database error" },
      "Database connection failed"
    );
    return false;
  }
}
