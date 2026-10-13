import request from "supertest";
import { describe, expect, it } from "vitest";

process.env.DATABASE_URL = "postgres://user:password@example.com/db";
process.env.GITHUB_WEBHOOK_SECRET = "test-secret";
process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/test";
process.env.CRON_SECRET = "test-cron";
process.env.NODE_ENV = "test";

const { default: app } = await import("../../src/index.js");

describe("health routes", () => {
  it("returns a healthy status", async () => {
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
