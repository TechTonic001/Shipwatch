import { Router, type Request, type Response } from "express";

import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { env } from "../config/env.js";
import { decodeCursor, getMetrics, listIncidents, listRepositories, listRuns, repositoryExists } from "../services/metrics.js";
import { allowRateLimit } from "../services/rateLimit.js";

export const metricsRouter = Router();

const repoParams = z.object({ id: z.coerce.number().int().positive() }).strict();
const windowQuery = z.object({ window: z.enum(["7d", "30d"]).default("7d") }).strict();
const pageQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().min(1).optional() }).strict();
const runCursor = z.object({ startedAt: z.string().datetime(), id: z.number().int().positive() }).strict();
const incidentCursor = z.object({ openedAt: z.string().datetime(), id: z.string().uuid() }).strict();

function authorized(req: Request, res: Response): boolean {
  const value = req.header("authorization");
  const expected = Buffer.from(env.DASHBOARD_READ_TOKEN);
  const actual = value?.startsWith("Bearer ") ? Buffer.from(value.slice(7)) : Buffer.alloc(0);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

metricsRouter.use("/api", async (req, res, next) => {
  const origin = req.header("origin");
  if (origin && origin !== env.FRONTEND_ORIGIN) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", env.FRONTEND_ORIGIN);
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.sendStatus(204);
    return;
  }
  if (!authorized(req, res)) return;
  try {
    if (!(await allowRateLimit("dashboard", req.ip ?? req.socket.remoteAddress ?? "unknown", 120, 60))) {
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }
  } catch (error) {
    next(error);
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", env.FRONTEND_ORIGIN);
  res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=30");
  next();
});

metricsRouter.get("/api/repos", async (_req, res, next) => {
  try { res.json(await listRepositories()); } catch (error) { next(error); }
});

metricsRouter.get("/api/repos/:id/metrics", async (req, res, next) => {
  try {
    const params = repoParams.parse(req.params);
    const query = windowQuery.parse(req.query);
    if (!(await repositoryExists(params.id))) { res.status(404).json({ error: "Repository not found" }); return; }
    res.json(await getMetrics(params.id, query.window));
  } catch (error) { next(error); }
});

metricsRouter.get("/api/repos/:id/runs", async (req, res, next) => {
  try {
    const params = repoParams.parse(req.params);
    const query = pageQuery.parse(req.query);
    if (!(await repositoryExists(params.id))) { res.status(404).json({ error: "Repository not found" }); return; }
    const cursor = query.cursor ? runCursor.parse(decodeCursor<unknown>(query.cursor)) : undefined;
    res.json(await listRuns(params.id, query.limit, cursor));
  } catch (error) { next(error); }
});

metricsRouter.get("/api/repos/:id/incidents", async (req, res, next) => {
  try {
    const params = repoParams.parse(req.params);
    const query = pageQuery.extend({ status: z.enum(["open", "resolved"]).optional() }).parse(req.query);
    if (!(await repositoryExists(params.id))) { res.status(404).json({ error: "Repository not found" }); return; }
    const cursor = query.cursor ? incidentCursor.parse(decodeCursor<unknown>(query.cursor)) : undefined;
    res.json(await listIncidents(params.id, query.status, query.limit, cursor));
  } catch (error) { next(error); }
});
