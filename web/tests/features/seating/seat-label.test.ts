import { describe, expect, it } from "vitest";
import { seatLabel } from "@/domain/seating";

describe("seatLabel", () => {
  it("sandalye numarası varsa eklenir", () => {
    expect(seatLabel("A1", 3)).toBe("Masa A1 · Sandalye 3");
  });

  it("null ise yalnızca masa", () => {
    expect(seatLabel("L-3A", null)).toBe("Masa L-3A");
  });
});
