import pg from "pg";

import { env } from "../config/env.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === "test" ? 20 : 5,
  ssl: env.NODE_ENV === "test" ? undefined : { rejectUnauthorized: false }
});
