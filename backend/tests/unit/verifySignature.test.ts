import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { verifyGithubSignature } from "../../src/middleware/verifySignature.js";
import { env } from "../../src/config/env.js";
import { sign } from "../helpers/sign.js";

const secret = env.GITHUB_WEBHOOK_SECRET;
const body = Buffer.from('{"action": "completed"}');

process.env.DATABASE_URL = "postgres://user:password@example.com/db";
process.env.GITHUB_WEBHOOK_SECRET = secret;
process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/test";
process.env.CRON_SECRET = "test-cron";
process.env.NODE_ENV = "test";

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

function run(signature: string | undefined, payload = body) {
  const res = response();
  const next = vi.fn();
  const headers = new Map([
    ["x-hub-signature-256", signature],
    ["x-github-delivery", "550e8400-e29b-41d4-a716-446655440000"],
    ["x-github-event", "workflow_run"]
  ]);
  verifyGithubSignature(
    { body: payload, header: (name: string) => headers.get(name) } as never,
    res as never,
    next
  );
  return { res, next };
}

describe("verifyGithubSignature", () => {
  it("passes a valid signature", () => {
    expect(run(sign(body, secret)).next).toHaveBeenCalledOnce();
  });

  it("rejects a tampered payload with a valid-looking signature", () => {
    const tampered = Buffer.from('{"action":"completed"}');
    const result = run(sign(body, secret), tampered);
    expect(result.res.status).toHaveBeenCalledWith(401);
    expect(result.res.json).toHaveBeenCalledWith({ error: "invalid signature" });
    expect(result.next).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong secret", sign(body, `${secret}-wrong`), body],
    ["missing header", undefined, body],
    ["missing prefix", createHmac("sha256", secret).update(body).digest("hex"), body],
    ["wrong length", "sha256=short", body],
    ["non-hex", `sha256=${"z".repeat(64)}`, body]
  ])("rejects %s", (_name, signature, payload) => {
    const result = run(signature, payload);
    expect(result.res.status).toHaveBeenCalledWith(401);
    expect(result.res.json).toHaveBeenCalledWith({ error: "invalid signature" });
    expect(result.next).not.toHaveBeenCalled();
  });

  it("verifies exact raw bytes including whitespace", () => {
    const raw = Buffer.from('{\n  "action": "completed"\n}');
    const sameBytes = sign(raw, secret);
    const result = run(sameBytes, raw);
    expect(result.next).toHaveBeenCalledOnce();
  });

  it("does not throw on an invalid-length signature", () => {
    const res = response();
    const next = vi.fn();
    const headers = new Map([
      ["x-hub-signature-256", "sha256=short"],
      ["x-github-delivery", "550e8400-e29b-41d4-a716-446655440000"],
      ["x-github-event", "workflow_run"]
    ]);

    expect(() => {
      verifyGithubSignature(
        { body, header: (name: string) => headers.get(name) } as never,
        res as never,
        next
      );
    }).not.toThrow();

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "invalid signature" });
    expect(next).not.toHaveBeenCalled();
  });
});
