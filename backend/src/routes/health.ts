import { Router } from "express";

import { pool } from "../db/pool.js";
import { neonServices } from "../config/neon.js";

export const healthRouter = Router();

healthRouter.get("/healthz", (_req, res) => {
  res.status(200).json({
    status: "ok",
    services: {
      neonAuthConfigured: Boolean(neonServices.auth.baseUrl && neonServices.auth.jwksUrl),
      neonFunctionConfigured: Boolean(neonServices.functions.helloBaseUrl)
    }
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
