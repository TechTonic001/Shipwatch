import type { ErrorRequestHandler } from "express";

import { logger } from "../lib/logger.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  logger.error({ error }, "Unhandled request error");
  res.status(500).json({ error: "Internal server error" });
};
