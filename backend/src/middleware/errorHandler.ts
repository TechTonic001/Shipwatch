import type { ErrorRequestHandler } from "express";

import { logger } from "../lib/logger.js";
import { logWebhookRequest } from "./webhookRequest.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error?.type === "entity.too.large") {
    if (req.path === "/api/webhooks/github") {
      logWebhookRequest(req, {
        deliveryId: req.header("x-github-delivery") ?? null,
        event: req.header("x-github-event") ?? null,
        action: null,
        outcome: "bad_request"
      });
    }
    res.status(413).json({ error: "payload too large" });
    return;
  }
  logger.error({ error }, "Unhandled request error");
  res.status(500).json({ error: "Internal server error" });
};
