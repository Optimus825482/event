import { describe, expect, it } from "vitest";
import { parseDraft, serializeDraft } from "@/features/venue/editor/draft";
import {
  constrainAxis,
  copyLines,
  isLineKey,
  lineKey,
  lineStrip,
  linesForSave,
  linesInRect,
  resolveEndpoint,
  translateLine,
} from "@/features/venue/editor/lines";
import { createEditorStore, isLayoutEmpty, type InitialLayout } from "@/features/venue/editor/store";
import { buildTemplatePreview } from "@/features/venue/components/template-preview-model";
import { parseTemplateLayout } from "@/features/venue/template-layout";
import { MAX_LINES, decorSchema, parseDecor, saveLayoutSchema, type DecorLine } from "@/features/venue/schemas";

const CANVAS = { width: 1000, height: 600 };
const line = (over: Partial<DecorLine> = {}): DecorLine => ({ id: "l1", x1: 100, y1: 100, x2: 300, y2: 100, color: "#ef4444", width: 4, ...over });

function initial(lines?: DecorLine[]): InitialLayout {
  return { tables: [], decor: { width: 1000, height: 600, elements: [], ...(lines ? { lines } : {}) }, lockedTableIds: [] };
}

describe("çizgi geometrisi", () => {
  const opts = { gridSize: 20, snap: true, canvas: CANVAS, constrain: false };

  it("uç ızgaraya oturur, ızgara kapalıysa olduğu gibi kalır", () => {
    expect(resolveEndpoint({ x: 109, y: 51 }, null, opts)).toEqual({ x: 100, y: 60 });
    expect(resolveEndpoint({ x: 109, y: 51 }, null, { ...opts, snap: false })).toEqual({ x: 109, y: 51 });
  });

  it("Shift baskın eksende yatay ya da dikey kilitler", () => {
    expect(constrainAxis({ x: 0, y: 0 }, { x: 50, y: 10 })).toEqual({ x: 50, y: 0 });
    expect(constrainAxis({ x: 0, y: 0 }, { x: 10, y: -50 })).toEqual({ x: 0, y: -50 });
    expect(resolveEndpoint({ x: 205, y: 133 }, { x: 100, y: 100 }, { ...opts, constrain: true })).toEqual({ x: 200, y: 100 });
  });

  it("uç tuvalin dışına çıkmaz", () => {
    expect(resolveEndpoint({ x: -50, y: 9999 }, null, opts)).toEqual({ x: 0, y: 600 });
  });

  it("kaydırma tuval kenarında kırpılır", () => {
    expect(translateLine(line(), -500, 0, CANVAS)).toMatchObject({ x1: 0, x2: 200 });
    expect(translateLine(line(), 0, 1000, CANVAS)).toMatchObject({ y1: 600, y2: 600 });
  });

  it("kayıt öncesi uçlar kırpılır, yuvarlanır, sıfır boylular atılır", () => {
    const out = linesForSave([line({ x2: 1200.123 }), line({ id: "z", x2: 100 }), line({ id: "r", x1: 10.555, width: 4.4 })], CANVAS);
    expect(out.map((l) => l.id)).toEqual(["l1", "r"]);
    expect(out[0]?.x2).toBe(1000);
    expect(out[1]).toMatchObject({ x1: 10.56, width: 4 });
    expect(linesForSave(Array.from({ length: MAX_LINES + 5 }, (_, i) => line({ id: `l${i}` })), CANVAS)).toHaveLength(MAX_LINES);
  });

  it("kement orta noktaya göre seçer; kopyalar kaydırılmış ve yeni kimliklidir", () => {
    expect(linesInRect([line(), line({ id: "far", x1: 800, x2: 900 })], { x: 150, y: 50, width: 100, height: 100 })).toEqual([lineKey("l1")]);
    let n = 0;
    const copies = copyLines([line(), line({ id: "b" })], new Set([lineKey("b")]), 40, CANVAS, () => `c${++n}`);
    expect(copies).toEqual([{ ...line({ id: "c1" }), x1: 140, y1: 140, x2: 340, y2: 140 }]);
    expect(isLineKey(lineKey("x"))).toBe(true);
  });

  it("3B şeridi: merkez, uzunluk ve açı", () => {
    const s = lineStrip(line({ x1: 0, y1: 0, x2: 0, y2: 200 }));
    expect(s).toMatchObject({ cx: 0, cy: 100, length: 200 });
    expect(s.angle).toBeCloseTo(Math.PI / 2);
  });
});

describe("düzenleyicide çizgiler", () => {
  it("çizgi ekler, seçer; çok kısa çizgi eklenmez; yeni çizgi son biçimi sürdürür", () => {
    const store = createEditorStore(initial());
    expect(store.getState().addLine({ x: 10, y: 10 }, { x: 11, y: 10 })).toBeNull();
    const key = store.getState().addLine({ x: 100, y: 100 }, { x: 300, y: 100 });
    expect(key).not.toBeNull();
    expect(store.getState().selection).toEqual([key]);
    expect(store.getState().lines[0]).toMatchObject({ x1: 100, x2: 300, color: "#ef4444", width: 4 });
    store.getState().updateLines([key ?? ""], { color: "#22c55e", width: 6 });
    store.getState().addLine({ x: 0, y: 0 }, { x: 0, y: 100 });
    expect(store.getState().lines[1]).toMatchObject({ color: "#22c55e", width: 6 });
    expect(isLayoutEmpty(store.getState())).toBe(false);
  });

  it("uç taşıma, gövde kaydırma, geri al / yinele", () => {
    const store = createEditorStore(initial([line()]));
    const key = lineKey("l1");
    store.getState().moveLineEnd(key, "end", { x: 300, y: 400 });
    expect(store.getState().lines[0]).toMatchObject({ x2: 300, y2: 400 });
    store.getState().moveLineEnd(key, "start", { x: 300, y: 400 }); // sıfır boy: reddedilir
    expect(store.getState().lines[0]).toMatchObject({ x1: 100, y1: 100 });
    store.getState().translateLineBy(key, 20, 0);
    expect(store.getState().lines[0]).toMatchObject({ x1: 120, x2: 320 });
    store.getState().undo();
    store.getState().undo();
    expect(store.getState().lines[0]).toEqual(line());
    store.getState().redo();
    expect(store.getState().lines[0]).toMatchObject({ x2: 300, y2: 400 });
    expect(store.getState().dirty).toBe(true);
  });

  it("tümünü seç, çoğalt, sil; kayıt girdisi çizgileri içerir", () => {
    const store = createEditorStore(initial([line()]));
    store.getState().selectAll();
    expect(store.getState().selection).toEqual([lineKey("l1")]);
    store.getState().duplicateSelection();
    expect(store.getState().lines).toHaveLength(2);
    expect(store.getState().lines[1]).toMatchObject({ x1: 140, y1: 140 });
    store.getState().deleteSelection();
    expect(store.getState().lines.map((l) => l.id)).toEqual(["l1"]);
    const input = store.getState().toSaveInput();
    expect(input.decor.lines).toEqual([line()]);
    expect(saveLayoutSchema.safeParse({ eventId: crypto.randomUUID(), ...input }).success).toBe(true);
    store.getState().undo();
    expect(store.getState().lines).toHaveLength(2);
  });

  it("taslak çizgileri taşır; eski taslak (çizgisiz) da okunur", () => {
    const store = createEditorStore(initial([line()]));
    const s = store.getState();
    const now = new Date("2026-11-22T10:00:00Z");
    const parsed = parseDraft(serializeDraft("e", "u", { tables: [], elements: [], lines: s.lines, canvas: s.canvas }, now), "e", "u");
    expect(parsed?.content.lines).toEqual([line()]);
    const old = parseDraft(serializeDraft("e", "u", { tables: [], elements: [], canvas: s.canvas }, now), "e", "u");
    expect(old?.content.lines).toBeUndefined();
    const restored = createEditorStore(initial());
    restored.getState().restoreDraft(parsed?.content ?? { tables: [], elements: [], canvas: CANVAS });
    expect(restored.getState().lines).toEqual([line()]);
    restored.getState().undo();
    expect(restored.getState().lines).toEqual([]);
  });
});

describe("çizgi şeması", () => {
  const base = { width: 1000, height: 600, elements: [] };

  it("çizgisiz eski kayıtlar geçerlidir", () => {
    expect(decorSchema.parse(base).lines).toBeUndefined();
    expect(parseDecor({ width: 900, height: 500 }).width).toBe(900);
  });

  it.each([
    ["NaN", { x1: Number.NaN }],
    ["sonsuz", { y2: Number.POSITIVE_INFINITY }],
    ["tuval dışı", { x2: 1100 }],
    ["negatif taşma", { y1: -41 }],
    ["sıfır boy", { x2: 100 }],
    ["renk", { color: "red" }],
    ["kalınlık", { width: 0 }],
    ["kesirli kalınlık", { width: 2.5 }],
    ["uzun kimlik", { id: "x".repeat(65) }],
  ])("geçersiz çizgi reddedilir: %s", (_name, bad) => {
    expect(decorSchema.safeParse({ ...base, lines: [line(bad)] }).success).toBe(false);
  });

  it("tolerans içinde taşma ve paletsiz #rrggbb kabul edilir; sınır 200 çizgi", () => {
    expect(decorSchema.safeParse({ ...base, lines: [line({ x2: 1040, y1: -40, color: "#123abc" })] }).success).toBe(true);
    const many = Array.from({ length: MAX_LINES + 1 }, (_, i) => line({ id: `l${i}` }));
    expect(decorSchema.safeParse({ ...base, lines: many }).success).toBe(false);
  });

  it("bozuk çizgiler okurken yalnızca çizgileri düşürür, diğer dekor kalır", () => {
    const stage = { id: "s", kind: "stage", x: 0, y: 0, width: 100, height: 50 };
    const decor = parseDecor({ ...base, elements: [stage], lines: [{ id: "bad" }] });
    expect(decor.elements).toHaveLength(1);
    expect(decor.lines).toBeUndefined();
  });

  it("şablon yerleşimi ve önizlemesi çizgileri taşır", () => {
    const layout = parseTemplateLayout({ version: 1, tables: [], decor: { ...base, lines: [line()] } });
    expect(layout.decor.lines).toEqual([line()]);
    const preview = buildTemplatePreview(layout);
    expect(preview.lines).toHaveLength(1);
    expect(preview.empty).toBe(false);
  });
});
