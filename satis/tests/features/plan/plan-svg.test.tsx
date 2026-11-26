// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPlanModel } from "@/features/plan/model";
import { PlanSvg } from "@/features/plan/plan-svg";
import type { EventDetail } from "@/lib/core/contract";

afterEach(cleanup);

type Table = EventDetail["plan"]["tables"][number];
const t = (id: string, label: string, extra: Partial<Table> = {}): Table => ({
  id, label, x: 100, y: 100, rotation: 0, shape: "round", isLoca: false, sellable: true, category: "standard", seats: 8, wholeOnly: false, ...extra,
});
const plan: EventDetail["plan"] = {
  canvas: { width: 1200, height: 800 },
  tables: [t("a1", "A1"), t("a2", "A2", { x: 200 }), t("c1", "C1", { x: 300, sellable: false, category: null, seats: null })],
  decor: [{ id: "s", kind: "stage", x: 600, y: 60, width: 300, height: 80, label: "Sahne" }],
  lines: [],
};
const prices: EventDetail["prices"] = [{ category: "standard", label: "Standart", price: "1500.00" }];
const m = buildPlanModel(plan, prices, { at: "x", tables: [{ id: "a1", free: 5 }, { id: "a2", free: 0 }] });

describe("PlanSvg", () => {
  it("masalar erişilebilir adla ve kalan sandalyeyle çizilir", () => {
    render(<PlanSvg model={m} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Masa A1, Standart, boş sandalye 5/8" })).toBeTruthy();
    expect(screen.getByText("5/8")).toBeTruthy();
    expect(screen.getByText("Sahne")).toBeTruthy();
  });
  it("boş masaya tıklamak kimliği bildirir; dolu ve satışta olmayan masa bildirmez", () => {
    const onSelect = vi.fn();
    render(<PlanSvg model={m} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Masa A1/ }));
    expect(onSelect).toHaveBeenCalledWith("a1");
    fireEvent.click(screen.getByRole("button", { name: /Masa A2, Standart, dolu/ }));
    fireEvent.click(screen.getByRole("button", { name: /Masa C1/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
  it("klavyede Enter seçer; yalnızca alınabilir masa odaklanır", () => {
    const onSelect = vi.fn();
    render(<PlanSvg model={m} selectedId={null} onSelect={onSelect} />);
    const a1 = screen.getByRole("button", { name: /Masa A1/ });
    expect(a1.getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("button", { name: /Masa C1/ }).getAttribute("tabindex")).toBe("-1");
    fireEvent.keyDown(a1, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("a1");
  });
  it("seçili masa aria-pressed taşır", () => {
    render(<PlanSvg model={m} selectedId="a1" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Masa A1/ }).getAttribute("aria-pressed")).toBe("true");
  });
  it("araç düğmeleri adlandırılmıştır", () => {
    render(<PlanSvg model={m} selectedId={null} />);
    for (const name of ["Yakınlaştır", "Uzaklaştır", "Sığdır"]) expect(screen.getByRole("button", { name })).toBeTruthy();
  });
  it("salt görüntülemede masalar düğme değildir ve odaklanmaz", () => {
    render(<PlanSvg model={m} selectedId={null} />);
    const a1 = screen.getByRole("img", { name: /Masa A1/ });
    expect(a1.getAttribute("tabindex")).toBeNull();
    expect(screen.queryByRole("button", { name: /Masa A1/ })).toBeNull();
  });
  it("dekor merkezi sol-üst köşeden hesaplanır (600,60 300x80 → 750,100)", () => {
    const { container } = render(<PlanSvg model={m} selectedId={null} />);
    expect(container.querySelector('g[transform="translate(750 100) rotate(0)"]')).not.toBeNull();
  });
  it("etkileşimli masada ayrı odak halkası şekli vardır", () => {
    const { container } = render(<PlanSvg model={m} selectedId={null} onSelect={vi.fn()} />);
    const ring = container.querySelector("[data-focus-ring]");
    expect(ring?.getAttribute("vector-effect")).toBe("non-scaling-stroke");
  });
});
