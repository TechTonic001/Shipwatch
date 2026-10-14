import { createHmac, timingSafeEqual } from "node:crypto";

import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { logWebhookRequest } from "./webhookRequest.js";

const invalidSignature = (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]): void => {
  logWebhookRequest(req, {
    deliveryId: req.header("x-github-delivery") ?? null,
    event: req.header("x-github-event") ?? null,
    action: null,
    outcome: "invalid_signature"
  });
  res.status(401).json({ error: "invalid signature" });
};

export const verifyGithubSignature: RequestHandler = (req, res, next) => {
  const signatureHeader = req.header("x-hub-signature-256");
  const body = req.body;

  if (!Buffer.isBuffer(body) || typeof signatureHeader !== "string") {
    invalidSignature(req, res);
    return;
  }

  if (!signatureHeader.startsWith("sha256=")) {
    invalidSignature(req, res);
    return;
  }

  const receivedSignature = signatureHeader.slice("sha256=".length);
  if (!/^[0-9a-fA-F]+$/.test(receivedSignature)) {
    invalidSignature(req, res);
    return;
  }

  const expectedSignature = createHmac("sha256", env.GITHUB_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  const receivedBytes = Buffer.from(receivedSignature, "hex");
  const expectedBytes = Buffer.from(expectedSignature, "hex");

  if (
    receivedSignature.length !== expectedSignature.length ||
    receivedBytes.length !== expectedBytes.length ||
    receivedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(receivedBytes, expectedBytes)
  ) {
    invalidSignature(req, res);
    return;
  }

  next();
};
