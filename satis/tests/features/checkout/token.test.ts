import { describe, expect, it } from "vitest";
import { isOrderTokenShape } from "@/features/checkout/token";

describe("isOrderTokenShape", () => {
  it.each([
    ["b3JkZXItMQ.c2lnbmF0dXJlLXNpZ25hdHVyZQ", true],
    ["", false],
    ["tek-parca", false],
    ["a.b", false],
    ["../etc/passwd.aaaaaaaaaaaaaaaa", false],
    ["x".repeat(300) + "." + "y".repeat(20), false],
  ])("isOrderTokenShape(%s) = %s", (token, out) => expect(isOrderTokenShape(token)).toBe(out));
});
