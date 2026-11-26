import { describe, expect, it } from "vitest";
import { lastNameKeyOf, nameKey } from "@/lib/name-key";

describe("nameKey", () => {
  it.each([
    ["  Şahin-Öztürk ", "SAHINOZTURK"],
    ["ışık", "ISIK"],
    ["İŞÇİ", "ISCI"],
    ["O'Brien 3", "OBRIEN"],
    ["yılmaz", "YILMAZ"],
    ["Yilmaz", "YILMAZ"],
    ["Søren", "SØREN"],
    ["", ""],
    ["  12 ", ""],
  ])("nameKey(%j) = %j", (input, key) => expect(nameKey(input)).toBe(key));
});

describe("lastNameKeyOf", () => {
  it.each([
    ["Ayşe Nur YILMAZ", "YILMAZ"],
    ["Tek", "TEK"],
    ["  Ali   Öz  ", "OZ"],
    ["   ", ""],
  ])("lastNameKeyOf(%j) = %j", (input, key) => expect(lastNameKeyOf(input)).toBe(key));
});
