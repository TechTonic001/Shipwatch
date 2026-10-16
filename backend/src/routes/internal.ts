  import { randomUUID, timingSafeEqual } from "node:crypto";

  import { Router, type Response } from "express";

  import { env } from "../config/env.js";
  import { logger } from "../lib/logger.js";
  import { processBatch } from "../services/worker.js";
  import { dispatchAlerts } from "../services/alertDispatcher.js";
  import { reconcileRepositories } from "../services/reconcile.js";
  import { pruneRateLimits } from "../services/rateLimit.js";
  import { getOperationalStats } from "../services/observability.js";
  import { evaluateOperatorAlerts } from "../services/operatorAlerts.js";

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
    if (provided.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(provided, expectedBuffer);
  };

  const sweep = async (authorization: string | undefined, res: Response): Promise<void> => {
    if (!cronGuard(authorization)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const requestId = randomUUID();
    const startedAt = Date.now();
    const summary = await processBatch({ limit: 20, deadlineMs: 15_000 });
    const alerts = await dispatchAlerts({ limit: 20, deadlineMs: 5_000 });
    const reconciliation = await reconcileRepositories();
    await pruneRateLimits();
    const stats = await getOperationalStats();
    await evaluateOperatorAlerts(stats);
    logger.info({
      event: "sweep",
      outcome: "completed",
      durationMs: Date.now() - startedAt,
      requestId,
      deliveryId: null
    }, "internal sweep completed");
    res.status(200).json({
      ok: true,
      ...summary,
      alertsSent: alerts.sent,
      alertsFailed: alerts.failed,
      alertsDead: alerts.dead,
      alertsSuppressed: alerts.suppressedSkipped,
      stats,
      reconciliation
    });
  };

  internalRouter.post("/api/internal/sweep", async (req, res, next) => {
    try {
      await sweep(req.header("authorization"), res);
    } catch (error) {
      next(error);
    }
  });

  // Vercel Cron invokes the configured path with GET.
  internalRouter.get("/api/internal/sweep", async (req, res, next) => {
    try {
      await sweep(req.header("authorization"), res);
    } catch (error) {
      next(error);
    }
  });

  internalRouter.get("/api/internal/stats", async (req, res, next) => {
    if (!cronGuard(req.header("authorization"))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(await getOperationalStats());
    } catch (error) {
      next(error);
    }
  });