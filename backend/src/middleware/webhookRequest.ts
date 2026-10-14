import type { Request } from "express";

import { logger } from "../lib/logger.js";

type WebhookLog = {
  deliveryId: string | null;
  event: string | null;
  action: string | null;
  outcome: string;
};

const startedAt = new WeakMap<Request, number>();

export function startWebhookRequest(req: Request): void {
  startedAt.set(req, Date.now());
}

export function logWebhookRequest(req: Request, log: WebhookLog): void {
  logger.info({
    deliveryId: log.deliveryId,
    event: log.event,
    action: log.action,
    outcome: log.outcome,
    durationMs: Date.now() - (startedAt.get(req) ?? Date.now())
  }, "github webhook request");
}
