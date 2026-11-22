import { describe, expect, it } from "vitest";
import { applySpacing, autoAlign, horizontalCentreDelta, snapToCellCentres } from "@/features/venue/editor/arrange";
import { layoutItems } from "@/features/venue/editor/collision";
import {
  cellName,
  clampDelta,
  columnName,
  effectiveTableSize,
  nextPrefixedLabel,
  rectsOverlap,
  tableFootprint,
  type Rect,
} from "@/features/venue/editor/geometry";
import { BULK_ADD_GAP, findNearestFree, placeInRows } from "@/features/venue/editor/placement";
import { createEditorStore, decorKey, shapeResolver, type InitialLayout } from "@/features/venue/editor/store";

const ATTRS = { isVip: false, isPinned: false, size: null, floor: 1, sortNumber: null } as const;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function table(n: number, x: number, y: number, extra: Partial<InitialLayout["tables"][number]> = {}) {
  return { id: id(n), label: `M${n}`, capacity: 8, tableTypeId: null, x, y, rotation: 0, isLoca: false, ...ATTRS, ...extra };
}

function layout(tables: InitialLayout["tables"] = [], elements: InitialLayout["decor"]["elements"] = []): InitialLayout {
  return { tables, decor: { width: 1200, height: 800, elements }, lockedTableIds: [] };
}

const stage = { id: "s1", kind: "stage" as const, x: 440, y: 20, width: 320, height: 100, rotation: 0, label: "Sahne" };

function noOverlaps(rects: readonly Rect[]): boolean {
  return rects.every((a, i) => rects.every((b, j) => i === j || !rectsOverlap(a, b)));
}

function boxes(store: ReturnType<typeof createEditorStore>) {
  const s = store.getState();
  return layoutItems(s.tables, s.elements, shapeResolver(s));
}

describe("geometri yardımcıları", () => {
  it("effectiveTableSize: size varsa o, yoksa kapasiteden türetilir", () => {
    expect(effectiveTableSize({ size: 64, capacity: 8, isLoca: false })).toBe(64);
    expect(effectiveTableSize({ size: null, capacity: 8, isLoca: false })).toBe(56);
    expect(tableFootprint({ size: 80, capacity: 8, isLoca: false }, "round")).toEqual({ width: 80, height: 80 });
    expect(tableFootprint({ size: 120, capacity: 8, isLoca: false }, "rectangle").width).toBe(120);
  });

  it("hücre adı A–Z sütun, 1'den başlayan satır", () => {
    expect(cellName({ x: 50, y: 90 })).toBe("B3");
    expect(cellName({ x: 0, y: 0 })).toBe("A1");
    expect(columnName(25)).toBe("Z");
    expect(columnName(26)).toBe("AA");
  });

  it("kenar teması çakışma değildir; clampDelta grubu tuvalde tutar", () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 9, y: 0, width: 10, height: 10 })).toBe(true);
    const group = [{ x: 100, y: 100, width: 50, height: 50 }];
    expect(clampDelta(group, { x: -500, y: 2000 }, { width: 400, height: 400 })).toEqual({ x: -100, y: 250 });
  });

  it("loca etiketleri ayrı L sırasıyla ilerler", () => {
    expect(nextPrefixedLabel(["L1", "L3", "5", "M9"], "L")).toBe("L4");
    expect(nextPrefixedLabel([], "L")).toBe("L1");
    expect(nextPrefixedLabel(["L1"], "L", ["L1", "L2"])).toBe("L3");
  });
});

describe("akıllı yerleşim (placeInRows)", () => {
  const canvas = { width: 1200, height: 800 };
  const footprint = { width: 61, height: 61 };

  it("B sütunundan, tuvale sığan ilk satırdan başlar; birbirine ve engellere boşluk bırakır", () => {
    const obstacles = [{ x: 300, y: 0, width: 400, height: 200 }];
    const points = placeInRows({ count: 40, footprint, obstacles, canvas });
    expect(points).toHaveLength(40);
    expect(points[0]).toEqual({ x: 60, y: 60 });
    const placed = points.map((p) => ({ x: p.x - 30.5, y: p.y - 30.5, width: 61, height: 61 }));
    for (const [i, a] of placed.entries()) {
      expect(obstacles.some((o) => rectsOverlap(a, o, BULK_ADD_GAP))).toBe(false);
      expect(placed.some((b, j) => i !== j && rectsOverlap(a, b, BULK_ADD_GAP))).toBe(false);
      expect(a.x >= 0 && a.y >= 0 && a.x + a.width <= 1200 && a.y + a.height <= 800).toBe(true);
    }
  });

  it("verilen hücreden başlar; yer yetmezse daha az nokta döner", () => {
    const fromCell = placeInRows({ count: 1, footprint, obstacles: [], canvas, start: { x: 410, y: 410 } });
    expect(fromCell).toEqual([{ x: 420, y: 420 }]);
    const small = placeInRows({ count: 50, footprint, obstacles: [], canvas: { width: 300, height: 200 } });
    expect(small.length).toBeGreaterThan(0);
    expect(small.length).toBeLessThan(50);
  });

  it("findNearestFree engel dışındaki en yakın noktayı bulur, yer yoksa null", () => {
    const obstacles = [{ x: 0, y: 0, width: 200, height: 200 }];
    const p = findNearestFree({ preferred: { x: 100, y: 100 }, footprint: { width: 40, height: 40 }, obstacles, canvas });
    expect(p).not.toBeNull();
    if (p) expect(rectsOverlap({ x: p.x - 20, y: p.y - 20, width: 40, height: 40 }, obstacles[0] as Rect)).toBe(false);
    expect(findNearestFree({ preferred: { x: 10, y: 10 }, footprint: { width: 500, height: 500 }, obstacles: [], canvas: { width: 300, height: 300 } })).toBeNull();
  });
});

describe("toplu ekleme (store)", () => {
  it("masa numarası sürer, hepsi tek geri al adımıdır, sahneyle çakışmaz", () => {
    const store = createEditorStore(layout([table(1, 1000, 700), table(2, 1100, 700)], [stage]));
    const r = store.getState().addTablesBatch({ count: 10, capacity: 12, isLoca: false, floor: 1, tableTypeId: null });
    expect(r).toMatchObject({ added: 10, requested: 10 });
    const s = store.getState();
    expect(s.tables.slice(2).map((t) => t.label)).toEqual(["M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12"]);
    expect(s.tables.slice(2).every((t) => t.capacity === 12 && t.sortNumber === Number(t.label.slice(1)))).toBe(true);
    expect(s.history.past).toHaveLength(1);
    expect(s.selection).toEqual(r.keys);
    expect(noOverlaps(boxes(store).map((b) => b.box))).toBe(true);
    s.undo();
    expect(store.getState().tables).toHaveLength(2);
  });

  it("localar L1.. adlanır, seçilen katta oluşur; adet 200 ile sınırlıdır", () => {
    const store = createEditorStore(layout([table(1, 1000, 700, { isLoca: true, label: "L1" })]));
    store.getState().addTablesBatch({ count: 2, capacity: 6, isLoca: true, floor: 2, tableTypeId: null });
    const added = store.getState().tables.slice(1);
    expect(added.map((t) => [t.label, t.isLoca, t.floor])).toEqual([
      ["L2", true, 2],
      ["L3", true, 2],
    ]);
    const big = createEditorStore({ ...layout(), decor: { width: 5000, height: 5000, elements: [] } });
    expect(big.getState().addTablesBatch({ count: 500, capacity: 4, isLoca: false, floor: 1, tableTypeId: null }).added).toBe(200);
  });

  it("yer yoksa yerleşebilen kadarını ekler", () => {
    const store = createEditorStore({ ...layout(), decor: { width: 200, height: 200, elements: [] } });
    const r = store.getState().addTablesBatch({ count: 20, capacity: 8, isLoca: false, floor: 1, tableTypeId: null });
    expect(r.added).toBeGreaterThan(0);
    expect(r.added).toBeLessThan(20);
  });
});

describe("hizalama araçları (saf)", () => {
  const canvas = { width: 1200, height: 800 };
  const items = [3, 1, 2].map((n) => ({ key: `k${n}`, x: 600 + n * 3, y: 400 - n * 50, width: 56, height: 56 }));

  it("autoAlign verilen sırayla soldan sağa dizer, engelden kaçar, çakıştırmaz", () => {
    const fixed = [{ x: 140, y: 0, width: 200, height: 120 }];
    const ordered = [...items].sort((a, b) => a.key.localeCompare(b.key));
    const r = autoAlign(ordered, fixed, canvas);
    expect(r.unplaced).toEqual([]);
    const pos = ordered.map((it) => r.positions.get(it.key));
    expect(pos[0]?.x).toBe(68);
    const rects = ordered.map((it, i) => ({ x: (pos[i]?.x ?? 0) - 28, y: (pos[i]?.y ?? 0) - 28, width: 56, height: 56 }));
    expect(noOverlaps([...rects, ...fixed])).toBe(true);
  });

  it("snapToCellCentres merkezleri hücre merkezine oturtur ve çakıştırmaz", () => {
    const close = [0, 1, 2, 3].map((i) => ({ key: `c${i}`, x: 203 + i * 30, y: 207, width: 56, height: 56 }));
    const r = snapToCellCentres(close, [], canvas);
    const rects = close.map((it) => {
      const p = r.positions.get(it.key);
      expect(p && (p.x - 20) % 40 === 0 && (p.y - 20) % 40 === 0).toBe(true);
      return { x: (p?.x ?? 0) - 28, y: (p?.y ?? 0) - 28, width: 56, height: 56 };
    });
    expect(noOverlaps(rects)).toBe(true);
  });

  it("applySpacing satır içinde tam `gap` boşluk bırakır", () => {
    const row = [0, 1, 2].map((i) => ({ key: `r${i}`, x: 100 + i * 90, y: 300 + i, width: 40, height: 40 }));
    const r = applySpacing(row, 10, [], canvas);
    const xs = row.map((it) => r.positions.get(it.key)?.x ?? 0);
    expect((xs[1] ?? 0) - (xs[0] ?? 0)).toBe(50);
    expect((xs[2] ?? 0) - (xs[1] ?? 0)).toBe(50);
    expect(new Set(row.map((it) => r.positions.get(it.key)?.y)).size).toBe(1);
  });

  it("horizontalCentreDelta grubu yatay ortalar", () => {
    expect(horizontalCentreDelta([{ x: 0, y: 0, width: 200, height: 10 }], canvas)).toBe(500);
  });
});

describe("hizalama araçları (store) ve sabitleme", () => {
  it("Otomatik Hizala sabit masayı oynatmaz, onu ve sahneyi engel sayar", () => {
    const store = createEditorStore(
      layout([table(1, 900, 600), table(2, 100, 60, { isPinned: true }), table(3, 700, 500)], [stage]),
    );
    const r = store.getState().autoAlign();
    expect(r.unplaced).toEqual([]);
    const s = store.getState();
    expect(s.tables[1]).toMatchObject({ x: 100, y: 60 });
    expect(s.tables[0]?.x).toBeLessThan(s.tables[2]?.x ?? 0);
    expect(noOverlaps(boxes(store).map((b) => b.box))).toBe(true);
    expect(s.history.past).toHaveLength(1);
  });

  it("Merkezle ve Aralık Ayarla sabitleri atlar", () => {
    const store = createEditorStore(layout([table(1, 103, 107), table(2, 303, 107, { isPinned: true }), table(3, 503, 111)]));
    store.getState().snapToCells();
    expect(store.getState().tables.map((t) => [t.x, t.y])).toEqual([
      [100, 100],
      [303, 107],
      [500, 100],
    ]);
    store.getState().selectAll();
    store.getState().setSpacing(8);
    const [a, b, c] = store.getState().tables;
    expect(b).toMatchObject({ x: 303, y: 107 });
    expect(Math.abs((c?.x ?? 0) - (a?.x ?? 0))).toBeGreaterThan(0);
  });

  it("Yatay Ortala sahneyi tuvalin ortasına alır", () => {
    const store = createEditorStore(layout([], [{ ...stage, x: 20 }]));
    const r = store.getState().centerHorizontally([decorKey("s1")]);
    expect(r.ok).toBe(true);
    expect(store.getState().elements[0]?.x).toBe(440);
  });

  it("VIP ve Sabitle aç/kapa; sabit masa taşınmaz ve kaydırılmaz", () => {
    const store = createEditorStore(layout([table(1, 100, 100), table(2, 300, 100)]));
    const k1 = `t:${id(1)}`;
    store.getState().setVip([k1], true);
    store.getState().setPinned([k1, decorKey("yok")], true);
    expect(store.getState().tables[0]).toMatchObject({ isVip: true, isPinned: true });
    expect(store.getState().commitPlacements([{ key: k1, x: 600, y: 600 }])).toEqual({ ok: false, reason: "nothing" });
    store.getState().selectAll();
    expect(store.getState().nudge(20, 0)).toEqual({ ok: true, moved: 1 });
    expect(store.getState().tables.map((t) => t.x)).toEqual([100, 320]);
  });
});

describe("çakışma önleme ve tuval sınırı", () => {
  it("masa başka masanın ya da sahnenin üstüne bırakılamaz; durum değişmez", () => {
    const store = createEditorStore(layout([table(1, 100, 300), table(2, 300, 300)], [stage]));
    const before = store.getState().tables;
    const r = store.getState().commitPlacements([{ key: `t:${id(1)}`, x: 300, y: 300 }]);
    expect(r).toMatchObject({ ok: false, reason: "collision" });
    expect(store.getState().tables).toBe(before);
    expect(store.getState().commitPlacements([{ key: `t:${id(1)}`, x: 600, y: 60 }]).ok).toBe(false);
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().commitPlacements([{ key: `t:${id(1)}`, x: 600, y: 400 }]).ok).toBe(true);
  });

  it("grup taşıması tek bir öğe çarpsa bile tamamen reddedilir", () => {
    const store = createEditorStore(layout([table(1, 100, 300), table(2, 200, 300), table(3, 400, 300)]));
    const r = store.getState().commitPlacements([
      { key: `t:${id(1)}`, x: 200, y: 400 },
      { key: `t:${id(2)}`, x: 300, y: 300 },
    ]);
    expect(r.ok).toBe(true);
    const blocked = store.getState().commitPlacements([
      { key: `t:${id(1)}`, x: 300, y: 500 },
      { key: `t:${id(2)}`, x: 400, y: 300 },
    ]);
    expect(blocked.ok).toBe(false);
    expect(store.getState().tables.map((t) => [t.x, t.y])).toEqual([
      [200, 400],
      [300, 300],
      [400, 300],
    ]);
  });

  it("tuval dışına bırakılan öğe içeri itilir; ok tuşu da dışarı taşımaz", () => {
    const store = createEditorStore(layout([table(1, 100, 100)]));
    store.getState().commitPlacements([{ key: `t:${id(1)}`, x: -300, y: 5000 }]);
    const t = store.getState().tables[0];
    expect(t?.x).toBeGreaterThanOrEqual(28);
    expect(t?.y).toBeLessThanOrEqual(800 - 28);
    store.getState().selectAll();
    for (let i = 0; i < 10; i += 1) store.getState().nudge(-20, 0);
    expect(store.getState().tables[0]?.x).toBe(28);
  });

  it("önceden üst üste olan masalar (eski veri) taşınmaya devam edebilir", () => {
    const store = createEditorStore(layout([table(1, 100, 100), table(2, 110, 100)]));
    store.getState().select([`t:${id(1)}`]);
    expect(store.getState().nudge(-20, 0).ok).toBe(true);
  });
});
