import pg from "pg";

import { encryptSecret, isEncryptedSecret } from "../src/lib/secrets.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL });
const batchSize = 100;

try {
  for (;;) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: number; value: string }>(
        `SELECT id, slack_webhook_url AS value
           FROM repositories
          WHERE slack_webhook_url IS NOT NULL
            AND slack_webhook_url <> ''
            AND left(slack_webhook_url, 3) <> 'v1:'
          ORDER BY id
          LIMIT $1
          FOR UPDATE SKIP LOCKED`,
        [batchSize]
      );
      for (const row of result.rows) {
        if (!isEncryptedSecret(row.value)) {
          await client.query("UPDATE repositories SET slack_webhook_url = $2 WHERE id = $1", [row.id, encryptSecret(row.value)]);
        }
      }
      await client.query("COMMIT");
      if (result.rowCount === 0) break;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
