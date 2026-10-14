import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn()
}));

vi.mock("../../src/db/pool.js", () => ({
  pool: { query: mocks.query }
}));

import { insertDelivery } from "../../src/services/ingestion.js";

describe("insertDelivery", () => {
  beforeEach(() => {
    mocks.query.mockReset();
  });

  it("uses an idempotent delivery conflict clause", async () => {
    mocks.query.mockResolvedValue({ rowCount: 1 });

    await expect(
      insertDelivery({
        deliveryId: "550e8400-e29b-41d4-a716-446655440000",
        eventType: "workflow_run",
        action: "requested",
        githubRepoId: 123,
        payload: { action: "requested" }
      })
    ).resolves.toBe(true);

    expect(mocks.query.mock.calls[0][0]).toContain("ON CONFLICT (delivery_id) DO NOTHING");
  });
});
