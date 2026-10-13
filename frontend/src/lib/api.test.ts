import { describe, expect, it, vi } from "vitest";

import { apiFetch } from "./api";

describe("apiFetch", () => {
  it("returns decoded JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"data":[]}')));
    await expect(apiFetch("/api/metrics")).resolves.toEqual({ data: [] });
  });

  it("throws on failed responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(apiFetch("/api/metrics")).rejects.toThrow("503");
  });
});
