import type { RequestHandler } from "express";

import { logWebhookRequest } from "./webhookRequest.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const validateWebhookHeaders: RequestHandler = (req, res, next) => {
  const deliveryId = req.header("x-github-delivery") ?? null;
  const event = req.header("x-github-event") ?? null;

  if (!deliveryId || !uuidPattern.test(deliveryId) || !event) {
    logWebhookRequest(req, { deliveryId, githubEvent: event, action: null, outcome: "bad_request" });
    res.status(400).json({ error: "invalid webhook headers" });
    return;
  }

  next();
};
