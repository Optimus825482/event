import { describe, expect, it } from "vitest";
import { nextLabel, normalizeAngle, snap, snapPoint, tableSize, zoomAround } from "@/features/venue/editor/geometry";
import { emptyHistory, record, redo, undo } from "@/features/venue/editor/history";
import { createEditorStore, decorKey, type InitialLayout } from "@/features/venue/editor/store";
import { saveLayoutSchema } from "@/features/venue/schemas";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

const ATTRS = { isVip: false, isPinned: false, size: null, floor: 1, sortNumber: null } as const;

function layout(): InitialLayout {
  return {
    tables: [
      { id: ID1, label: "M1", capacity: 8, tableTypeId: null, x: 100, y: 100, rotation: 0, isLoca: false, ...ATTRS },
      { id: ID2, label: "M2", capacity: 6, tableTypeId: null, x: 200, y: 100, rotation: 0, isLoca: false, ...ATTRS },
    ],
    decor: { width: 1200, height: 800, elements: [] },
    lockedTableIds: [ID2],
  };
}

describe("geometry", () => {
  it("snap en yakın ızgaraya yuvarlar; -0 üretmez; grid 0 değiştirmez", () => {
    expect(snap(29, 20)).toBe(20);
    expect(snap(31, 20)).toBe(40);
    expect(Object.is(snap(-4, 20), 0)).toBe(true);
    expect(snap(13.7, 0)).toBe(13.7);
    expect(snapPoint({ x: 9, y: 11 }, 20, false)).toEqual({ x: 9, y: 11 });
    expect(snapPoint({ x: 9, y: 11 }, 20, true)).toEqual({ x: 0, y: 20 });
  });

  it("açıyı 0..360 aralığına indirger, adım verilirse oturtur", () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(725)).toBe(5);
    expect(normalizeAngle(52, 15)).toBe(45);
  });

  it("nextLabel son sayıdan devam eder, öneki korur, çakışmayı atlar", () => {
    expect(nextLabel([])).toBe("1");
    expect(nextLabel(["M1", "M2", "VIP"])).toBe("M3");
    expect(nextLabel(["3", "M3"])).toBe("M4");
    expect(nextLabel(["M9", "m10"], "M")).toBe("M11");
  });

  it("zoomAround imleç altındaki dünya noktasını sabit tutar ve sınırlar", () => {
    const view = zoomAround({ scale: 1, x: 0, y: 0 }, { x: 100, y: 100 }, 2);
    expect(view).toEqual({ scale: 2, x: -100, y: -100 });
    expect(zoomAround({ scale: 1, x: 0, y: 0 }, { x: 0, y: 0 }, 100).scale).toBe(4);
  });

  it("masa boyutu kapasiteyle büyür", () => {
    expect(tableSize("round", 12).width).toBeGreaterThan(tableSize("round", 4).width);
    expect(tableSize("rectangle", 8).width).toBeGreaterThan(tableSize("rectangle", 8).height);
  });
});

describe("history", () => {
  it("record/undo/redo yığınları doğru taşır ve sınırı uygular", () => {
    let h = emptyHistory<number>();
    h = record(h, 1);
    h = record(h, 2);
    const u = undo(h, 3);
    expect(u?.state).toBe(2);
    if (!u) throw new Error("undo yok");
    const r = redo(u.history, 2);
    expect(r?.state).toBe(3);
    expect(undo(emptyHistory<number>(), 1)).toBeNull();
    expect(redo(emptyHistory<number>(), 1)).toBeNull();
    let capped = emptyHistory<number>();
    for (let i = 0; i < 10; i += 1) capped = record(capped, i, 3);
    expect(capped.past).toEqual([7, 8, 9]);
  });

  it("yeni değişiklik ileri yığınını boşaltır", () => {
    const u = undo(record(emptyHistory<number>(), 1), 2);
    if (!u) throw new Error("undo yok");
    expect(record(u.history, 1).future).toEqual([]);
  });
});

describe("editor store", () => {
  it("masa ekler (ızgaraya oturtulmuş, sıradaki etiket), seçer; geri al/yinele", () => {
    const store = createEditorStore(layout());
    const key = store.getState().addTable({ at: { x: 333, y: 101 }, capacity: 10 });
    let s = store.getState();
    expect(s.tables).toHaveLength(3);
    expect(s.tables[2]).toMatchObject({ key, label: "M3", capacity: 10, x: 340, y: 100, id: null });
    expect(s.selection).toEqual([key]);
    expect(s.dirty).toBe(true);
    s.undo();
    expect(store.getState().tables).toHaveLength(2);
    expect(store.getState().selection).toEqual([]);
    store.getState().redo();
    expect(store.getState().tables).toHaveLength(3);
    s = store.getState();
    expect(s.history.past).toHaveLength(1);
  });

  it("çoklu seçimi taşır ve tek adımda geri alır", () => {
    const store = createEditorStore(layout());
    store.getState().selectAll();
    store.getState().nudge(20, 0);
    expect(store.getState().tables.map((t) => t.x)).toEqual([120, 220]);
    store.getState().undo();
    expect(store.getState().tables.map((t) => t.x)).toEqual([100, 200]);
  });

  it("yerleşimi ızgaraya oturtarak işler; dekor boyutu da değişir", () => {
    const store = createEditorStore(layout());
    const dKey = store.getState().addDecor("stage", { x: 600, y: 100 });
    store.getState().commitPlacements([
      { key: `t:${ID1}`, x: 107, y: 95, rotation: -45 },
      { key: dKey, x: 11, y: 9, width: 401, height: 2 },
    ]);
    const s = store.getState();
    expect(s.tables[0]).toMatchObject({ x: 100, y: 100, rotation: 315 });
    expect(s.elements[0]).toMatchObject({ x: 20, y: 0, width: 401, height: 4 });
    store.getState().setSnap(false);
    store.getState().commitPlacements([{ key: `t:${ID1}`, x: 107, y: 95 }]);
    expect(store.getState().tables[0]).toMatchObject({ x: 107, y: 95 });
  });

  it("kilitli (rezervasyonlu) masa silinmez ve etiketi bildirilir", () => {
    const store = createEditorStore(layout());
    store.getState().selectAll();
    const { blocked } = store.getState().deleteSelection();
    expect(blocked).toEqual(["M2"]);
    expect(store.getState().tables.map((t) => t.label)).toEqual(["M2"]);
  });

  it("seçim kipleri: değiştir, ekle, aç/kapa", () => {
    const store = createEditorStore(layout());
    const a = `t:${ID1}`;
    const b = `t:${ID2}`;
    store.getState().select([a]);
    store.getState().select([b], "add");
    expect(store.getState().selection).toEqual([a, b]);
    store.getState().select([a], "toggle");
    expect(store.getState().selection).toEqual([b]);
    store.getState().clearSelection();
    expect(store.getState().selection).toEqual([]);
  });

  it("çoğaltma yeni etiketli kimliksiz kopyalar üretir", () => {
    const store = createEditorStore(layout());
    store.getState().select([`t:${ID2}`]);
    store.getState().duplicateSelection();
    const copy = store.getState().tables[2];
    expect(copy).toMatchObject({ id: null, label: "M3", locked: false, x: 240, y: 140 });
  });

  it("toplu düzenleme kapasite ve tipi değiştirir", () => {
    const store = createEditorStore(layout());
    store.getState().updateTables([`t:${ID1}`, `t:${ID2}`], { capacity: 12, isLoca: true });
    expect(store.getState().tables.every((t) => t.capacity === 12 && t.isLoca)).toBe(true);
  });

  it("dekor düzenlenir ve kaydetme girdisine yazılır; girdi şemadan geçer", () => {
    const store = createEditorStore(layout());
    const key = store.getState().addDecor("label");
    store.getState().updateDecor(key, { label: "Bar" });
    store.getState().addTable();
    const input = store.getState().toSaveInput();
    expect(input.decor.elements[0]?.label).toBe("Bar");
    expect(decorKey(input.decor.elements[0]?.id ?? "")).toBe(key);
    expect(input.tables[0]).toMatchObject({ id: ID1, label: "M1" });
    expect(input.tables[2]?.id).toBeUndefined();
    expect(saveLayoutSchema.safeParse({ eventId: ID1, ...input }).success).toBe(true);
  });

  it("masa nitelikleri (VIP, sabit, boyut, kat, sıra no) yüklenir, düzenlenir ve kayıpsız kaydedilir", () => {
    const init = layout();
    const first = init.tables[0];
    if (!first) throw new Error("masa yok");
    Object.assign(first, { isVip: true, isPinned: true, size: 55.5, floor: 3, sortNumber: 12 });
    const store = createEditorStore(init);
    expect(store.getState().tables[0]).toMatchObject({ isVip: true, isPinned: true, size: 55.5, floor: 3, sortNumber: 12 });
    expect(store.getState().tables[1]).toMatchObject({ isVip: false, isPinned: false, size: null, floor: 1, sortNumber: null });
    store.getState().updateTables([`t:${ID2}`], { floor: 2 });
    const key = store.getState().addTable();
    expect(store.getState().tables.find((t) => t.key === key)).toMatchObject({
      isVip: false,
      isPinned: false,
      size: null,
      floor: 1,
      sortNumber: null,
    });
    const input = store.getState().toSaveInput();
    expect(input.tables[0]).toMatchObject({ isVip: true, isPinned: true, size: 55.5, floor: 3, sortNumber: 12 });
    expect(input.tables[1]).toMatchObject({ floor: 2, size: null });
    expect(saveLayoutSchema.safeParse({ eventId: ID1, ...input }).success).toBe(true);
  });

  it("şema: kat 1..9 tam sayı, boyut ve sıra no sınırları, varsayılanlar", () => {
    const base = { eventId: ID1, decor: { width: 1200, height: 800, elements: [] } };
    const table = { label: "A", capacity: 4, x: 0, y: 0 };
    const parse = (extra: Record<string, unknown>) => saveLayoutSchema.safeParse({ ...base, tables: [{ ...table, ...extra }] });
    const ok = parse({});
    expect(ok.success && ok.data.tables[0]).toMatchObject({ isVip: false, isPinned: false, size: null, floor: 1, sortNumber: null });
    expect(parse({ floor: 9, size: 80, sortNumber: 0 }).success).toBe(true);
    for (const bad of [{ floor: 0 }, { floor: 10 }, { floor: 1.5 }, { size: 0 }, { size: 5000 }, { sortNumber: -1 }, { sortNumber: 1.2 }]) {
      expect(parse(bad).success, JSON.stringify(bad)).toBe(false);
    }
    const tooHigh = parse({ floor: 10 });
    expect(!tooHigh.success && tooHigh.error.issues[0]?.message).toBe("Kat en fazla 9 olabilir");
  });

  it("load geçmişi ve kirli bayrağını sıfırlar", () => {
    const store = createEditorStore(layout());
    store.getState().addTable();
    store.getState().load(layout());
    expect(store.getState().history.past).toEqual([]);
    expect(store.getState().dirty).toBe(false);
    expect(store.getState().tables).toHaveLength(2);
  });
});
