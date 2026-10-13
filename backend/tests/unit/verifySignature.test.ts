import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

const secret = "test-secret";
const body = Buffer.from('{"action":"completed"}');
process.env.DATABASE_URL = "postgres://user:password@example.com/db";
process.env.GITHUB_WEBHOOK_SECRET = secret;
process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/test";
process.env.CRON_SECRET = "test-cron";
process.env.NODE_ENV = "test";
const { verifyGithubSignature } = await import("../../src/middleware/verifySignature.js");

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  };
}

function signature(payload: Buffer): string {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

describe("verifyGithubSignature", () => {
  it("accepts a valid signature over the raw body", () => {
    const next = vi.fn();
    const res = response();

    verifyGithubSignature(
      { body, header: () => signature(body) } as never,
      res as never,
      next
    );

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a signature with the wrong length without comparing it", () => {
    const next = vi.fn();
    const res = response();

    verifyGithubSignature(
      { body, header: () => "sha256=short" } as never,
      res as never,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects requests that do not preserve the raw body", () => {
    const next = vi.fn();
    const res = response();

    verifyGithubSignature(
      { body: { action: "completed" }, header: () => signature(body) } as never,
      res as never,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
