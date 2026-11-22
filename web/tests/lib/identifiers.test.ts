import { describe, expect, it } from "vitest";
import { escapeLike, isUuid } from "@/lib/identifiers";

describe("isUuid", () => {
  it("biçimi doğru uuid'i kabul eder (büyük/küçük harf)", () => {
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isUuid("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
  });

  it("36 karakterlik ama uuid olmayan değerleri reddeder (eski gevşek desen `[0-9a-f-]{36}` kabul ederdi)", () => {
    expect(isUuid("-".repeat(36))).toBe(false);
    expect(isUuid("123e4567e89b12d3a456426614174000----")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000 ")).toBe(false);
  });
});

describe("escapeLike", () => {
  it("\, % ve _ karakterlerini kaçırır; diğerlerine dokunmaz", () => {
    expect(escapeLike("a%b_c\\d")).toBe("a\\%b\\_c\\\\d");
    expect(escapeLike("masa 12")).toBe("masa 12");
  });
});
