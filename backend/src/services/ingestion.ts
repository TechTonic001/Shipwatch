import { pool } from "../db/pool.js";

export type GithubDelivery = {
  deliveryId: string;
  eventType: string;
  action: string | null;
  githubRepoId: number | null;
  payload: Record<string, unknown>;
};

export async function insertDelivery(delivery: GithubDelivery): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO webhook_deliveries
      (delivery_id, event_type, action, github_repo_id, payload, status)
     VALUES ($1, $2, $3, $4, $5::jsonb, 'received')
     ON CONFLICT (delivery_id) DO NOTHING
     RETURNING delivery_id`,
    [
      delivery.deliveryId,
      delivery.eventType,
      delivery.action,
      delivery.githubRepoId,
      JSON.stringify(delivery.payload)
    ]
  );
  return result.rowCount === 1;
}
