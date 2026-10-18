import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { rawWebhookBody } from "./middleware/rawBody.js";
import { verifyGithubSignature } from "./middleware/verifySignature.js";
import { healthRouter } from "./routes/health.js";
import { internalRouter } from "./routes/internal.js";
import { metricsRouter } from "./routes/metrics.js";
import { webhookRouter } from "./routes/webhook.js";
import { logger } from "./lib/logger.js";
import { startWebhookRequest } from "./middleware/webhookRequest.js";
import { validateWebhookHeaders } from "./middleware/webhookHeaders.js";
import { verifyDatabaseConnection } from "./db/pool.js";

const app = express();
const allowedOrigins = new Set(env.FRONTEND_ORIGIN.split(",").map((value) => value.trim()).filter(Boolean));

app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "no-referrer" }
}));
const jsonParser = express.json({ limit: "100kb" });

app.use((req, res, next) => {
  if (req.path === "/api/webhooks/github") {
    return next();
  }

  const origin = req.header("origin");
  if (origin) {
    if (!allowedOrigins.has(origin)) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  }

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  return jsonParser(req, res, next);
});

app.use("/api/webhooks/github", startWebhookRequest, rawWebhookBody, validateWebhookHeaders, verifyGithubSignature);
app.use(healthRouter);
app.use(webhookRouter);
app.use(metricsRouter);
app.use(internalRouter);
app.use(errorHandler);

if (env.NODE_ENV === "development") {
  app.listen(env.PORT, () => {
    logger.info({
      event: "backend_start",
      outcome: "listening",
      durationMs: 0,
      requestId: null,
      deliveryId: null,
      port: env.PORT
    }, "Shipwatch backend listening");
    void verifyDatabaseConnection();
  });
}

export default app;
