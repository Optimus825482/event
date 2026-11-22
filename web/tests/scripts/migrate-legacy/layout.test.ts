import { describe, expect, it } from "vitest";
import { decorSchema } from "@/features/venue/schemas";
import { parseLayout } from "../../../scripts/migrate-legacy/layout";
import { parseArgs } from "../../../scripts/migrate-legacy/index";
import { stableId, toTime } from "../../../scripts/migrate-legacy/values";

describe("parseLayout", () => {
  it("placedTables biçimi: etiket önceliği loca adı → masa numarası → etiket", () => {
    const out = parseLayout({
      placedTables: [
        { id: "a", tableNumber: 7, capacity: 10, x: 1, y: 2 },
        { id: "b", isLoca: true, locaName: "L2", tableNumber: 8, capacity: 4, x: 3, y: 4 },
        { id: "c", label: "Bahçe", x: 0, y: 0 },
      ],
    });
    expect(out.sourceKeys).toEqual(["placedTables"]);
    expect(out.tables.map((t) => [t.legacyId, t.label, t.capacity, t.isLoca])).toEqual([
      ["a", "7", 10, false],
      ["b", "L2", 4, true],
      ["c", "Bahçe", 8, false],
    ]);
    expect(out.issues).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "capacity_adjusted", legacyId: "c" })]));
  });

  it("tables biçimi (eski entity tipi) ve ikisi birden: kimliğe göre birleşir", () => {
    const old = parseLayout({ tables: [{ id: "T1", label: "1", capacity: 4, x: 0, y: 0, rotation: 90, type: "loca" }] });
    expect(old.sourceKeys).toEqual(["tables"]);
    expect(old.tables[0]).toMatchObject({ label: "1", rotation: 90, isLoca: true, typeRef: "loca" });

    const both = parseLayout({
      placedTables: [{ id: "x", tableNumber: 1, capacity: 4, x: 0, y: 0 }],
      tables: [
        { id: "x", label: "1", capacity: 4, x: 0, y: 0 },
        { id: "y", label: "2", capacity: 4, x: 0, y: 0 },
      ],
    });
    expect(both.tables.map((t) => t.legacyId)).toEqual(["x", "y"]);
    expect(both.issues.map((i) => i.kind)).toContain("both_layout_keys");
  });

  it("çakışan ve uzun etiketler benzersizleştirilir (20 karakter, büyük/küçük harf duyarsız)", () => {
    const out = parseLayout({
      tables: [
        { id: "1", label: "Masa", x: 0, y: 0 },
        { id: "2", label: "MASA", x: 0, y: 0 },
        { id: "3", label: "Çok uzun bir masa etiketi burada", x: 0, y: 0 },
      ],
    });
    expect(out.tables.map((t) => t.label)).toEqual(["Masa", "MASA (2)", "Çok uzun bir masa et"]);
  });

  it("dekor decorSchema'ya uyar; desteklenmeyen anahtarlar raporlanır", () => {
    const out = parseLayout({
      placedTables: [],
      stageElements: [
        { id: "s", type: "stage", x: 0, y: 0, width: 100, height: 50, label: "Sahne", color: "red", fontSize: "12" },
        { id: "bad", type: "area", x: 0, y: 0, width: 0, height: 10 },
      ],
      drawnLines: [{ id: "l", points: [{ x: 10, y: 10 }, { x: 110, y: 10 }], width: 6, color: "#00ff00" }],
      dimensions: { width: 50, height: 99_999 },
      tablePlans: [{ id: "p" }],
      stageConfig: "",
    });
    expect(decorSchema.safeParse(out.decor).success).toBe(true);
    expect(out.decor.width).toBe(200);
    expect(out.decor.height).toBe(20_000);
    expect(out.decor.elements).toEqual([
      { id: "s", kind: "stage", x: 0, y: 0, width: 100, height: 50, rotation: 0, label: "Sahne" },
      { id: "l", kind: "wall", x: 10, y: 10, width: 100, height: 6, rotation: 0, label: "", color: "#00ff00" },
    ]);
    expect(out.droppedKeys).toEqual(["tablePlans"]);
    expect(out.droppedDecorProps).toEqual({ fontSize: 1 });
    expect(out.issues.map((i) => i.kind)).toContain("decor_skipped");
    expect(out.convertedLines).toBe(1);
  });

  it("NULL ve bozuk yerleşim boş sonuç verir", () => {
    expect(parseLayout(null).tables).toEqual([]);
    const broken = parseLayout("oops");
    expect(broken.tables).toEqual([]);
    expect(broken.issues.map((i) => i.kind)).toEqual(["layout_not_object"]);
  });
});

describe("yardımcılar", () => {
  it("toTime eski varchar saatleri dönüştürür", () => {
    expect(toTime("9:05")).toEqual({ value: "09:05:00", ok: true });
    expect(toTime("21:30:15")).toEqual({ value: "21:30:15", ok: true });
    expect(toTime("")).toEqual({ value: null, ok: true });
    expect(toTime("25:99")).toEqual({ value: null, ok: false });
    expect(toTime("akşam")).toEqual({ value: null, ok: false });
  });

  it("stableId deterministik bir v5 uuid'dir", () => {
    const a = stableId("event-table", "e", "t-1");
    expect(a).toBe(stableId("event-table", "e", "t-1"));
    expect(a).not.toBe(stableId("event-table", "e", "t-2"));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("parseArgs bayrakları okur, bilinmeyeni reddeder", () => {
    expect(parseArgs(["--dry-run", "--report", "out/r", "--force-empty-check=off"])).toEqual({
      dryRun: true,
      reportPath: "out/r",
      emptyCheck: false,
    });
    expect(() => parseArgs(["--nope"])).toThrow(/Bilinmeyen/);
    expect(() => parseArgs(["--default-organizer", "x"])).toThrow(/uuid/);
  });
});
