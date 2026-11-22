import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/features/auth/next-path";

describe("safeNextPath", () => {
  it.each([
    ["/events", "/events"],
    ["/events/123?tab=a#top", "/events/123?tab=a#top"],
    ["/admin/users", "/admin/users"],
  ])("aynı kaynaktaki göreli yol %s korunur", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  it.each([
    null,
    "",
    "events",
    "//evil.com",
    "//evil.com/path",
    "/\\evil.com",
    "/\\/evil.com",
    "https://evil.com",
    "http://evil.com/x",
    "javascript:alert(1)",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
    " //evil.com",
    "\\\\evil.com",
  ])("%j güvenli olmadığı için / döner", (raw) => {
    expect(safeNextPath(raw)).toBe("/");
  });
});
