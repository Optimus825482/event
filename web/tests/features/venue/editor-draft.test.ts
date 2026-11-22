import { describe, expect, it } from "vitest";
import {
  clearDraft,
  draftKey,
  formatDraftStamp,
  formatDraftTime,
  parseDraft,
  readDraft,
  serializeDraft,
  writeDraft,
  type DraftStorage,
} from "@/features/venue/editor/draft";
import { createEditorStore, type DraftContent, type InitialLayout } from "@/features/venue/editor/store";

const EVENT = "11111111-1111-4111-8111-111111111111";
const OTHER_EVENT = "22222222-2222-4222-8222-222222222222";
const T1 = "33333333-3333-4333-8333-333333333333";
const ATTRS = { isVip: false, isPinned: false, size: null, floor: 1, sortNumber: null } as const;

function initial(): InitialLayout {
  return {
    tables: [{ id: T1, label: "M1", capacity: 8, tableTypeId: null, x: 100, y: 100, rotation: 0, isLoca: false, ...ATTRS }],
    decor: { width: 1200, height: 800, elements: [] },
    lockedTableIds: [T1],
  };
}

function memoryStorage(): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const throwing: DraftStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

function content(): DraftContent {
  const store = createEditorStore(initial());
  store.getState().addTable({ at: { x: 400, y: 400 } });
  store.getState().addDecor("stage", { x: 600, y: 100 });
  const s = store.getState();
  return { tables: s.tables, elements: s.elements, canvas: s.canvas };
}

describe("yerleşim taslağı", () => {
  it("anahtar etkinlik ve kullanıcıya özeldir", () => {
    expect(draftKey(EVENT, "u1")).toBe(`venue-draft-${EVENT}:u1`);
    expect(draftKey(EVENT, "u1")).not.toBe(draftKey(EVENT, "u2"));
  });

  it("yazılan taslak aynen geri okunur", () => {
    const now = new Date("2026-11-22T14:32:05");
    const c = content();
    const parsed = parseDraft(serializeDraft(EVENT, "u1", c, now), EVENT, "u1");
    expect(parsed?.savedAt).toBe(now.toISOString());
    expect(parsed?.content).toEqual(c);
    expect(parsed?.content.tables).toHaveLength(2);
    expect(parsed?.content.elements[0]?.kind).toBe("stage");
    expect(parsed?.content.canvas).toEqual({ width: 1200, height: 800 });
  });

  it("başka kullanıcının ya da etkinliğin taslağı, bozuk JSON ve yanlış biçim yok sayılır", () => {
    const raw = serializeDraft(EVENT, "u1", content(), new Date());
    expect(parseDraft(raw, EVENT, "u2")).toBeNull();
    expect(parseDraft(raw, OTHER_EVENT, "u1")).toBeNull();
    expect(parseDraft("{bozuk", EVENT, "u1")).toBeNull();
    expect(parseDraft(JSON.stringify({ version: 99 }), EVENT, "u1")).toBeNull();
    expect(parseDraft(null, EVENT, "u1")).toBeNull();
  });

  it("paylaşılan cihazda kullanıcılar birbirinin taslağını okumaz", () => {
    const storage = memoryStorage();
    expect(writeDraft(storage, EVENT, "u1", content(), new Date())).toBe(true);
    expect(readDraft(storage, EVENT, "u2")).toBeNull();
    // Anahtar elle başka kullanıcınınkine kopyalansa da içerikteki kimlik eşleşmez.
    storage.data.set(draftKey(EVENT, "u2"), storage.data.get(draftKey(EVENT, "u1")) ?? "");
    expect(readDraft(storage, EVENT, "u2")).toBeNull();
    expect(readDraft(storage, EVENT, "u1")).not.toBeNull();
    clearDraft(storage, EVENT, "u1");
    expect(readDraft(storage, EVENT, "u1")).toBeNull();
  });

  it("depolama hata verirse sessizce yok sayılır", () => {
    expect(readDraft(throwing, EVENT, "u1")).toBeNull();
    expect(writeDraft(throwing, EVENT, "u1", content(), new Date())).toBe(false);
    expect(() => clearDraft(throwing, EVENT, "u1")).not.toThrow();
    expect(readDraft(null, EVENT, "u1")).toBeNull();
  });

  it("zaman biçimleri", () => {
    const iso = new Date(2026, 10, 22, 9, 5, 7).toISOString();
    expect(formatDraftTime(iso)).toBe("09:05");
    expect(formatDraftStamp(iso)).toBe("22.11.2026 09:05:07");
    expect(formatDraftTime("geçersiz")).toBe("");
  });

  it("taslak geri yüklenince geri alınabilir; kilit bilgisi sunucudan gelir", () => {
    const draft = content();
    const forged = { ...draft, tables: draft.tables.map((t) => ({ ...t, locked: false, capacity: 20 })) };
    const store = createEditorStore(initial());
    store.getState().restoreDraft(forged);
    const s = store.getState();
    expect(s.tables).toHaveLength(2);
    expect(s.elements).toHaveLength(1);
    expect(s.dirty).toBe(true);
    expect(s.tables.find((t) => t.id === T1)?.locked).toBe(true);
    expect(s.tables.find((t) => t.id === null)?.locked).toBe(false);
    s.undo();
    expect(store.getState().tables).toHaveLength(1);
    expect(store.getState().tables[0]?.capacity).toBe(8);
  });
});
