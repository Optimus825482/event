import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM } from "@/features/venue/editor/geometry";
import {
  PLAN_STATUS_COLORS,
  isTableSelectable,
  planStatusOf,
  statusByTable,
  statusColor,
} from "@/features/venue/plan-status";
import { centerOn, fitView, isZoomAtLimit, searchTables, zoomBy } from "@/features/venue/plan-view-math";

describe("durum -> renk", () => {
  it("eski sistemin renklerini kullanır", () => {
    expect(PLAN_STATUS_COLORS).toEqual({ free: "#22c55e", pending: "#f59e0b", confirmed: "#ef4444", checked_in: "#3b82f6" });
    expect(statusColor("confirmed")).toBe("#ef4444");
    expect(statusColor(undefined)).toBeUndefined();
  });

  it("iptal ve gelmedi masayı boş bırakır", () => {
    expect(planStatusOf("cancelled")).toBe("free");
    expect(planStatusOf("no_show")).toBe("free");
    expect(planStatusOf(null)).toBe("free");
    expect(planStatusOf("checked_in")).toBe("checked_in");
  });

  it("masada aktif kayıt, iptal kayıtlarından önceliklidir", () => {
    const map = statusByTable([
      { tableId: "a", status: "cancelled" },
      { tableId: "a", status: "confirmed" },
      { tableId: "b", status: "no_show" },
    ]);
    expect(map).toEqual({ a: "confirmed", b: "free" });
  });
});

describe("seçilebilirlik kuralı", () => {
  it("dolu masa seçilemez", () => {
    expect(isTableSelectable({ available: false, capacity: 10 })).toBe(false);
  });
  it("kişi sayısı kapasiteyi aşarsa seçilemez; eşitse seçilebilir", () => {
    expect(isTableSelectable({ available: true, capacity: 4 }, 5)).toBe(false);
    expect(isTableSelectable({ available: true, capacity: 4 }, 4)).toBe(true);
  });
  it("kişi sayısı yoksa ya da geçersizse yalnızca müsaitliğe bakar", () => {
    expect(isTableSelectable({ available: true, capacity: 4 })).toBe(true);
    expect(isTableSelectable({ available: true, capacity: 4 }, Number.NaN)).toBe(true);
  });
});

describe("sığdırma ve yakınlaştırma", () => {
  const canvas = { width: 1200, height: 800 };

  it("tuvali kapsayıcıda ortalar", () => {
    const view = fitView(canvas, { width: 600, height: 400 }, 0);
    expect(view.scale).toBeCloseTo(0.5);
    expect(view.x).toBeCloseTo(0);
    expect(view.y).toBeCloseTo(0);
    const wide = fitView(canvas, { width: 1200, height: 400 }, 0);
    expect(wide.scale).toBeCloseTo(0.5);
    expect(wide.x).toBeCloseTo(300);
  });

  it("ölçek sınırlarının içinde kalır", () => {
    expect(fitView(canvas, { width: 100000, height: 100000 }).scale).toBe(1.5);
    expect(fitView(canvas, { width: 10, height: 10 }).scale).toBe(MIN_ZOOM);
    expect(fitView({ width: 0, height: 0 }, { width: 10, height: 10 })).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("zoomBy kapsayıcı merkezini sabit tutar ve sınırlanır", () => {
    const container = { width: 400, height: 200 };
    const view = { scale: 1, x: 0, y: 0 };
    const next = zoomBy(view, container, 2);
    expect(next.scale).toBe(2);
    expect((200 - next.x) / next.scale).toBeCloseTo(200);
    expect(zoomBy({ scale: MAX_ZOOM, x: 0, y: 0 }, container, 2).scale).toBe(MAX_ZOOM);
    expect(isZoomAtLimit({ scale: MAX_ZOOM, x: 0, y: 0 }).max).toBe(true);
    expect(isZoomAtLimit(view)).toEqual({ min: false, max: false });
  });

  it("centerOn noktayı ortaya getirir", () => {
    const view = centerOn({ x: 100, y: 50 }, { width: 400, height: 200 }, { scale: 0.5, x: 0, y: 0 }, 1);
    expect(view.scale).toBe(1);
    expect(100 * view.scale + view.x).toBeCloseTo(200);
    expect(50 * view.scale + view.y).toBeCloseTo(100);
  });
});

describe("masa arama", () => {
  const tables = [{ label: "A1" }, { label: "A12" }, { label: "İstanbul 3" }, { label: "B2" }];
  it("büyük/küçük harf duyarsız eşleşir (Türkçe i dahil)", () => {
    expect(searchTables(tables, "a1").map((t) => t.label)).toEqual(["A1", "A12"]);
    expect(searchTables(tables, "istanbul").map((t) => t.label)).toEqual(["İstanbul 3"]);
  });
  it("boş sorgu hiçbir şey döndürmez", () => {
    expect(searchTables(tables, "  ")).toEqual([]);
  });
});
