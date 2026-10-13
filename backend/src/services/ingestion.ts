import { pool } from "../db/pool.js";

export type GithubDelivery = {
  deliveryId: string;
  eventName: string;
  payload: string;
};

export async function insertDelivery(delivery: GithubDelivery): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO webhook_deliveries (delivery_id, event_name, payload)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (delivery_id) DO NOTHING`,
    [delivery.deliveryId, delivery.eventName, delivery.payload]
  );
  return result.rowCount === 1;
}
