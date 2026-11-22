import { describe, expect, it } from "vitest";
import { findFreeSpot } from "@/features/venue/editor/geometry";
import { createEditorStore, isLayoutEmpty } from "@/features/venue/editor/store";

const empty = { tables: [], decor: { width: 1200, height: 800, elements: [] }, lockedTableIds: [] };

describe("findFreeSpot", () => {
  it("boşsa istenen noktayı döndürür", () => {
    expect(findFreeSpot({ x: 600, y: 400 }, [], 80)).toEqual({ x: 600, y: 400 });
  });

  it("dolu noktada kaydırır; hiçbir masa aynı noktada üst üste binmez", () => {
    const placed: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 30; i += 1) {
      const p = findFreeSpot({ x: 600, y: 400 }, placed, 80, { width: 1200, height: 800 });
      expect(placed.some((o) => Math.abs(o.x - p.x) < 80 && Math.abs(o.y - p.y) < 80)).toBe(false);
      placed.push(p);
    }
    expect(new Set(placed.map((p) => `${p.x},${p.y}`)).size).toBe(30);
  });

  it("tuval sınırları içinde kalır", () => {
    const placed: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 20; i += 1) {
      const p = findFreeSpot({ x: 40, y: 40 }, placed, 80, { width: 400, height: 400 });
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(400);
      expect(p.y).toBeLessThanOrEqual(400);
      placed.push(p);
    }
  });

  it("yer kalmazsa istenen noktaya düşer (sonsuz döngü yok)", () => {
    const occupied = [{ x: 50, y: 50 }];
    expect(findFreeSpot({ x: 50, y: 50 }, occupied, 80, { width: 60, height: 60 })).toEqual({ x: 50, y: 50 });
  });
});

describe("editör: masa ekleme", () => {
  it("art arda eklenen masalar aynı noktaya yığılmaz", () => {
    const store = createEditorStore(empty);
    for (let i = 0; i < 5; i += 1) store.getState().addTable();
    const spots = store.getState().tables.map((t) => `${t.x},${t.y}`);
    expect(new Set(spots).size).toBe(5);
  });

  it("açıkça verilen konum aynen korunur", () => {
    const store = createEditorStore(empty);
    store.getState().addTable({ at: { x: 200, y: 200 } });
    store.getState().addTable({ at: { x: 200, y: 200 } });
    expect(store.getState().tables.map((t) => [t.x, t.y])).toEqual([
      [200, 200],
      [200, 200],
    ]);
  });
});

describe("isLayoutEmpty", () => {
  it("masa eklenir eklenmez false olur", () => {
    const store = createEditorStore(empty);
    expect(isLayoutEmpty(store.getState())).toBe(true);
    store.getState().addTable();
    expect(isLayoutEmpty(store.getState())).toBe(false);
  });

  it("yalnızca dekor olsa da boş sayılmaz", () => {
    const store = createEditorStore(empty);
    store.getState().addDecor("stage");
    expect(isLayoutEmpty(store.getState())).toBe(false);
  });
});
