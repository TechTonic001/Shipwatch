import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sweepServices = vi.hoisted(() => ({
  processBatch: vi.fn(async () => ({ claimed: 0, processed: 0, failed: 0, dead: 0, ignored: 0, lockLost: 0, released: 0 })),
  dispatchAlerts: vi.fn(async () => ({ claimed: 0, sent: 0, failed: 0, dead: 0, suppressedSkipped: 0 })),
  reconcileRepositories: vi.fn(async () => ({ enabled: false, repositories: 0, changed: 0, stopped: false })),
  pruneRateLimits: vi.fn(async () => undefined),
  getOperationalStats: vi.fn(async () => ({
    generatedAt: "2026-01-01T00:00:00.000Z",
    queueDepthByStatus: {},
    oldestPendingDeliveryAgeSeconds: null,
    deadDeliveries: 0,
    deadAlerts: 0,
    alertBacklog: 0,
    processingLatencySeconds: { p50: null, p95: null, p99: null },
    retryRate: { retried: 0, total: 0, value: null },
    suppressedAlerts: 0,
    lockLostCount: 0
  })),
  evaluateOperatorAlerts: vi.fn(async () => undefined)
}));

vi.mock("../../src/services/worker.js", () => ({ processBatch: sweepServices.processBatch }));
vi.mock("../../src/services/alertDispatcher.js", () => ({ dispatchAlerts: sweepServices.dispatchAlerts }));
vi.mock("../../src/services/reconcile.js", () => ({ reconcileRepositories: sweepServices.reconcileRepositories }));
vi.mock("../../src/services/rateLimit.js", () => ({ pruneRateLimits: sweepServices.pruneRateLimits }));
vi.mock("../../src/services/observability.js", () => ({ getOperationalStats: sweepServices.getOperationalStats }));
vi.mock("../../src/services/operatorAlerts.js", () => ({ evaluateOperatorAlerts: sweepServices.evaluateOperatorAlerts }));

process.env.DATABASE_URL = "postgres://user:password@example.com/db";
process.env.GITHUB_WEBHOOK_SECRET = "test-secret";
process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/test";
process.env.DASHBOARD_READ_TOKEN = "test-dashboard-token";
process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_PATH = ".env.sweep-test-not-present";
delete process.env.CRON_SECRET;

const { default: app } = await import("../../src/index.js");
const { env } = await import("../../src/config/env.js");

beforeEach(() => {
  vi.clearAllMocks();
});

function sweepRequest(method: "get" | "post", authorization?: string) {
  const requestBuilder = request(app)[method]("/api/internal/sweep");
  return authorization ? requestBuilder.set("Authorization", authorization) : requestBuilder;
}

describe("internal sweep authorization", () => {
  it("rejects GET and POST when CRON_SECRET is missing", async () => {
    env.CRON_SECRET = undefined;

    const getResponse = await sweepRequest("get");
    const postResponse = await sweepRequest("post");

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
    expect(sweepServices.processBatch).not.toHaveBeenCalled();
  });

  it("accepts GET with the configured bearer token", async () => {
    env.CRON_SECRET = "test-cron";

    const response = await sweepRequest("get", "Bearer test-cron");

    expect(response.status).toBe(200);
    expect(sweepServices.processBatch).toHaveBeenCalledOnce();
  });

  it("accepts POST with the configured bearer token", async () => {
    env.CRON_SECRET = "test-cron";

    const response = await sweepRequest("post", "Bearer test-cron");

    expect(response.status).toBe(200);
    expect(sweepServices.processBatch).toHaveBeenCalledOnce();
  });
});
