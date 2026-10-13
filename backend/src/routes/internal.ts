import { Router, type Response } from "express";

import { env } from "../config/env.js";

export const internalRouter = Router();

const cronGuard = (authorization: string | undefined): boolean =>
  authorization === `Bearer ${env.CRON_SECRET}`;

const sweep = (authorization: string | undefined, res: Response): void => {
  if (!cronGuard(authorization)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // TODO: Re-claim stuck or failed deliveries and process a bounded batch.
  res.status(202).json({ accepted: true });
};

internalRouter.post("/api/internal/sweep", (req, res) => sweep(req.header("authorization"), res));
// Vercel Cron invokes the configured path with GET.
internalRouter.get("/api/internal/sweep", (req, res) => sweep(req.header("authorization"), res));
