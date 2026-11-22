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

  it("masa nitelikleri eşlenir: isVip, isLocked→isPinned, size, floor, sayısal tableNumber→sortNumber", () => {
    const out = parseLayout({
      placedTables: [
        { id: "a", tableNumber: 7, capacity: 8, x: 0, y: 0, isVip: true, isLocked: true, size: 60, floor: 3 },
        { id: "b", tableNumber: "12", capacity: 8, x: 0, y: 0 },
        { id: "c", tableNumber: "A-1", capacity: 8, x: 0, y: 0, isVip: "yes", size: 500, floor: 12 },
        { id: "d", tableNumber: 2.5, capacity: 8, x: 0, y: 0, size: -4, floor: 0 },
      ],
    });
    const pick = (i: number) => {
      const t = out.tables[i];
      return t && { isVip: t.isVip, isPinned: t.isPinned, size: t.size, floor: t.floor, sortNumber: t.sortNumber };
    };
    expect(pick(0)).toEqual({ isVip: true, isPinned: true, size: 60, floor: 3, sortNumber: 7 });
    expect(pick(1)).toEqual({ isVip: false, isPinned: false, size: null, floor: 1, sortNumber: 12 });
    expect(pick(2)).toEqual({ isVip: false, isPinned: false, size: 400, floor: 9, sortNumber: null });
    expect(pick(3)).toEqual({ isVip: false, isPinned: false, size: null, floor: 1, sortNumber: null });
    expect(out.issues.filter((i) => i.kind === "floor_adjusted").map((i) => [i.legacyId, i.detail])).toEqual([
      ["c", "12 → 9"],
      ["d", "0 → 1"],
    ]);
    // Bu anahtarlar artık "düşürülen özellik" olarak raporlanmaz.
    expect(out.droppedTableProps).toEqual({});
  });

  it("koordinat: eski x/y kutunun sol-üstüdür, yeni merkezdir (size/2 eklenir, varsayılan 40)", () => {
    const out = parseLayout({
      placedTables: [
        { id: "a", tableNumber: 1, capacity: 8, x: 100, y: 200 },
        { id: "b", tableNumber: 2, capacity: 8, x: 100, y: 200, size: 60 },
        { id: "c", tableNumber: 3, capacity: 8, x: 99_990, y: -99_990, size: 80 },
        { id: "d", tableNumber: 4, capacity: 8 },
      ],
    });
    expect(out.tables.map((t) => [t.x, t.y])).toEqual([
      [120, 220],
      [130, 230],
      [100_000, -99_950],
      [0, 0],
    ]);
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
