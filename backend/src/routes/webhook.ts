import { Router } from "express";
import { waitUntil } from "@vercel/functions";

import { insertDelivery } from "../services/ingestion.js";

export const webhookRouter = Router();

webhookRouter.post("/api/webhooks/github", async (req, res, next) => {
  try {
    const deliveryId = req.header("x-github-delivery");
    const eventName = req.header("x-github-event");
    if (!deliveryId || !eventName || !Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: "Missing GitHub delivery headers or raw body" });
      return;
    }

    const payload = req.body.toString("utf8");
    try {
      JSON.parse(payload);
    } catch {
      res.status(400).json({ error: "Invalid JSON payload" });
      return;
    }

    const inserted = await insertDelivery({ deliveryId, eventName, payload });
    res.status(200).json({ accepted: true, duplicate: !inserted });

    waitUntil(Promise.resolve(inserted));
  } catch (error) {
    next(error);
  }
});
