import { describe, expect, it } from "vitest";
import { parseEnv } from "@/env";

const valid = {
  DATABASE_URL: "postgres://postgres@localhost:54329/eventflow_test",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  UPLOAD_DIR: "./uploads",
  NODE_ENV: "test",
};

describe("parseEnv", () => {
  it("geçerli girdiyi kabul eder", () => {
    const parsed = parseEnv(valid);
    expect(parsed.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(parsed.NODE_ENV).toBe("test");
  });

  it("31 karakterlik BETTER_AUTH_SECRET reddedilir", () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: "a".repeat(31) })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("DATABASE_URL eksikse hata mesajı değişken adını içerir", () => {
    const { DATABASE_URL: _omitted, ...rest } = valid;
    void _omitted;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });
});
