import { describe, expect, it, vi } from "vitest";
import { runCenterHorizontally, runDelete, runSnapToCells, runSpacing } from "@/features/venue/components/editor-commands";
import { editorLock, isFrozen, movableKeys, partitionDeletion } from "@/features/venue/editor/lock";
import { createEditorStore, type InitialLayout } from "@/features/venue/editor/store";

const ATTRS = { isVip: false, isPinned: false, size: null, floor: 1, sortNumber: null } as const;
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

function layout(): InitialLayout {
  return {
    tables: [
      { id: A, label: "A1", capacity: 8, tableTypeId: null, x: 100, y: 100, rotation: 0, isLoca: false, ...ATTRS },
      { id: B, label: "B1", capacity: 8, tableTypeId: null, x: 300, y: 100, rotation: 0, isLoca: false, ...ATTRS },
    ],
    decor: { width: 1200, height: 800, elements: [] },
    lockedTableIds: [],
  };
}

const lockA = editorLock({ layoutLocked: true, frozenTableIds: [A] });

describe("editör kilidi", () => {
  it("partitionDeletion donmuş masaları ayırır", () => {
    expect(partitionDeletion(editorLock({ layoutLocked: true, frozenTableIds: ["a"] }), ["a", "b"])).toEqual({ allowed: ["b"], blocked: ["a"] });
  });

  it("kilit yokken hiçbir masa donmuş değildir", () => {
    expect(isFrozen(editorLock({ layoutLocked: false, frozenTableIds: [] }), "a")).toBe(false);
    expect(isFrozen(editorLock({ layoutLocked: false, frozenTableIds: ["a"] }), "a")).toBe(false);
  });

  it("donmuş kimliklerin sırası önemsizdir", () => {
    expect(editorLock({ layoutLocked: true, frozenTableIds: ["b", "a"] }).frozen).toEqual(new Set(["a", "b"]));
  });

  it("movableKeys sabitlenmiş ve donmuş masaları çıkarır", () => {
    const lock = editorLock({ layoutLocked: true, frozenTableIds: ["a"] });
    const tables = [
      { key: "t:a", id: "a", isPinned: false },
      { key: "t:b", id: "b", isPinned: true },
      { key: "t:c", id: "c", isPinned: false },
    ];
    expect(movableKeys(lock, tables, ["t:a", "t:b", "t:c"])).toEqual(["t:c"]);
  });

  it("silme komutu donmuş masayı taslaktan çıkarmaz", () => {
    const store = createEditorStore(layout());
    const notify = vi.fn();
    store.getState().selectAll();
    runDelete(store, notify, lockA);
    expect(store.getState().tables.map((t) => t.label)).toEqual(["A1"]);
    expect(notify).toHaveBeenCalledWith("error", "Taahhütlü (rezervasyonlu) masalar silinemez: A1");
  });

  it("silme komutu kilit yokken eskisi gibi çalışır", () => {
    const store = createEditorStore(layout());
    const notify = vi.fn();
    store.getState().selectAll();
    runDelete(store, notify, editorLock({ layoutLocked: false, frozenTableIds: [] }));
    expect(store.getState().tables).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("donmuş masa sabitlemesi kaldırılsa da taşınmaz", () => {
    const store = createEditorStore({ ...layout(), frozenTableIds: [A] });
    store.getState().setSnap(false);
    const r = store.getState().commitPlacements([{ key: `t:${A}`, x: 500, y: 500, rotation: 90 }]);
    expect(r).toEqual({ ok: false, reason: "nothing" });
    store.getState().updateTables([`t:${A}`], { isPinned: false });
    store.getState().select([`t:${A}`]);
    expect(store.getState().nudge(20, 0)).toEqual({ ok: false, reason: "nothing" });
    expect(store.getState().tables[0]).toMatchObject({ x: 100, y: 100, rotation: 0 });
  });

  it("hizalama komutları kilitliyken donmuş masayı taşımaz, kilitsizken taşır", () => {
    const messy = (): InitialLayout => {
      const l = layout();
      l.tables[0] = { ...l.tables[0]!, x: 103, y: 97 };
      l.tables[1] = { ...l.tables[1]!, x: 303, y: 97 };
      return l;
    };
    const store = createEditorStore(messy());
    runSnapToCells(store, vi.fn(), lockA);
    expect(store.getState().tables.find((t) => t.id === A)).toMatchObject({ x: 103, y: 97 });
    expect(store.getState().tables.find((t) => t.id === B)).not.toMatchObject({ x: 303, y: 97 });
    const free = createEditorStore(messy());
    runSnapToCells(free, vi.fn(), editorLock({ layoutLocked: false, frozenTableIds: [] }));
    expect(free.getState().tables.find((t) => t.id === A)).not.toMatchObject({ x: 103, y: 97 });
  });

  it("aralık ve yatay ortalama komutları donmuş masayı taşımaz", () => {
    const store = createEditorStore(layout());
    const notify = vi.fn();
    store.getState().setSnap(false);
    store.getState().select([`t:${A}`, `t:${B}`]);
    runSpacing(store, 40, notify, lockA);
    expect(store.getState().tables.find((t) => t.id === A)).toMatchObject({ x: 100, y: 100 });
    store.getState().select([`t:${A}`]);
    runCenterHorizontally(store, notify, lockA);
    expect(store.getState().tables.find((t) => t.id === A)).toMatchObject({ x: 100, y: 100 });
  });

  it("taslak geri yüklemesi donmuş masaları sunucudaki hâlinde tutar, diğer değişiklikleri korur", () => {
    const l = layout();
    l.tables.push({ id: C, label: "C1", capacity: 8, tableTypeId: null, x: 500, y: 100, rotation: 0, isLoca: false, ...ATTRS });
    const store = createEditorStore({ ...l, frozenTableIds: [A, C] });
    const server = store.getState().tables;
    const draftTables = server
      .filter((t) => t.id !== C)
      .map((t) => (t.id === A ? { ...t, x: 900, y: 700, rotation: 90, floor: 2, label: "X", tableTypeId: "tip" } : { ...t, x: 320, label: "B9" }));
    store.getState().restoreDraft({ tables: draftTables, elements: [], canvas: { width: 1200, height: 800 } });
    const after = store.getState().tables;
    expect(after.find((t) => t.id === A)).toMatchObject({ x: 100, y: 100, rotation: 0, floor: 1, label: "A1", tableTypeId: null });
    expect(after.find((t) => t.id === C)).toMatchObject({ x: 500, y: 100, label: "C1" });
    expect(after.find((t) => t.id === B)).toMatchObject({ x: 320, label: "B9" });
  });
});
