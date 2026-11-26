import { describe, expect, it } from "vitest";
import { decorCenter, parseDecor, parseLines } from "@/features/plan/decor";

describe("decor", () => {
  it("geçerli sahne korunur, bozuk öğeler atlanır", () =>
    expect(
      parseDecor([
        { id: "s", kind: "stage", x: 600, y: 60, width: 300, height: 80, label: "Sahne", color: "#fff" },
        { id: "w", kind: "wall", x: 1, y: 2, height: 5 },
        { id: "u", kind: "ufo", x: 1, y: 2, width: 3, height: 4 },
        null,
        "metin",
      ]),
    ).toEqual([{ id: "s", kind: "stage", x: 600, y: 60, width: 300, height: 80, rotation: 0, label: "Sahne" }]));
  it("etiket 60 karakterle sınırlanır", () =>
    expect(parseDecor([{ id: "s", kind: "label", x: 0, y: 0, width: 1, height: 1, label: "x".repeat(90) }])[0]?.label).toHaveLength(60));
  it("çizgiler: sayısal olmayan koordinat atlanır", () =>
    expect(
      parseLines([{ id: "l", x1: 0, y1: 0, x2: 10, y2: 0, width: 2, color: "#ef4444" }, { id: "k", x1: "a" }]),
    ).toEqual([{ id: "l", x1: 0, y1: 0, x2: 10, y2: 0, width: 2 }]));
  it("dekor x,y sol-üst köşedir: 600,60 300x80 merkezi 750,100", () =>
    expect(decorCenter({ x: 600, y: 60, width: 300, height: 80 })).toEqual({ x: 750, y: 100 }));
});
