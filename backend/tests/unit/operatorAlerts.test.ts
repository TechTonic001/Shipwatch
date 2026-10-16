import { createServer, type Server } from "node:http";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn()
}));

vi.mock("../../src/db/pool.js", () => ({
  pool: { query: mocks.query }
}));
import { env } from "../../src/config/env.js";
import { dispatchOperatorAlerts } from "../../src/services/operatorAlerts.js";

describe("operator alert delivery", () => {
  beforeEach(() => {
    mocks.query.mockReset();
  });

  it("delivers a claimed event to a local fake Slack server and marks it sent", async () => {
    const lockedAt = new Date("2026-10-16T10:00:00.000Z");
    const messages: string[] = [];
    const server: Server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { text: string };
      messages.push(body.text);
      response.writeHead(200);
      response.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Fake Slack server did not bind");
    env.OPERATOR_SLACK_WEBHOOK_URL = `http://127.0.0.1:${address.port}/slack`;
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
    try {
      await dispatchOperatorAlerts();
      expect(messages).toEqual(["Shipwatch operator alert: dead deliveries."]);
      expect(mocks.query.mock.calls[1]?.[0]).toContain("status = 'sent'");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      env.OPERATOR_SLACK_WEBHOOK_URL = undefined;
    }
  });
});
