// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPlanModel } from "@/features/plan/model";
import { missingReason } from "@/features/plan/picks";
import { SelectionSummary } from "@/features/plan/selection-summary";
import type { EventDetail } from "@/lib/core/contract";

afterEach(cleanup);

const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const prices: EventDetail["prices"] = [{ category: "standard", label: "Standart", price: "1500.00" }];
const model = buildPlanModel(
  {
    canvas: { width: 1200, height: 800 },
    tables: [
      {
        id: "a1",
        label: "A1",
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
        label: "L1",
        x: 200,
        y: 100,
        rotation: 0,
        shape: "rectangle",
        isLoca: true,
        sellable: true,
        category: "standard",
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
      { id: "a1", free: 8, freeSeats: seq(8) },
      { id: "l1", free: 6, freeSeats: seq(6) },
    ],
  },
  "seat",
);

describe("SelectionSummary", () => {
  it("kalemler masa ve sandalye numaralarıyla listelenir; Kaldır o masayı bildirir", () => {
    const onRemove = vi.fn();
    render(
      <SelectionSummary
        state={{
          partySize: 4,
          activeTableId: "a1",
          picks: [
            { tableId: "a1", whole: false, seatNos: [4, 7] },
            { tableId: "l1", whole: true },
          ],
        }}
        model={model}
        total="12000.00"
        currency="TRY"
        readiness={{ ready: false, reason: null }}
        pending={false}
        onRemove={onRemove}
        onFocus={() => {}}
        onContinue={() => {}}
      />,
    );
    expect(screen.getByText(/Masa A1 · sandalye 4, 7/)).toBeTruthy();
    expect(screen.getByText(/Loca L1 · tamamı \(6 kişi\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Masa A1 seçimini kaldır" }));
    expect(onRemove).toHaveBeenCalledWith("a1");
  });

  it("sayaç durum bölgesinde duyurulur", () => {
    render(
      <SelectionSummary
        state={{ partySize: 4, activeTableId: "a1", picks: [{ tableId: "a1", whole: false, seatNos: [4, 7] }] }}
        model={model}
        total="3000.00"
        currency="TRY"
        readiness={{ ready: false, reason: missingReason(2) }}
        pending={false}
        onRemove={() => {}}
        onFocus={() => {}}
        onContinue={() => {}}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("2/4 kişi seçildi");
  });

  it("hazır değilken Devam et kapalıdır ve neden görünür; hazırken açıktır", () => {
    const { rerender } = render(
      <SelectionSummary
        state={{ partySize: 4, activeTableId: "a1", picks: [{ tableId: "a1", whole: false, seatNos: [1, 2] }] }}
        model={model}
        total="3000.00"
        currency="TRY"
        readiness={{ ready: false, reason: missingReason(2) }}
        pending={false}
        onRemove={() => {}}
        onFocus={() => {}}
        onContinue={() => {}}
      />,
    );
    expect(screen.getByText(missingReason(2))).toBeTruthy();
    expect((screen.getByRole("button", { name: "Devam et" }) as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <SelectionSummary
        state={{ partySize: 2, activeTableId: "a1", picks: [{ tableId: "a1", whole: false, seatNos: [1, 2] }] }}
        model={model}
        total="3000.00"
        currency="TRY"
        readiness={{ ready: true, items: [{ tableId: "a1", quantity: 2, seatNos: [1, 2] }] }}
        pending={false}
        onRemove={() => {}}
        onFocus={() => {}}
        onContinue={() => {}}
      />,
    );
    expect((screen.getByRole("button", { name: "Devam et" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("tutma sürerken düğme kapalıdır ve 'Yeriniz ayrılıyor…' yazar", () => {
    render(
      <SelectionSummary
        state={{ partySize: 2, activeTableId: "a1", picks: [{ tableId: "a1", whole: false, seatNos: [1, 2] }] }}
        model={model}
        total="3000.00"
        currency="TRY"
        readiness={{ ready: true, items: [{ tableId: "a1", quantity: 2, seatNos: [1, 2] }] }}
        pending
        onRemove={() => {}}
        onFocus={() => {}}
        onContinue={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: "Yeriniz ayrılıyor…" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("fiyatsız seçimde tutar yerine açıklama çıkar ve düğme kapalıdır", () => {
    render(
      <SelectionSummary
        state={{ partySize: 2, activeTableId: "a1", picks: [{ tableId: "a1", whole: false, seatNos: [1, 2] }] }}
        model={model}
        total={null}
        currency="TRY"
        readiness={{ ready: true, items: [{ tableId: "a1", quantity: 2, seatNos: [1, 2] }] }}
        pending={false}
        onRemove={() => {}}
        onFocus={() => {}}
        onContinue={() => {}}
      />,
    );
    expect(screen.getByText("Seçilen masalardan birinin fiyatı henüz belirlenmedi.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Devam et" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
