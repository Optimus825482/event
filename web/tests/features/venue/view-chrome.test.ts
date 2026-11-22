import { describe, expect, it } from "vitest";
import { distinctGroups, groupsByTable, safeGroupColor } from "@/features/venue/editor/groups";
import { createEditorStore } from "@/features/venue/editor/store";
import { cellName, columnLabel, resolveViewSettings, rulerTicks } from "@/features/venue/editor/view-chrome";

const empty = { tables: [], decor: { width: 1200, height: 800, elements: [] }, lockedTableIds: [] };

describe("columnLabel / cellName", () => {
  it("A–Z ve sonrası AA", () => {
    expect(columnLabel(0)).toBe("A");
    expect(columnLabel(25)).toBe("Z");
    expect(columnLabel(26)).toBe("AA");
    expect(columnLabel(27)).toBe("AB");
  });

  it("hücre adı sütun harfi + 1 tabanlı satır", () => {
    expect(cellName({ x: 0, y: 0 }, 40)).toBe("A1");
    expect(cellName({ x: 79, y: 119 }, 40)).toBe("B3");
    expect(cellName({ x: 80, y: 0 }, 40)).toBe("C1");
  });

  it("tuval dışı ve geçersiz hücre boyutu null", () => {
    expect(cellName({ x: -1, y: 5 }, 40)).toBeNull();
    expect(cellName({ x: 5, y: 5 }, 0)).toBeNull();
  });
});

describe("rulerTicks", () => {
  it("hücre merkezlerini ölçek ve kaydırmaya göre yerleştirir", () => {
    const ticks = rulerTicks("x", 120, 40, { scale: 1, offset: 10 }, 10);
    expect(ticks.map((t) => [t.label, t.center])).toEqual([
      ["A", 30],
      ["B", 70],
      ["C", 110],
    ]);
  });

  it("dar ölçekte etiketleri seyreltir; y ekseni sayı etiketleri", () => {
    const x = rulerTicks("x", 1200, 40, { scale: 0.2, offset: 0 }, 28);
    expect(x.length).toBeLessThan(30);
    expect(x[0]?.index).toBe(0);
    const y = rulerTicks("y", 80, 40, { scale: 1, offset: 0 }, 10);
    expect(y.map((t) => t.label)).toEqual(["1", "2"]);
  });

  it("geçersiz girdide boş döner", () => {
    expect(rulerTicks("x", 100, 0, { scale: 1, offset: 0 })).toEqual([]);
    expect(rulerTicks("x", 100, 40, { scale: 0, offset: 0 })).toEqual([]);
  });
});

describe("resolveViewSettings", () => {
  it("geçersizde varsayılan; aralığa sıkıştırır", () => {
    expect(resolveViewSettings(undefined)).toEqual({ gridSize: 20, snap: true, showGrid: true });
    expect(resolveViewSettings({ gridSize: 1000, snap: false, showGrid: false })).toEqual({ gridSize: 100, snap: false, showGrid: false });
    expect(resolveViewSettings({ gridSize: 1, snap: "x" })).toEqual({ gridSize: 5, snap: true, showGrid: true });
    expect(resolveViewSettings({ gridSize: Number.NaN }).gridSize).toBe(20);
  });
});

describe("editör: görünüm ayarları ve ızgara", () => {
  it("varsayılan ızgara görünür, yapışma açık", () => {
    const s = createEditorStore(empty).getState();
    expect(s.showGrid).toBe(true);
    expect(s.snapEnabled).toBe(true);
    expect(s.gridSize).toBe(20);
  });

  it("sistem ayarları başlangıç durumunu belirler; ızgara gizleme geçmişe/dirty'ye yazılmaz", () => {
    const store = createEditorStore(empty, { gridSize: 10, snap: false, showGrid: false });
    expect(store.getState()).toMatchObject({ gridSize: 10, snapEnabled: false, showGrid: false });
    store.getState().setShowGrid(true);
    expect(store.getState().showGrid).toBe(true);
    expect(store.getState().dirty).toBe(false);
    expect(store.getState().history.past).toHaveLength(0);
  });
});

describe("masa grupları", () => {
  it("geçersiz rengi varsayılana düşürür", () => {
    expect(safeGroupColor("#ff0000")).toBe("#ff0000");
    expect(safeGroupColor("red; x")).toBe("#3b82f6");
    expect(safeGroupColor(null)).toBe("#3b82f6");
  });

  it("masa başına tek grup (ilk kayıt), tekil açıklama ada göre sıralı", () => {
    const map = groupsByTable([
      { tableId: "t1", name: "B Grubu", color: "#00ff00" },
      { tableId: "t1", name: "A Grubu", color: "#ff0000" },
      { tableId: "t2", name: "B Grubu", color: "#00ff00" },
      { tableId: "t3", name: "A Grubu", color: "bad" },
    ]);
    expect(map.get("t1")).toEqual({ name: "B Grubu", color: "#00ff00" });
    expect(map.get("t3")?.color).toBe("#3b82f6");
    expect(distinctGroups(map.values()).map((g) => g.name)).toEqual(["A Grubu", "B Grubu"]);
  });
});
