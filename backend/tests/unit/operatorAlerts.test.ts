import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  send: vi.fn()
}));

vi.mock("../../src/db/pool.js", () => ({
  pool: { query: mocks.query }
}));
vi.mock("../../src/services/slack.js", () => ({
  sendSlackMessage: mocks.send
}));

import { env } from "../../src/config/env.js";
import { dispatchOperatorAlerts } from "../../src/services/operatorAlerts.js";

describe("operator alert delivery", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.send.mockReset();
    env.OPERATOR_SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/fake";
  });

  it("delivers a claimed firing event through the fake Slack transport and marks it sent", async () => {
    const lockedAt = new Date("2026-10-16T10:00:00.000Z");
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          id: "event-1",
          alertKey: "dead-deliveries",
          eventKind: "firing",
          message: "Shipwatch operator alert: dead deliveries.",
          lockedAt
        }]
      })
      .mockResolvedValueOnce({ rowCount: 1 });
    mocks.send.mockResolvedValue({ ok: true });

    await dispatchOperatorAlerts();

    expect(mocks.send).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/fake",
      "Shipwatch operator alert: dead deliveries."
    );
    expect(mocks.query.mock.calls[1]?.[0]).toContain("status = 'sent'");
  });
});
