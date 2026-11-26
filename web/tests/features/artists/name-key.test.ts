import { describe, expect, it } from "vitest";
import { artistNameKey } from "@/features/artists/name-key";

describe("artistNameKey", () => {
  it.each([
    ["  sezen   aksu ", "SEZEN AKSU"],
    ["ilhan irem", "İLHAN İREM"],
    ["Işıl", "IŞIL"],
    ["2Cellos", "2CELLOS"],
    ["Mor ve Ötesi", "MOR VE ÖTESİ"],
    ["Sezen\u00A0Aksu", "SEZEN AKSU"],
    ["Sezen\tAksu", "SEZEN AKSU"],
    ["ılık", "ILIK"],
    ["I\u0307lhan", "İLHAN"],
    ["Se\u200Bzen", "SEZEN"],
  ] as const)("artistNameKey(%j) = %j", (input, key) => expect(artistNameKey(input)).toBe(key));

  it("yazım farkı aynı anahtarı verir", () =>
    expect(artistNameKey("SEZEN AKSU")).toBe(artistNameKey("Sezen  Aksu")));
});
