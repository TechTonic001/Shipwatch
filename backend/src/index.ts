import express from "express";

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

const app = express();

app.use("/api/webhooks/github", startWebhookRequest, rawWebhookBody, validateWebhookHeaders, verifyGithubSignature);
app.use(express.json());
app.use(healthRouter);
app.use(webhookRouter);
app.use(metricsRouter);
app.use(internalRouter);
app.use(errorHandler);

if (env.NODE_ENV === "development") {
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "Shipwatch backend listening");
  });
}

export default app;
