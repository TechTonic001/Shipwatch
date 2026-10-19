import { Router } from "express";

import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "shipwatch-backend",
    sha: env.BUILD_SHA,
    env: env.NODE_ENV
  });
});

healthRouter.get("/healthz", (_req, res) => {
  res.status(200).json({
    status: "ok",
    sha: env.BUILD_SHA
  });
});

healthRouter.get("/api/version", (_req, res) => {
  res.status(200).json({
    sha: env.BUILD_SHA,
    env: env.NODE_ENV
  });
});

healthRouter.get("/readyz", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ready" });
  } catch (error) {
    next(error);
  }
});
