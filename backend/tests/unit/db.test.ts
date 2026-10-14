import { describe, expect, it } from "vitest";

import { assertSafeTestDatabaseUrl } from "../helpers/db.js";

describe("test database safety guard", () => {
  it("rejects a production-looking database URL", () => {
    expect(() => assertSafeTestDatabaseUrl("postgres://user:pass@host/prod", undefined)).toThrow(
      /non-test database/
    );
  });

  it("rejects the application database URL even when it looks like a test URL", () => {
    const url = "postgres://user:pass@host/shipwatch_test";
    expect(() => assertSafeTestDatabaseUrl(url, url)).toThrow(/equals DATABASE_URL/);
  });

  it("allows a database URL containing test", () => {
    expect(() =>
      assertSafeTestDatabaseUrl("postgres://user:pass@host/shipwatch_test", "postgres://user:pass@host/shipwatch")
    ).not.toThrow();
  });
});
