import { timingSafeEqual } from "node:crypto";

import { Router, type Response } from "express";

import { env } from "../config/env.js";
import { processBatch } from "../services/worker.js";

export const internalRouter = Router();

const cronGuard = (authorization: string | undefined): boolean => {
  if (!authorization) {
    return false;
  }

  const expected = "Bearer " + env.CRON_SECRET;
  if (authorization.length !== expected.length) {
    return false;
  }

  const provided = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);

  try {
    return timingSafeEqual(provided, expectedBuffer);
  } catch {
    return false;
  }
};

const sweep = async (authorization: string | undefined, res: Response): Promise<void> => {
  if (!cronGuard(authorization)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const summary = await processBatch({ limit: 20, deadlineMs: 15_000 });
  res.status(200).json({ ok: true, ...summary });
};

internalRouter.post("/api/internal/sweep", async (req, res) => {
  await sweep(req.header("authorization"), res);
});

// Vercel Cron invokes the configured path with GET.
internalRouter.get("/api/internal/sweep", async (req, res) => {
  await sweep(req.header("authorization"), res);
});