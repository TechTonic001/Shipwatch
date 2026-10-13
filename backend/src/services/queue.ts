export type QueueDelivery = { id: string; attempts: number };

export async function claimBatch(_limit: number): Promise<QueueDelivery[]> {
  // TODO: Claim rows in one transaction with FOR UPDATE SKIP LOCKED.
  return [];
}

export async function markProcessed(_id: string): Promise<void> {
  // TODO: Mark the claimed delivery processed.
}

export async function markFailed(_id: string, _error: Error): Promise<void> {
  // TODO: Increment attempts, apply exponential backoff, and mark dead at attempts >= 5.
}
