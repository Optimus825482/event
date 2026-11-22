import { describe, expect, it } from "vitest";
import { assignTablesToGroup, clearGroupTables, groupCoverage, groupPlanStatuses } from "@/features/staffing/group-plan";

const groups = [
  { id: "g1", tableIds: ["a", "b"] },
  { id: "g2", tableIds: ["c"] },
];

describe("grup planı yardımcıları", () => {
  it("seçili grup mavi, diğer gruplar amber, grupsuz yeşil", () => {
    const out = groupPlanStatuses([{ id: "a" }, { id: "c" }, { id: "d" }], groups, "g1");
    expect(out).toEqual({ a: "checked_in", c: "pending", d: "free" });
  });

  it("toplu atama masayı önceki grubundan taşır ve tekrar eklemez", () => {
    const out = assignTablesToGroup(groups, "g2", ["a", "c", "d"]);
    expect(out[0]?.tableIds).toEqual(["b"]);
    expect(out[1]?.tableIds).toEqual(["c", "a", "d"]);
  });

  it("grubu boşaltır, diğerlerine dokunmaz", () => {
    const out = clearGroupTables(groups, "g1");
    expect(out[0]?.tableIds).toEqual([]);
    expect(out[1]).toBe(groups[1]);
  });

  it("kapsama oranı", () => {
    expect(groupCoverage([{ id: "a" }, { id: "x" }, { id: "y" }, { id: "c" }], groups)).toEqual({
      total: 4,
      grouped: 2,
      ungrouped: 2,
      percent: 50,
    });
    expect(groupCoverage([], groups).percent).toBe(0);
  });
});
