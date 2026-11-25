import { describe, expect, it, vi } from "vitest";
import { runAutoAlign, runCenterHorizontally, runDelete, runSnapToCells, runSpacing } from "@/features/venue/components/editor-commands";
import { editorLock, frozenFieldNames, isFrozen, movableKeys, partitionDeletion } from "@/features/venue/editor/lock";
import { createEditorStore, type InitialLayout } from "@/features/venue/editor/store";

const ATTRS = { isVip: false, isPinned: false, size: null, floor: 1, sortNumber: null } as const;
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

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

  it("salt-okunur alan adları", () => {
    expect(frozenFieldNames).toEqual(["label", "floor", "tableTypeId"]);
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
    expect(notify).toHaveBeenCalledWith("error", "Satılmış ya da rezerve masalar silinemez: A1");
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

  it("hizalama komutları donmuş masayı atlar, serbest masayı taşır", () => {
    const store = createEditorStore(layout());
    const notify = vi.fn();
    store.getState().setSnap(false);
    runAutoAlign(store, notify, lockA);
    runSnapToCells(store, notify, lockA);
    expect(store.getState().tables.find((t) => t.id === A)).toMatchObject({ x: 100, y: 100 });
    store.getState().select([`t:${A}`, `t:${B}`]);
    runSpacing(store, 40, notify, lockA);
    expect(store.getState().tables.find((t) => t.id === A)).toMatchObject({ x: 100, y: 100 });
    store.getState().select([`t:${A}`]);
    runCenterHorizontally(store, notify, lockA);
    expect(store.getState().tables.find((t) => t.id === A)).toMatchObject({ x: 100, y: 100 });
  });
});
