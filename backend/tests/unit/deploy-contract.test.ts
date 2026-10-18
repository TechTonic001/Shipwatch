import request from "supertest";
import { describe, expect, it } from "vitest";

process.env.DATABASE_URL = "postgres://user:password@example.com/db";
process.env.GITHUB_WEBHOOK_SECRET = "test-secret";
process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/test";
process.env.CRON_SECRET = "test-cron";
process.env.FRONTEND_ORIGIN = "https://app.example.com";
process.env.NODE_ENV = "test";
process.env.BUILD_SHA = "build-sha-123";

const { default: app } = await import("../../src/index.js");

describe("deployment contract", () => {
  it("exposes the deployed version metadata", async () => {
    const response = await request(app).get("/api/version");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      sha: "build-sha-123",
      env: "test"
    });
  });
});
