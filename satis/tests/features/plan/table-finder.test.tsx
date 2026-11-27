// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPlanModel } from "@/features/plan/model";
import { TableFinder } from "@/features/plan/table-finder";
import type { EventDetail } from "@/lib/core/contract";

afterEach(cleanup);

const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const prices: EventDetail["prices"] = [
  { category: "standard", label: "Standart", price: "1500.00" },
  { category: "vip", label: "VIP", price: "4000.00" },
];
const model = buildPlanModel(
  {
    canvas: { width: 1200, height: 800 },
    tables: [
      {
        id: "m12",
        label: "M-12",
        x: 100,
        y: 100,
        rotation: 0,
        shape: "round",
        isLoca: false,
        sellable: true,
        category: "standard",
        capacity: 8,
        seats: 8,
        seatNos: seq(8),
        wholeOnly: false,
      },
      {
        id: "l1",
        label: "L-1",
        x: 200,
        y: 100,
        rotation: 0,
        shape: "rectangle",
        isLoca: true,
        sellable: true,
        category: "vip",
        capacity: 6,
        seats: 6,
        seatNos: seq(6),
        wholeOnly: true,
      },
    ],
    decor: [],
    lines: [],
  },
  prices,
  {
    at: "x",
    tables: [
      { id: "m12", free: 6, freeSeats: seq(6) },
      { id: "l1", free: 6, freeSeats: seq(6) },
    ],
  },
  "seat",
);

describe("TableFinder", () => {
  it("arama kutusu ve tür düğmeleri değişikliği üst bileşene bildirir; etkin tür basılıdır", () => {
    const onQuery = vi.fn();
    const onKind = vi.fn();
    render(
      <TableFinder
        tables={model.tables}
        query=""
        kind="table"
        partySize={2}
        activeTableId={null}
        pickedIds={new Set()}
        prices={prices}
        currency="TRY"
        onQuery={onQuery}
        onKind={onKind}
        onFocus={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Masa" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Loca" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Loca" }));
    expect(onKind).toHaveBeenCalledWith("loca");
    fireEvent.change(screen.getByRole("searchbox", { name: "Masa numarası ara" }), { target: { value: "12" } });
    expect(onQuery).toHaveBeenCalledWith("12");
  });

  it("masa satırı etiket, kategori, boş sayısı ve fiyatı taşır; seçili ve etkin masa işaretlidir", () => {
    const onFocus = vi.fn();
    render(
      <TableFinder
        tables={model.tables}
        query=""
        kind="all"
        partySize={2}
        activeTableId="m12"
        pickedIds={new Set(["m12"])}
        prices={prices}
        currency="TRY"
        onQuery={() => {}}
        onKind={() => {}}
        onFocus={onFocus}
      />,
    );
    const m12Btn = screen.getByRole("button", { name: /Masa M-12/ });
    expect(m12Btn.getAttribute("aria-pressed")).toBe("true");
    expect(m12Btn.textContent).toContain("Standart");
    expect(m12Btn.textContent).toContain("boş 6/8");
    expect(m12Btn.textContent).toContain("1.500,00 ₺");
    expect(m12Btn.textContent).toContain("seçildi");

    const l1Btn = screen.getByRole("button", { name: /Loca L-1/ });
    expect(l1Btn.textContent).toContain("bütün olarak");
    expect(l1Btn.textContent).toContain("6 kişilik");
    fireEvent.click(l1Btn);
    expect(onFocus).toHaveBeenCalledWith("l1");
  });

  it("sonuç yokken açıklama gösterilir", () => {
    render(
      <TableFinder
        tables={[]}
        query="999"
        kind="all"
        partySize={2}
        activeTableId={null}
        pickedIds={new Set()}
        prices={prices}
        currency="TRY"
        onQuery={() => {}}
        onKind={() => {}}
        onFocus={() => {}}
      />,
    );
    expect(screen.getByText("Aramaya uyan masa yok.")).toBeTruthy();
  });
});
