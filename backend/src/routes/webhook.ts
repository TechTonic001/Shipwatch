import { Router } from "express";

export const webhookRouter = Router();

webhookRouter.post("/api/webhooks/github", (_req, res) => {
  // TODO: Persist the delivery id with ON CONFLICT DO NOTHING, respond 200,
  // then schedule processing with waitUntil from @vercel/functions.
  res.status(200).json({ accepted: true });
});
