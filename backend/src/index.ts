import express from "express";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { rawWebhookBody } from "./middleware/rawBody.js";
import { verifyGithubSignature } from "./middleware/verifySignature.js";
import { healthRouter } from "./routes/health.js";
import { internalRouter } from "./routes/internal.js";
import { metricsRouter } from "./routes/metrics.js";
import { webhookRouter } from "./routes/webhook.js";

const app = express();

app.use("/api/webhooks/github", rawWebhookBody, verifyGithubSignature);
app.use(express.json());
app.use(healthRouter);
app.use(webhookRouter);
app.use(metricsRouter);
app.use(internalRouter);
app.use(errorHandler);

if (env.NODE_ENV === "development") {
  app.listen(env.PORT, () => {
    console.log(`Shipwatch backend listening on port ${env.PORT}`);
  });
}

export default app;
