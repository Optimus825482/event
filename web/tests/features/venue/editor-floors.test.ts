import { describe, expect, it } from "vitest";
import { itemsCollide, layoutItems } from "@/features/venue/editor/collision";
import { decorSchema } from "@/features/venue/schemas";
import { floorKeys } from "@/features/venue/editor/floors";
import { createEditorStore, shapeResolver, type InitialLayout } from "@/features/venue/editor/store";

const ATTRS = { isVip: false, isPinned: false, size: null, floor: 1, sortNumber: null } as const;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const key = (n: number) => `t:${id(n)}`;

function table(n: number, x: number, y: number, extra: Partial<InitialLayout["tables"][number]> = {}) {
  return { id: id(n), label: `M${n}`, capacity: 8, tableTypeId: null, x, y, rotation: 0, isLoca: false, ...ATTRS, ...extra };
}

const loca = (n: number, x: number, y: number, extra: Partial<InitialLayout["tables"][number]> = {}) =>
  table(n, x, y, { isLoca: true, label: `L${n}`, floor: 2, ...extra });

function layout(
  tables: InitialLayout["tables"] = [],
  elements: InitialLayout["decor"]["elements"] = [],
  canvas = { width: 1200, height: 800 },
): InitialLayout {
  return { tables, decor: { ...canvas, elements }, lockedTableIds: [] };
}

const decor = (kind: "stage" | "area" | "wall", extra: Partial<InitialLayout["decor"]["elements"][number]> = {}) => ({
  id: `d-${kind}`,
  kind,
  x: 400,
  y: 400,
  width: 200,
  height: 120,
  rotation: 0,
  label: "",
  ...extra,
});

describe("katlar ve çakışma", () => {
  it("zemin kattaki masa 2. kattaki locanın altına taşınır; aynı kattaki masanın üstüne taşınamaz", () => {
    const store = createEditorStore(layout([table(1, 100, 300), table(2, 300, 300), loca(3, 600, 700)]));
    expect(store.getState().commitPlacements([{ key: key(1), x: 600, y: 700 }])).toMatchObject({ ok: true, moved: 1 });
    expect(store.getState().tables[0]).toMatchObject({ x: 600, y: 700 });
    expect(store.getState().commitPlacements([{ key: key(2), x: 600, y: 700 }])).toMatchObject({ ok: false, reason: "collision" });
  });

  it("aynı kattaki iki loca birbirinin üstüne taşınamaz", () => {
    const store = createEditorStore(layout([loca(1, 200, 700), loca(2, 600, 700)]));
    expect(store.getState().commitPlacements([{ key: key(1), x: 600, y: 700 }])).toMatchObject({ ok: false, reason: "collision" });
  });

  it("dekor yalnızca kendi katındaki masaları engeller; katsız dekor zemin kattır", () => {
    const store = createEditorStore(
      layout([table(1, 100, 100), loca(2, 100, 300)], [decor("stage"), decor("area", { x: 800, y: 400, floor: 2 })]),
    );
    const s = store.getState();
    // Zemin sahne: zemin masayı engeller, 2. kat locayı engellemez.
    expect(s.commitPlacements([{ key: key(1), x: 500, y: 460 }])).toMatchObject({ ok: false, reason: "collision" });
    expect(s.commitPlacements([{ key: key(2), x: 500, y: 460 }])).toMatchObject({ ok: true });
    // 2. kat alanı: zemin masayı engellemez.
    expect(store.getState().commitPlacements([{ key: key(1), x: 900, y: 460 }])).toMatchObject({ ok: true });
  });

  it("duvar her katta engeldir: zemindeki duvar 2. kat locayı da durdurur, toplu eklemede de engel sayılır", () => {
    const wall = decor("wall", { x: 0, y: 0, width: 600, height: 400 });
    const store = createEditorStore(layout([loca(1, 900, 600)], [wall]));
    expect(store.getState().commitPlacements([{ key: key(1), x: 300, y: 200 }])).toMatchObject({ ok: false, reason: "collision" });
    const full = createEditorStore(layout([], [wall], { width: 600, height: 400 }));
    expect(full.getState().addTablesBatch({ count: 2, capacity: 8, isLoca: true, floor: 2, tableTypeId: null }).added).toBe(0);
  });

  it("layoutItems kat bilgisini taşır ve itemsCollide katlar arasında çakışma saymaz", () => {
    const store = createEditorStore(layout([table(1, 500, 460), loca(2, 500, 460)], [decor("stage")]));
    const s = store.getState();
    const [ground, upper, stage] = layoutItems(s.tables, s.elements, shapeResolver(s));
    if (!ground || !upper || !stage) throw new Error("öğe eksik");
    expect([ground.floor, upper.floor, stage.floor]).toEqual([1, 2, 1]);
    expect(itemsCollide(ground, upper)).toBe(false);
    expect(itemsCollide(ground, stage)).toBe(true);
    expect(itemsCollide(upper, stage)).toBe(false);
  });
});

describe("katlar ve yerleşim araçları", () => {
  it("toplu ekleme yalnızca hedef kattaki engellerden kaçınır", () => {
    // Tuvalin tamamını kaplayan 2. kat alanı: zemin kata masa eklenir, 2. kata eklenemez.
    const cover = decor("area", { x: 0, y: 0, width: 600, height: 400, floor: 2 });
    const store = createEditorStore(layout([], [cover], { width: 600, height: 400 }));
    expect(store.getState().addTablesBatch({ count: 4, capacity: 8, isLoca: true, floor: 2, tableTypeId: null }).added).toBe(0);
    expect(store.getState().addTablesBatch({ count: 4, capacity: 8, isLoca: false, floor: 1, tableTypeId: null }).added).toBe(4);
  });

  it("araç çubuğundan eklenen masa için üst kattaki loca dolu yer sayılmaz", () => {
    const store = createEditorStore(layout([loca(1, 600, 400)]));
    store.getState().addTable();
    expect(store.getState().tables[1]).toMatchObject({ x: 600, y: 400, floor: 1 });
  });

  it("otomatik hizalama her katı kendi içinde dizer: üst kattaki sabit loca zemin masayı itmez", () => {
    const withLoca = createEditorStore(layout([table(1, 900, 600), table(2, 700, 500), loca(3, 88, 40, { isPinned: true })]));
    const without = createEditorStore(layout([table(1, 900, 600), table(2, 700, 500)]));
    expect(withLoca.getState().autoAlign().unplaced).toEqual([]);
    without.getState().autoAlign();
    const xy = (s: ReturnType<typeof withLoca.getState>) => s.tables.slice(0, 2).map((t) => [t.x, t.y]);
    expect(xy(withLoca.getState())).toEqual(xy(without.getState()));
    expect(withLoca.getState().tables[2]).toMatchObject({ x: 88, y: 40 });
  });

  it("tümünü hizalarken üst kat kendi bölgesinde kalır, zemin masaların üstüne yığılmaz", () => {
    const store = createEditorStore(layout([table(1, 900, 300), table(2, 700, 200), loca(3, 300, 700), loca(4, 620, 700)]));
    store.getState().autoAlign();
    const [, , l3, l4] = store.getState().tables;
    expect(l3?.y).toBeGreaterThan(600);
    expect(l4?.y).toBe(l3?.y);
  });
});

describe("bar / hizmet noktası", () => {
  it("araçtan eklenir, şemadan geçer ve masalar için engeldir", () => {
    const store = createEditorStore(layout([table(1, 100, 100)]));
    store.getState().addDecor("bar", { x: 600, y: 400 });
    const bar = store.getState().elements[0];
    expect(bar).toMatchObject({ kind: "bar", label: "BAR 1", width: 120, height: 40 });
    store.getState().addDecor("bar", { x: 900, y: 400 });
    expect(store.getState().elements[1]?.label).toBe("BAR 2");
    store.getState().undo();
    expect(decorSchema.safeParse(store.getState().toSaveInput().decor).success).toBe(true);
    expect(store.getState().commitPlacements([{ key: key(1), x: 600, y: 400 }])).toMatchObject({ ok: false, reason: "collision" });
    // Üst kattaki loca barın üstüne gelebilir (bar yalnızca kendi katında engel).
    store.getState().addTablesBatch({ count: 1, capacity: 6, isLoca: true, floor: 2, tableTypeId: null, start: { x: 900, y: 700 } });
    const locaKey = store.getState().tables[1]?.key ?? "";
    expect(store.getState().commitPlacements([{ key: locaKey, x: 600, y: 400 }])).toMatchObject({ ok: true });
  });
});

describe("catwalk", () => {
  it("sahne renginde dikey podyum olarak eklenir, kaydedilir ve masalar için engeldir", () => {
    const store = createEditorStore(layout([table(1, 100, 100)]));
    store.getState().addDecor("stage", { x: 600, y: 100 });
    store.getState().addDecor("catwalk", { x: 600, y: 240 });
    const [stage, catwalk] = store.getState().elements;
    expect(catwalk).toMatchObject({ kind: "catwalk", width: 60, height: 160, color: stage?.color });
    expect(decorSchema.safeParse(store.getState().toSaveInput().decor).success).toBe(true);
    expect(store.getState().commitPlacements([{ key: key(1), x: 600, y: 240 }])).toMatchObject({ ok: false, reason: "collision" });
    // Sahne ile catwalk birlikte seçilip tek hamlede taşınır.
    store.getState().select(["d:" + (stage?.id ?? ""), "d:" + (catwalk?.id ?? "")]);
    expect(store.getState().nudge(40, 0)).toMatchObject({ ok: true, moved: 2 });
  });
});

describe("etkin kat (2B görünüm)", () => {
  const wallLine = (lineId: string, floor?: number) => ({ id: lineId, x1: 10, y1: 10, x2: 200, y2: 10, color: "#ef4444", width: 2, ...(floor ? { floor } : {}) });
  const multi = () => {
    const base = layout([table(1, 100, 100), loca(2, 100, 100)], [decor("stage"), decor("area", { id: "d-up", floor: 2 })]);
    return createEditorStore({ ...base, decor: { ...base.decor, lines: [wallLine("l1"), wallLine("l2", 2)] } });
  };

  it("varsayılan tüm katlardır; kat seçmek kayıt durumunu ve geçmişi etkilemez", () => {
    const store = multi();
    expect(store.getState().activeFloor).toBeNull();
    store.getState().setActiveFloor(2);
    expect(store.getState()).toMatchObject({ activeFloor: 2, dirty: false });
    expect(store.getState().history.past).toHaveLength(0);
  });

  it("floorKeys etkin kattaki masa, dekor ve çizgileri verir; kat seçili değilken hepsini", () => {
    const s = multi().getState();
    expect([...floorKeys(s, null)]).toHaveLength(6);
    expect([...floorKeys(s, 1)].sort()).toEqual(["d:d-stage", "l:l1", key(1)].sort());
    expect([...floorKeys(s, 2)].sort()).toEqual(["d:d-up", "l:l2", key(2)].sort());
  });

  it("kat değişince diğer katların seçimi düşer; tümünü seç yalnızca etkin katı seçer", () => {
    const store = multi();
    store.getState().selectAll();
    expect(store.getState().selection).toHaveLength(6);
    store.getState().setActiveFloor(1);
    expect([...store.getState().selection].sort()).toEqual(["d:d-stage", "l:l1", key(1)].sort());
    store.getState().setActiveFloor(2);
    expect(store.getState().selection).toEqual([]);
    store.getState().selectAll();
    expect([...store.getState().selection].sort()).toEqual(["d:d-up", "l:l2", key(2)].sort());
  });

  it("yeni masa, dekor ve çizgi etkin katta oluşur; kat seçili değilken zemin katta", () => {
    const store = createEditorStore(layout());
    store.getState().addTable();
    store.getState().addDecor("area");
    store.getState().addLine({ x: 10, y: 10 }, { x: 200, y: 10 });
    expect(store.getState().tables[0]?.floor).toBe(1);
    expect(store.getState().elements[0]).not.toHaveProperty("floor");
    expect(store.getState().lines[0]).not.toHaveProperty("floor");
    store.getState().setActiveFloor(2);
    store.getState().addTable({ isLoca: true });
    store.getState().addDecor("area");
    store.getState().addLine({ x: 10, y: 50 }, { x: 200, y: 50 });
    expect(store.getState().tables[1]?.floor).toBe(2);
    expect(store.getState().elements[1]?.floor).toBe(2);
    expect(store.getState().lines[1]?.floor).toBe(2);
  });
});
