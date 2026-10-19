import { describe, expect, it } from "vitest";

import { scheduleRunsAtMostDaily } from "../../../scripts/check-vercel-crons.js";

describe("Vercel cron Hobby policy", () => {
  it("allows a fixed daily schedule", () => {
    expect(scheduleRunsAtMostDaily("0 3 * * *")).toBe(true);
  });

  it("rejects a schedule that runs every five minutes", () => {
    expect(scheduleRunsAtMostDaily("*/5 * * * *")).toBe(false);
  });

  it("rejects multiple fixed times per day", () => {
    expect(scheduleRunsAtMostDaily("0 3,15 * * *")).toBe(false);
  });

  it("rejects malformed cron expressions", () => {
    expect(scheduleRunsAtMostDaily("60 3 * * *")).toBe(false);
  });
});
