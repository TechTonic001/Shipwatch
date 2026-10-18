import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { incidentPageSchema, metricsResponseSchema, repositoryListSchema, runPageSchema, versionResponseSchema } from "../../../shared/contracts.js";

const metricsService = vi.hoisted(() => ({
  listRepositories: vi.fn(),
  repositoryExists: vi.fn(),
  getMetrics: vi.fn(),
  listRuns: vi.fn(),
  listIncidents: vi.fn(),
  decodeCursor: vi.fn((value: string) => JSON.parse(Buffer.from(value, "base64url").toString("utf8")))
}));

vi.mock("../../src/services/metrics.js", () => ({
  ...metricsService,
  listRepositories: metricsService.listRepositories,
  repositoryExists: metricsService.repositoryExists,
  getMetrics: metricsService.getMetrics,
  listRuns: metricsService.listRuns,
  listIncidents: metricsService.listIncidents,
  decodeCursor: metricsService.decodeCursor
}));

vi.mock("../../src/services/rateLimit.js", () => ({
  allowRateLimit: vi.fn(async () => true)
}));

process.env.DATABASE_URL = "postgres://user:password@example.com/db";
process.env.GITHUB_WEBHOOK_SECRET = "test-secret";
process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/test";
process.env.CRON_SECRET = "test-cron";
process.env.DASHBOARD_READ_TOKEN = "dashboard-read-token";
process.env.FRONTEND_ORIGIN = "https://app.example.com";
process.env.NODE_ENV = "test";
process.env.BUILD_SHA = "build-sha-123";

const { default: app } = await import("../../src/index.js");

describe("deployment contract", () => {
  it("matches the frontend response schemas for deploy metadata and dashboard data", async () => {
    metricsService.listRepositories.mockResolvedValue([
      { id: 1, fullName: "acme/shipwatch-api", productionEnvironment: "production" }
    ]);
    metricsService.repositoryExists.mockResolvedValue(true);
    metricsService.getMetrics.mockResolvedValue({
      window: "7d",
      generatedAt: "2025-01-01T00:00:00.000Z",
      deploymentFrequency: {
        total: 2,
        perDay: [
          { date: "2024-12-26", count: 1 },
          { date: "2024-12-27", count: 1 }
        ]
      },
      changeFailureRate: { value: 0.25, failed: 1, total: 4 },
      mttr: { medianSeconds: 1800, p90Seconds: 3600, resolvedCount: 2 },
      openIncidents: [{ id: "inc-1", environment: "production", openedAt: "2025-01-01T00:00:00.000Z", ageSeconds: 60 }]
    });
    metricsService.listRuns.mockResolvedValue({
      data: [{ id: 1, environment: "production", state: "success", startedAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z", sha: "abc123", deploymentUrl: "https://example.com" }],
      nextCursor: null
    });
    metricsService.listIncidents.mockResolvedValue({
      data: [{ id: "inc-1", environment: "production", status: "open", openedAt: "2025-01-01T00:00:00.000Z", resolvedAt: null, ageSeconds: 60 }],
      nextCursor: null
    });

    const versionResponse = await request(app).get("/api/version");
    expect(versionResponse.status).toBe(200);
    expect(versionResponse.body).toEqual({ sha: "build-sha-123", env: "test" });
    expect(versionResponseSchema.parse(versionResponse.body)).toEqual(versionResponse.body);

    const reposResponse = await request(app).get("/api/repos").set("Authorization", "Bearer dashboard-read-token");
    expect(reposResponse.status).toBe(200);
    expect(repositoryListSchema.parse(reposResponse.body)).toEqual(reposResponse.body);

    const metricsResponse = await request(app).get("/api/repos/1/metrics?window=7d").set("Authorization", "Bearer dashboard-read-token");
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponseSchema.parse(metricsResponse.body)).toEqual(metricsResponse.body);

    const runsResponse = await request(app).get("/api/repos/1/runs?limit=10").set("Authorization", "Bearer dashboard-read-token");
    expect(runsResponse.status).toBe(200);
    expect(runPageSchema.parse(runsResponse.body)).toEqual(runsResponse.body);

    const incidentsResponse = await request(app).get("/api/repos/1/incidents?limit=10").set("Authorization", "Bearer dashboard-read-token");
    expect(incidentsResponse.status).toBe(200);
    expect(incidentPageSchema.parse(incidentsResponse.body)).toEqual(incidentsResponse.body);
  });
});
