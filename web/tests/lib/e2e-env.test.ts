import { describe, expect, it } from "vitest";
import { resolveE2eEnv } from "../../e2e/support/env";

describe("resolveE2eEnv", () => {
  it("varsayılan", () => expect(resolveE2eEnv({})).toEqual({ dbName: "eventflow_e2e", port: 3100, prodPort: 3101 }));

  it("şerit değerleri", () =>
    expect(resolveE2eEnv({ E2E_DB_NAME: "eventflow_e2e_f2_a", E2E_PORT: "3122", E2E_PROD_PORT: "3123" })).toEqual({
      dbName: "eventflow_e2e_f2_a",
      port: 3122,
      prodPort: 3123,
    }));

  it.each([
    [{ E2E_DB_NAME: "eventflow_test" }, /E2E_DB_NAME/],
    [{ E2E_DB_NAME: `eventflow_e2e_${"a".repeat(50)}` }, /E2E_DB_NAME/],
    [{ E2E_PORT: "80" }, /E2E_PORT/],
    [{ E2E_PORT: "abc" }, /E2E_PORT/],
    [{ E2E_PROD_PORT: "70000" }, /E2E_PROD_PORT/],
    [{ E2E_PORT: "3122", E2E_PROD_PORT: "3122" }, /aynı olamaz/],
  ])("geçersiz %o", (env, re) => expect(() => resolveE2eEnv(env)).toThrow(re));
});
