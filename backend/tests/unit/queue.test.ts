import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn()
}));

vi.mock("../../src/db/pool.js", () => ({
  pool: { query: mocks.query }
}));

import { claimBatch, markProcessed } from "../../src/services/queue.js";

describe("queue locking contracts", () => {
  beforeEach(() => {
    mocks.query.mockReset();
  });

  it("claims rows with PostgreSQL row locking and skip locked", async () => {
    mocks.query.mockResolvedValue({ rows: [] });

    await expect(claimBatch(20)).resolves.toEqual([]);
    expect(mocks.query.mock.calls[0][0]).toContain("FOR UPDATE SKIP LOCKED");
  });

  it("marks a row only when its processing claim still owns the lock", async () => {
    mocks.query.mockResolvedValue({ rowCount: 1 });

    await expect(
      markProcessed("550e8400-e29b-41d4-a716-446655440000", new Date())
    ).resolves.toBe(true);
    expect(mocks.query.mock.calls[0][0]).toContain("locked_at = $2");
  });
});
