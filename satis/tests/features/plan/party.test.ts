import { describe, expect, it } from "vitest";
import { DEFAULT_PARTY_SIZE, PARTY_PARAM, parsePartySize } from "@/features/plan/party";

describe("party", () => {
  it("sabitler beklenen değerdedir", () => {
    expect(PARTY_PARAM).toBe("kisi");
    expect(DEFAULT_PARTY_SIZE).toBe(2);
  });

  it.each([
    ["2", 12, 2],
    ["12", 12, 12],
    ["13", 12, undefined],
    ["0", 12, undefined],
    ["2.5", 12, undefined],
    ["abc", 12, undefined],
    [undefined, 12, undefined],
    [["2", "3"], 12, undefined],
  ])("parsePartySize(%o, %i) = %o", (raw, max, out) => {
    expect(parsePartySize(raw, max)).toBe(out);
  });
});
