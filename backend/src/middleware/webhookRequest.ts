import { randomUUID } from "node:crypto";
import type { Request } from "express";

import { logger } from "../lib/logger.js";

type WebhookLog = {
  deliveryId: string | null;
  githubEvent: string | null;
  action: string | null;
  outcome: string;
};

const requestState = new WeakMap<Request, { startedAt: number; requestId: string }>();

export function startWebhookRequest(req: Request): void {
  requestState.set(req, { startedAt: Date.now(), requestId: randomUUID() });
}

export function logWebhookRequest(req: Request, log: WebhookLog): void {
  const state = requestState.get(req);
  logger.info({
    event: "github_webhook",
    deliveryId: log.deliveryId,
    githubEvent: log.githubEvent,
    action: log.action,
    outcome: log.outcome,
    durationMs: Date.now() - (state?.startedAt ?? Date.now()),
    requestId: state?.requestId ?? null
  }, "github webhook request");
}
