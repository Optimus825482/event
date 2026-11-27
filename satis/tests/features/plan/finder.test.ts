import { describe, expect, it } from "vitest";
import { dimmedTableIds, findTables, fitsParty } from "@/features/plan/finder";
import { buildPlanModel } from "@/features/plan/model";
import type { EventDetail } from "@/lib/core/contract";

const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

const plan: EventDetail["plan"] = {
  canvas: { width: 1200, height: 800 },
  tables: [
    {
      id: "m112",
      label: "M-112",
      x: 100,
      y: 100,
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
      id: "m12",
      label: "M-12",
      x: 200,
      y: 100,
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
      id: "m2",
      label: "M-2",
      x: 300,
      y: 100,
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
      id: "l1",
      label: "L-1",
      x: 400,
      y: 100,
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
      id: "sold",
      label: "M-99",
      x: 500,
      y: 100,
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
      id: "closed",
      label: "C-1",
      x: 600,
      y: 100,
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
  decor: [],
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
      { id: "m112", free: 2, freeSeats: [1, 2] },
      { id: "m12", free: 6, freeSeats: seq(6) },
      { id: "m2", free: 3, freeSeats: [1, 2, 3] },
      { id: "l1", free: 6, freeSeats: seq(6) },
      { id: "sold", free: 0, freeSeats: [] },
    ],
  },
  "seat",
);

describe("finder", () => {
  it("yalnızca alınabilir masalar listelenir; etikete göre sayısal sıralanır", () => {
    const labels = findTables(model, { query: "", kind: "all", partySize: 1 }).map((t) => t.label);
    expect(labels).toEqual(["L-1", "M-2", "M-12", "M-112"]);
  });

  it("süzgeç: Masa locaları, Loca masaları dışarıda bırakır", () => {
    expect(findTables(model, { query: "", kind: "table", partySize: 1 }).every((t) => !t.isLoca)).toBe(true);
    expect(findTables(model, { query: "", kind: "loca", partySize: 1 }).map((t) => t.label)).toEqual(["L-1"]);
  });

  it("arama büyük/küçük harf ve boşluk duyarsızdır; '12' hem M-12'yi hem M-112'yi bulur, tam eşleşme başta gelir", () => {
    expect(findTables(model, { query: "  m-12 ", kind: "all", partySize: 1 }).map((t) => t.label)).toEqual(["M-12"]);
    expect(findTables(model, { query: "12", kind: "all", partySize: 1 }).map((t) => t.label)).toEqual(["M-12", "M-112"]);
  });

  it("kişi sayısına tek başına yeten masalar öne alınır", () => {
    expect(fitsParty(model.tables.find((t) => t.id === "m12")!, 5)).toBe(true);
    expect(fitsParty(model.tables.find((t) => t.id === "m2")!, 5)).toBe(false);
    expect(fitsParty(model.tables.find((t) => t.id === "l1")!, 6)).toBe(true);
    expect(findTables(model, { query: "", kind: "all", partySize: 5 }).map((t) => t.label)).toEqual([
      "L-1",
      "M-12",
      "M-2",
      "M-112",
    ]);
  });

  it("dimmedTableIds süzgece ve aramaya uymayan tüm masaları verir; boş arama + Tümü boş küme", () => {
    expect(dimmedTableIds(model, { query: "", kind: "all" }).size).toBe(0);
    expect(dimmedTableIds(model, { query: "", kind: "loca" })).toEqual(new Set(["m112", "m12", "m2", "sold", "closed"]));
    expect(dimmedTableIds(model, { query: "12", kind: "all" })).toEqual(new Set(["m2", "l1", "sold", "closed"]));
  });
});
