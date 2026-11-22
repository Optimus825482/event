import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhone } from "@/features/customers/normalize";

describe("normalizePhone", () => {
  it.each([
    ["0532 111 22 33", "+905321112233"],
    ["+905321112233", "+905321112233"],
    ["5321112233", "+905321112233"],
    ["+90 (532) 111-22-33", "+905321112233"],
    ["905321112233", "+905321112233"],
    ["00905321112233", "+905321112233"],
    ["  0532.111.22.33  ", "+905321112233"],
    ["0212 555 11 22", "+902125551122"],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each(["", "   ", "abc", "12345", "053211122", "+4930123456789", "05321112233444", "0132 111 22 33"])(
    "geçersiz girdi %j null döner",
    (raw) => {
      expect(normalizePhone(raw)).toBeNull();
    },
  );
});

describe("normalizeEmail", () => {
  it("kırpar ve küçük harfe çevirir", () => {
    expect(normalizeEmail("  Ahmet@Example.COM ")).toBe("ahmet@example.com");
  });

  it.each(["", "  ", "ahmet", "ahmet@", "@example.com", "a b@example.com"])("geçersiz %j null döner", (raw) => {
    expect(normalizeEmail(raw)).toBeNull();
  });
});
