import { Router } from "express";

export const metricsRouter = Router();

metricsRouter.get("/api/metrics", (_req, res) => {
  // TODO: Return deployment frequency, change failure rate, and MTTR.
  res.status(200).json({ data: [] });
});

metricsRouter.get("/api/runs", (_req, res) => {
  // TODO: Return paginated workflow and deployment runs.
  res.status(200).json({ data: [] });
});

metricsRouter.get("/api/incidents", (_req, res) => {
  // TODO: Return open and recently resolved incidents.
  res.status(200).json({ data: [] });
});
