import { describe, expect, it } from "vitest";

import { hasHttpFailures } from "../../scripts/replay.js";

describe("replay HTTP result", () => {
  it("accepts successful 2xx responses", () => {
    expect(hasHttpFailures([{ status: 200 }, { status: 201 }])).toBe(false);
  });

  it("fails when any response is outside 2xx", () => {
    expect(hasHttpFailures([{ status: 200 }, { status: 500 }])).toBe(true);
  });
});
