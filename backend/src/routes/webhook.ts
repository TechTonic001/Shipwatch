import { Router } from "express";

import { insertDelivery } from "../services/ingestion.js";
import { logWebhookRequest } from "../middleware/webhookRequest.js";

export const webhookRouter = Router();

webhookRouter.post("/api/webhooks/github", async (req, res) => {
  const deliveryId = req.header("x-github-delivery") ?? "";
  const eventType = req.header("x-github-event") ?? "";
  try {
    if (!Buffer.isBuffer(req.body)) {
      logWebhookRequest(req, { deliveryId, githubEvent: eventType, action: null, outcome: "bad_request" });
      res.status(400).json({ error: "raw body required" });
      return;
    }

    let payload: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(req.body.toString("utf8"));
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("payload must be an object");
      }
      payload = parsed as Record<string, unknown>;
    } catch {
      logWebhookRequest(req, { deliveryId, githubEvent: eventType, action: null, outcome: "bad_request" });
      res.status(400).json({ error: "Invalid JSON payload" });
      return;
    }

    const action = typeof payload.action === "string" ? payload.action : null;
    const repository = payload.repository;
    const githubRepoId =
      typeof repository === "object" &&
      repository !== null &&
      "id" in repository &&
      typeof repository.id === "number"
        ? repository.id
        : null;

    if (eventType === "ping") {
      logWebhookRequest(req, { deliveryId, githubEvent: eventType, action, outcome: "ignored" });
      res.status(200).json({ ok: true, event: "ping" });
      return;
    }

    const allowedEvents = new Set(["workflow_run", "deployment", "deployment_status"]);
    if (!allowedEvents.has(eventType)) {
      logWebhookRequest(req, { deliveryId, githubEvent: eventType, action, outcome: "ignored" });
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const delivery = { deliveryId, eventType, action, githubRepoId, payload };
    const inserted = await insertDelivery(delivery);
    logWebhookRequest(req, {
      deliveryId,
      githubEvent: eventType,
      action,
      outcome: inserted ? "ingested" : "duplicate"
    });
    res.status(200).json({ ok: true, duplicate: !inserted });
    // GitHub does not auto-redeliver failures; a later reconciliation job is planned.
    // TODO(phase-2): waitUntil(processBatch()) after persistence is complete.
  } catch {
    logWebhookRequest(req, {
      deliveryId,
      githubEvent: eventType,
      action: null,
      outcome: "persist_failed"
    });
    res.status(500).json({ error: "persist failed" });
  }
});
