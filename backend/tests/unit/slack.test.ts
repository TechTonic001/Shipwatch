import { afterEach, describe, expect, it, vi } from "vitest";

import { escapeSlackText, sendSlackMessage } from "../../src/services/slack.js";

describe("Slack sender", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects non-Slack hosts without making a request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(sendSlackMessage("https://evil.example/hook", "message")).resolves.toMatchObject({
      ok: false,
      retryable: false
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("handles rate limits using Retry-After", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 429, headers: { "Retry-After": "2" } })
    );
    await expect(sendSlackMessage("https://hooks.slack.com/services/test", "message")).resolves.toEqual({
      ok: false,
      retryable: true,
      retryAfterMs: 2000,
      reason: "Slack rate limited the webhook"
    });
  });

  it("does not allow Slack markup or mentions to pass through", () => {
    expect(escapeSlackText("<!channel> <repo>&")).toBe("&lt;!channel&gt; &lt;repo&gt;&amp;");
  });
});
