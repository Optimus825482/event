import { describe, expect, it } from "vitest";
import { buildPlanModel } from "@/features/plan/model";
import { buildScene, chairHit, LOCA_FLOOR_Y } from "@/features/plan/three/scene-data";
import type { EventDetail } from "@/lib/core/contract";

const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

const plan: EventDetail["plan"] = {
  canvas: { width: 1200, height: 800 },
  tables: [
    {
      id: "a1",
      label: "A1",
      x: 150,
      y: 150,
      rotation: 0,
      shape: "round",
      isLoca: false,
      sellable: true,
      category: "standard",
      capacity: 8,
      seats: 8,
      seatNos: seq(8),
      wholeOnly: false,
    },
    {
      id: "g1",
      label: "G1",
      x: 400,
      y: 300,
      rotation: 0,
      shape: "round",
      isLoca: false,
      sellable: true,
      category: "standard",
      capacity: 8,
      seats: 6,
      seatNos: [1, 2, 3, 5, 6, 8],
      wholeOnly: false,
    },
    {
      id: "l1",
      label: "L1",
      x: 700,
      y: 500,
      rotation: 0,
      shape: "rectangle",
      isLoca: true,
      sellable: true,
      category: "vip",
      capacity: 6,
      seats: 6,
      seatNos: seq(6),
      wholeOnly: true,
    },
    {
      id: "c1",
      label: "C1",
      x: 900,
      y: 500,
      rotation: 0,
      shape: "square",
      isLoca: false,
      sellable: false,
      category: null,
      capacity: 8,
      seats: null,
      seatNos: [],
      wholeOnly: false,
    },
  ],
  decor: [{ id: "st", kind: "stage", x: 450, y: 20, width: 300, height: 100, rotation: 0, label: "Sahne" }],
  lines: [],
};

const prices: EventDetail["prices"] = [
  { category: "standard", label: "Standart", price: "1500.00" },
  { category: "vip", label: "VIP", price: "4000.00" },
];

const model = buildPlanModel(
  plan,
  prices,
  {
    at: "2026-12-01T10:00:00Z",
    tables: [
      { id: "a1", free: 8, freeSeats: seq(8) },
      { id: "g1", free: 2, freeSeats: [1, 2] },
      { id: "l1", free: 6, freeSeats: seq(6) },
    ],
  },
  "seat",
);

describe("scene-data", () => {
  it("masa konumu metreye çevrilir ve gövdesi plandaki alandan küçüktür", () => {
    const scene = buildScene({ model, picks: [], activeTableId: null });
    const a1 = scene.tables.find((t) => t.key === "a1")!;
    expect(a1.x).toBeCloseTo(-30, 2);
    expect(a1.z).toBeCloseTo(-16.67, 2);
    expect(a1.width).toBeCloseTo(1.87, 2);
  });

  it("her masada kapasite kadar sandalye vardır; yuvasızlar closed, doluları taken, boşları free", () => {
    const scene = buildScene({ model, picks: [], activeTableId: null });
    const g1Chairs = scene.chairs.filter((c) => c.tableId === "g1");
    expect(g1Chairs).toHaveLength(8);
    expect(g1Chairs.map((c) => c.seatNo)).toEqual([1, 2, 3, null, 5, 6, null, 8]);
    expect(g1Chairs.map((c) => c.state)).toEqual([
      "free",
      "free",
      "taken",
      "closed",
      "taken",
      "taken",
      "closed",
      "taken",
    ]);
  });

  it("seçili sandalye selected durumundadır ve seçili masa picked işaretlenir", () => {
    const scene = buildScene({
      model,
      picks: [{ tableId: "a1", whole: false, seatNos: [4, 7] }],
      activeTableId: "a1",
    });
    expect(scene.tables.find((t) => t.key === "a1")!.picked).toBe(true);
    const a1Chairs = scene.chairs.filter((c) => c.tableId === "a1");
    expect(a1Chairs.find((c) => c.seatNo === 4)!.state).toBe("selected");
    expect(a1Chairs.find((c) => c.seatNo === 7)!.state).toBe("selected");
    expect(a1Chairs.find((c) => c.seatNo === 1)!.state).toBe("free");
  });

  it("bütün seçilen locada sandalyeler numarasızdır, masa picked'dir", () => {
    const scene = buildScene({
      model,
      picks: [{ tableId: "l1", whole: true }],
      activeTableId: "l1",
    });
    const l1 = scene.tables.find((t) => t.key === "l1")!;
    expect(l1.picked).toBe(true);
    expect(l1.floorY).toBe(LOCA_FLOOR_Y);
    const l1Chairs = scene.chairs.filter((c) => c.tableId === "l1");
    expect(l1Chairs).toHaveLength(6);
    expect(l1Chairs.every((c) => c.seatNo === null)).toBe(true);
  });

  it("etkin masa active, süzgeç dışı masa dimmed'dir; dolu ve kapalı masa selectable değildir", () => {
    const scene = buildScene({
      model,
      picks: [],
      activeTableId: "a1",
      dimmedIds: new Set(["g1"]),
    });
    expect(scene.tables.find((t) => t.key === "a1")!.active).toBe(true);
    expect(scene.tables.find((t) => t.key === "g1")!.dimmed).toBe(true);
    expect(scene.tables.find((t) => t.key === "c1")!.selectable).toBe(false);
  });

  it("durum renkleri tema belirteçlerindendir ve dört sandalye durumu birbirinden ayrışır", () => {
    const scene = buildScene({
      model,
      picks: [{ tableId: "g1", whole: false, seatNos: [1] }],
      activeTableId: "g1",
    });
    const g1Chairs = scene.chairs.filter((c) => c.tableId === "g1");
    const selectedColor = g1Chairs.find((c) => c.state === "selected")!.color;
    const freeColor = g1Chairs.find((c) => c.state === "free")!.color;
    const takenColor = g1Chairs.find((c) => c.state === "taken")!.color;
    const closedColor = g1Chairs.find((c) => c.state === "closed")!.color;
    expect(freeColor).not.toBe(takenColor);
    expect(freeColor).not.toBe(selectedColor);
    expect(takenColor).not.toBe(selectedColor);
    expect(closedColor).toBe(takenColor);
  });

  it("chairHit örnek sırasını masaya ve yuva numarasına çevirir; aralık dışı null", () => {
    const scene = buildScene({ model, picks: [], activeTableId: null });
    scene.chairs.forEach((c, idx) => {
      expect(chairHit(scene, idx)).toEqual({ tableId: c.tableId, seatNo: c.seatNo });
    });
    expect(chairHit(scene, -1)).toBeNull();
    expect(chairHit(scene, scene.chairs.length)).toBeNull();
  });

  it("satışa kapalı masanın sandalyeleri closed çizilir", () => {
    const scene = buildScene({ model, picks: [], activeTableId: null });
    const c1Chairs = scene.chairs.filter((c) => c.tableId === "c1");
    expect(c1Chairs).toHaveLength(8);
    expect(c1Chairs.every((c) => c.state === "closed")).toBe(true);
  });
});
