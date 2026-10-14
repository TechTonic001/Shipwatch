import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn()
}));

vi.mock("../../src/services/alerts.js", () => ({
  createAlert: vi.fn().mockResolvedValue(true)
}));

import { evaluateIncidentTransition } from "../../src/services/incidents.js";
import { createAlert } from "../../src/services/alerts.js";

describe("incident state machine SQL contracts", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    vi.mocked(createAlert).mockClear();
  });

  it("checks that a failure is the latest production deployment in SQL", async () => {
    mocks.query.mockResolvedValue({ rows: [{ id: "incident-id" }], rowCount: 1 });
    await evaluateIncidentTransition(mocks as never, {
      id: 10,
      repoId: 20,
      repoName: "org/repo",
      environment: "production",
      isProduction: true,
      state: "failure",
      createdAt: new Date("2026-01-01T00:00:00Z")
    });
    expect(mocks.query.mock.calls[0][0]).toContain("NOT EXISTS");
    expect(mocks.query.mock.calls[0][0]).toContain("newer.created_at > current_deployment.created_at");
    expect(createAlert).toHaveBeenCalledOnce();
  });

  it("resolves only with the guarded newer deployment update", async () => {
    mocks.query.mockResolvedValue({
      rows: [{ id: "incident-id", openedAt: new Date("2026-01-01T00:00:00Z"), resolvedAt: new Date("2026-01-01T00:01:00Z") }],
      rowCount: 1
    });
    await evaluateIncidentTransition(mocks as never, {
      id: 11,
      repoId: 20,
      repoName: "org/repo",
      environment: "production",
      isProduction: true,
      state: "success",
      createdAt: new Date("2026-01-01T00:02:00Z")
    });
    expect(mocks.query.mock.calls[0][0]).toContain("status = 'open'");
    expect(mocks.query.mock.calls[0][0]).toContain("$4 > trigger_created_at");
    expect(createAlert).toHaveBeenCalledOnce();
  });
});
