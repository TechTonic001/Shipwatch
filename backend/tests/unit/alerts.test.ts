import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAlert } from "../../src/services/alerts.js";

function clientWith(results: Array<{ rows?: unknown[]; rowCount?: number }>): {
  query: ReturnType<typeof vi.fn>;
} {
  const query = vi.fn();
  for (const result of results) query.mockResolvedValueOnce(result);
  return { query };
}

const input = {
  incidentId: "incident-2",
  repoId: 1,
  environment: "production",
  kind: "incident_opened" as const,
  payload: {
    repo: "org/repo",
    environment: "production",
    incidentId: "incident-2",
    openedAt: "2026-01-01T00:00:00.000Z"
  }
};

describe("alert debounce and ordering", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("defers cooldown alerts instead of suppressing them", async () => {
    const client = clientWith([
      { rows: [{ muted: false, cooldownMinutes: 10 }] },
      { rows: [{ previousTime: new Date("2026-01-01T00:00:00.000Z") }] },
      { rowCount: 1 }
    ]);

    await expect(createAlert({ client: client as never, ...input })).resolves.toBe(true);
    const insert = client.query.mock.calls[2];
    expect(insert[0]).toContain("COALESCE($9, now())");
    expect(insert[1]?.[6]).toBe("pending");
    expect(insert[1]?.[8]).toEqual(new Date("2026-01-01T00:10:00.000Z"));
  });

  it("keeps recovery pending when the opened alert is pending", async () => {
    const client = clientWith([
      { rows: [{ muted: false, cooldownMinutes: 10 }] },
      { rows: [{ status: "pending" }] },
      { rowCount: 1 }
    ]);

    await expect(
      createAlert({
        client: client as never,
        ...input,
        kind: "incident_resolved",
        payload: { ...input.payload, resolvedAt: "2026-01-01T00:01:00.000Z" }
      })
    ).resolves.toBe(true);
    expect(client.query.mock.calls[2][1]?.[6]).toBe("pending");
  });

  it("suppresses recovery only when the opened alert is terminal suppressed/dead", async () => {
    const client = clientWith([
      { rows: [{ muted: false, cooldownMinutes: 10 }] },
      { rows: [{ status: "dead" }] },
      { rowCount: 1 }
    ]);

    await expect(
      createAlert({
        client: client as never,
        ...input,
        kind: "incident_resolved",
        payload: { ...input.payload, resolvedAt: "2026-01-01T00:01:00.000Z" }
      })
    ).resolves.toBe(true);
    expect(client.query.mock.calls[2][1]?.[6]).toBe("suppressed");
    expect(client.query.mock.calls[2][1]?.[7]).toContain("opened_alert_terminal");
  });
});
