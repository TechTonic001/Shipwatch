export type GithubDelivery = {
  deliveryId: string;
  eventName: string;
  payload: unknown;
};

export async function insertDelivery(_delivery: GithubDelivery): Promise<void> {
  // TODO: Insert into webhook_deliveries with ON CONFLICT (delivery_id) DO NOTHING.
}
