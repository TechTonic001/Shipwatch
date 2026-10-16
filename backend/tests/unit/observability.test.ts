import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn()
}));

vi.mock("../../src/db/pool.js", () => ({
  pool: { query: mocks.query }
}));

import { getOperationalStats } from "../../src/services/observability.js";

describe("operational statistics", () => {
  beforeEach(() => mocks.query.mockReset());

  it("uses database percentiles and exposes queue, retry, suppression, and lock-loss data", async () => {
    mocks.query.mockResolvedValue({
      rows: [{
        generatedAt: new Date("2026-10-16T10:00:00.000Z"),
        queueDepthByStatus: { received: 2, dead: 1 },
        oldestPendingDeliveryAgeSeconds: 120,
        deadDeliveries: 1,
        deadAlerts: 2,
        alertBacklog: 3,
        p50: 1.5,
        p95: 4.5,
        p99: 9.5,
        retried: 2,
        retryTotal: 10,
        suppressedAlerts: 4,
        lockLostCount: 5
      }]
    });

    await expect(getOperationalStats()).resolves.toEqual({
      generatedAt: "2026-10-16T10:00:00.000Z",
      queueDepthByStatus: {
        received: 2, processing: 0, failed: 0, dead: 1, processed: 0, ignored: 0
      },
      oldestPendingDeliveryAgeSeconds: 120,
      deadDeliveries: 1,
      deadAlerts: 2,
      alertBacklog: 3,
      processingLatencySeconds: { p50: 1.5, p95: 4.5, p99: 9.5 },
      retryRate: { retried: 2, total: 10, value: 0.2 },
      suppressedAlerts: 4,
      lockLostCount: 5
    });
    const [statement] = mocks.query.mock.calls[0] as [string];
    expect(statement).toContain("percentile_cont(0.50)");
    expect(statement).toContain("processed_at >= now() - interval '1 hour'");
  });
});
