import { timingSafeEqual } from "node:crypto";

import { Router, type Response } from "express";

import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { processBatch } from "../services/worker.js";
import { dispatchAlerts } from "../services/alertDispatcher.js";

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
  const alerts = await dispatchAlerts({ limit: 20, deadlineMs: 5_000 });
  const deadCounts = await pool.query<{
    deadDeliveries: number;
    deadAlerts: number;
    oldestPendingAlertAgeSeconds: number | null;
  }>(
    `SELECT
       (SELECT count(*)::int FROM webhook_deliveries WHERE status = 'dead') AS "deadDeliveries",
       (SELECT count(*)::int FROM alerts WHERE status = 'dead') AS "deadAlerts",
       (SELECT EXTRACT(EPOCH FROM (now() - min(created_at)))::int
          FROM alerts WHERE status = 'pending') AS "oldestPendingAlertAgeSeconds"`
  );
  res.status(200).json({
    ok: true,
    ...summary,
    alertsSent: alerts.sent,
    alertsFailed: alerts.failed,
    alertsDead: alerts.dead,
    alertsSuppressed: alerts.suppressedSkipped,
    ...deadCounts.rows[0]
  });
};

internalRouter.post("/api/internal/sweep", async (req, res) => {
  await sweep(req.header("authorization"), res);
});

// Vercel Cron invokes the configured path with GET.
internalRouter.get("/api/internal/sweep", async (req, res) => {
  await sweep(req.header("authorization"), res);
});