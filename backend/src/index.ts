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
    logger.info({ port: env.PORT }, "Shipwatch backend listening");
    void verifyDatabaseConnection();
  });
}

export default app;
