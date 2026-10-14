import { createHmac, timingSafeEqual } from "node:crypto";

import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { logWebhookRequest } from "./webhookRequest.js";

export const verifyGithubSignature: RequestHandler = (req, res, next) => {
  const signatureHeader = req.header("x-hub-signature-256");
  const body = req.body;

  if (!signatureHeader?.startsWith("sha256=") || !Buffer.isBuffer(body)) {
    logWebhookRequest(req, {
      deliveryId: req.header("x-github-delivery") ?? null,
      event: req.header("x-github-event") ?? null,
      action: null,
      outcome: "invalid_signature"
    });
    res.status(401).json({ error: "invalid signature" });
    return;
  }

  const receivedSignature = signatureHeader.slice("sha256=".length);
  const expectedSignature = createHmac("sha256", env.GITHUB_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  const receivedBytes = Buffer.from(receivedSignature, "hex");
  const expectedBytes = Buffer.from(expectedSignature, "hex");

  if (
    receivedSignature.length !== expectedSignature.length ||
    receivedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(receivedBytes, expectedBytes)
  ) {
    logWebhookRequest(req, {
      deliveryId: req.header("x-github-delivery") ?? null,
      event: req.header("x-github-event") ?? null,
      action: null,
      outcome: "invalid_signature"
    });
    res.status(401).json({ error: "invalid signature" });
    return;
  }

  next();
};
