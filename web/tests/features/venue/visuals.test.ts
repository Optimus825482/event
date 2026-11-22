import { describe, expect, it } from "vitest";
import { decorElementSchema, decorSchema, parseDecor, saveLayoutSchema } from "@/features/venue/schemas";
import { effectiveTableSize } from "@/features/venue/editor/geometry";
import { createEditorStore, decorKey, type InitialLayout } from "@/features/venue/editor/store";
import { ICON_PATHS, ICON_OPTIONS, resolveDecorStyle, supportsFullStyle } from "@/features/venue/components/decor-style";
import { computeLayoutStats } from "@/features/venue/components/layout-stats-core";
import {
  capacityColor,
  CAPACITY_COLORS,
  equalizeTargets,
  floorElevation,
  floorLabel,
  FLOOR_HEIGHT,
  tableDims,
} from "@/features/venue/components/table-visual";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const TYPE = "33333333-3333-4333-8333-333333333333";
const ATTRS = { isVip: false, isPinned: false, size: null, floor: 1, sortNumber: null } as const;

function layout(): InitialLayout {
  return {
    tables: [
      { id: ID1, label: "M1", capacity: 8, tableTypeId: TYPE, x: 100, y: 100, rotation: 0, isLoca: false, ...ATTRS },
      { id: ID2, label: "L1", capacity: 4, tableTypeId: null, x: 300, y: 100, rotation: 0, isLoca: true, ...ATTRS },
    ],
    decor: {
      width: 1200,
      height: 800,
      elements: [{ id: "s1", kind: "stage", x: 0, y: 0, width: 200, height: 80, rotation: 0, label: "Sahne", color: "#7c3aed" }],
    },
    lockedTableIds: [],
  };
}

describe("kapasite renkleri", () => {
  it("tam eşleşme ve en yakın renk (eşitlikte küçük kapasite)", () => {
    expect(capacityColor(4).fill).toBe("#22c55e");
    expect(capacityColor(20).fill).toBe("#f43f5e");
    expect(capacityColor(5).capacity).toBe(4);
    expect(capacityColor(7).capacity).toBe(6);
    expect(capacityColor(1).capacity).toBe(4);
    expect(capacityColor(100).capacity).toBe(20);
    expect(CAPACITY_COLORS).toHaveLength(8);
  });
});

describe("masa boyutu ve kat", () => {
  it("effectiveTableSize: size verilmişse o, yoksa kapasiteden türetilir", () => {
    expect(effectiveTableSize({ size: 56, capacity: 8, isLoca: false })).toBe(56);
    expect(effectiveTableSize({ size: null, capacity: 8, isLoca: false })).toBe(56);
    expect(effectiveTableSize({ size: null, capacity: 4, isLoca: false })).toBe(46);
  });

  it("tableDims: loca 1.2x0.9, dikdörtgen 0.6 oran, yuvarlak/kare eşit kenar", () => {
    expect(tableDims("round", true, 40)).toEqual({ width: 48, height: 36 });
    expect(tableDims("rectangle", false, 50)).toEqual({ width: 50, height: 30 });
    expect(tableDims("square", false, 40)).toEqual({ width: 40, height: 40 });
  });

  it("kat etiketleri ve 3B yükseklik", () => {
    expect(floorLabel(1)).toBe("Zemin Kat");
    expect(floorLabel(2)).toBe("2. Kat");
    expect(floorLabel(3)).toBe("3. Kat");
    expect(floorLabel(5)).toBe("5. Kat");
    expect(floorElevation(1)).toBe(0);
    expect(floorElevation(3)).toBe(2 * FLOOR_HEIGHT);
    expect(floorElevation(0)).toBe(0);
  });

  it("equalizeTargets: aynı tip + kapasite + loca durumu olan diğer masalar", () => {
    const t = (key: string, capacity: number, tableTypeId: string | null, isLoca = false) => ({ key, capacity, tableTypeId, isLoca });
    const all = [t("a", 8, TYPE), t("b", 8, TYPE), t("c", 8, null), t("d", 6, TYPE), t("e", 8, TYPE, true)];
    expect(equalizeTargets(all, "a")).toEqual(["b"]);
    expect(equalizeTargets(all, "zzz")).toEqual([]);
  });
});

describe("istatistikler", () => {
  it("masa/loca/kapasite/VIP ve tip + kapasite kırılımı", () => {
    const stats = computeLayoutStats(
      [
        { capacity: 8, isLoca: false, isVip: true, tableTypeId: TYPE },
        { capacity: 8, isLoca: false, isVip: false, tableTypeId: TYPE },
        { capacity: 4, isLoca: false, isVip: false, tableTypeId: null },
        { capacity: 6, isLoca: true, isVip: true, tableTypeId: null },
      ],
      (id) => (id === TYPE ? "Standart" : undefined),
    );
    expect(stats).toMatchObject({ tables: 3, locas: 1, capacity: 26, vip: 2 });
    expect(stats.byType).toEqual([
      { name: "Standart", count: 2, capacity: 16 },
      { name: "Loca", count: 1, capacity: 6 },
      { name: "Tipsiz", count: 1, capacity: 4 },
    ]);
    expect(stats.byCapacity.map((r) => [r.capacity, r.count, r.color])).toEqual([
      [4, 1, "#22c55e"],
      [6, 1, "#3b82f6"],
      [8, 2, "#6366f1"],
    ]);
  });

  it("boş yerleşim sıfır döner", () => {
    expect(computeLayoutStats([], () => undefined)).toEqual({ tables: 0, locas: 0, capacity: 0, vip: 0, byType: [], byCapacity: [] });
  });
});

describe("sahne/alan stili", () => {
  it("eski dekor (yeni alanlar yok) ayrıştırılır ve önceki görünümü korur", () => {
    const old = { width: 1000, height: 600, elements: [{ id: "a", kind: "area", x: 1, y: 2, width: 50, height: 60, label: "Alan", color: "#0ea5e9" }] };
    const parsed = decorSchema.parse(old);
    const el = parsed.elements[0];
    if (!el) throw new Error("öğe yok");
    expect(Object.keys(el)).not.toContain("borderColor");
    const style = resolveDecorStyle(el);
    expect(style).toMatchObject({ border: "#0ea5e9", borderWidth: 1, fontPx: 16, direction: "horizontal", icon: null, opacity: 0.3 });
    expect(parseDecor(old).elements).toHaveLength(1);
  });

  it("yeni alanlar ayrıştırılır; geçersiz değerler reddedilir", () => {
    const base = { id: "s", kind: "stage", x: 0, y: 0, width: 10, height: 10 };
    const ok = decorElementSchema.parse({
      ...base,
      borderColor: "#ffffff",
      borderWidth: 4,
      icon: "mic",
      fontSize: "xl",
      fontFamily: "oswald",
      textDirection: "vertical-up",
      tooltip: "  Ana sahne ",
      isPinned: true,
      floor: 2,
    });
    expect(ok).toMatchObject({ borderWidth: 4, icon: "mic", tooltip: "Ana sahne", isPinned: true, floor: 2 });
    for (const bad of [{ borderWidth: 7 }, { borderColor: "white" }, { icon: "rocket" }, { fontSize: "huge" }, { textDirection: "diag" }, { floor: 0 }]) {
      expect(decorElementSchema.safeParse({ ...base, ...bad }).success).toBe(false);
    }
  });

  it("simge tablosu seçeneklerle tutarlı; yalnızca sahne/alan tam stil alır", () => {
    for (const o of ICON_OPTIONS) if (o.id !== "none") expect(ICON_PATHS[o.id]).toBeTruthy();
    expect(supportsFullStyle("stage") && supportsFullStyle("area")).toBe(true);
    expect(supportsFullStyle("wall") || supportsFullStyle("label")).toBe(false);
  });
});

describe("düzenleyici: görünüm alanları", () => {
  it("VIP, sabitleme, boyut ve kat güncellemesi kaydedilen girdiye yansır", () => {
    const store = createEditorStore(layout());
    const { updateTables } = store.getState();
    updateTables(["t:" + ID1], { isVip: true, isPinned: true, size: 56, floor: 2 });
    const saved = store.getState().toSaveInput();
    expect(saved.tables[0]).toMatchObject({ isVip: true, isPinned: true, size: 56, floor: 2 });
    expect(saveLayoutSchema.safeParse({ eventId: ID1, ...saved }).success).toBe(true);
    store.getState().undo();
    expect(store.getState().tables[0]).toMatchObject({ isVip: false, isPinned: false, size: null, floor: 1 });
  });

  it("dekor stil yaması saklanır ve kaydedilen şemadan geçer", () => {
    const store = createEditorStore(layout());
    // Depo yama tipi dar; çalışma zamanında tüm alanlar birleştirilir (geniş tipli değişken ortak alan `color` içerir).
    const patch = { color: "#7c3aed", borderColor: "#fbbf24", borderWidth: 3, icon: "mic", textDirection: "vertical-down", tooltip: "Ana sahne" } as const;
    store.getState().updateDecor(decorKey("s1"), patch);
    const saved = store.getState().toSaveInput();
    expect(saved.decor.elements[0]).toMatchObject({ borderWidth: 3, icon: "mic", textDirection: "vertical-down", tooltip: "Ana sahne" });
    expect(saveLayoutSchema.safeParse({ eventId: ID1, ...saved }).success).toBe(true);
  });
});
