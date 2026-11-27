// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveTableCard } from "@/features/plan/active-table-card";
import { buildPlanModel } from "@/features/plan/model";
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
        id: "g1",
        label: "G1",
        x: 100,
        y: 100,
        rotation: 0,
        shape: "round",
        isLoca: false,
        sellable: true,
        category: "standard",
        capacity: 8,
        seats: 6,
        seatNos: [1, 2, 3, 5, 6, 8],
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
      { id: "g1", free: 3, freeSeats: [1, 2, 5] },
      { id: "l1", free: 6, freeSeats: seq(6) },
    ],
  },
  "seat",
);

describe("ActiveTableCard", () => {
  it("düğmeler yuva numaralarından üretilir; olmayan numaranın düğmesi yoktur", () => {
    const g1 = model.tables[0]!;
    render(
      <ActiveTableCard
        table={g1}
        pick={null}
        unitPrice="1500.00"
        currency="TRY"
        onToggleSeat={() => {}}
        onToggleWhole={() => {}}
      />,
    );
    for (const no of [1, 2, 3, 5, 6, 8]) {
      expect(screen.getByRole("button", { name: new RegExp(`Sandalye ${no},`) })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: /Sandalye 4,/ })).toBeNull();
    expect(screen.getByText("2 sandalye satışa kapalı.")).toBeTruthy();
  });

  it("dolu sandalye devre dışıdır, seçili sandalye basılı görünür", () => {
    const g1 = model.tables[0]!;
    render(
      <ActiveTableCard
        table={g1}
        pick={{ tableId: "g1", whole: false, seatNos: [2] }}
        unitPrice="1500.00"
        currency="TRY"
        onToggleSeat={() => {}}
        onToggleWhole={() => {}}
      />,
    );
    const s3 = screen.getByRole("button", { name: "Sandalye 3, dolu" }) as HTMLButtonElement;
    expect(s3.disabled).toBe(true);
    const s2 = screen.getByRole("button", { name: "Sandalye 2, seçili" });
    expect(s2.getAttribute("aria-pressed")).toBe("true");
    const s1 = screen.getByRole("button", { name: "Sandalye 1, boş" });
    expect(s1.getAttribute("aria-pressed")).toBe("false");
  });

  it("sandalye düğmesi gerçek button'dır ve tıklayınca numarasıyla bildirir", () => {
    const g1 = model.tables[0]!;
    const onToggleSeat = vi.fn();
    render(
      <ActiveTableCard
        table={g1}
        pick={null}
        unitPrice="1500.00"
        currency="TRY"
        onToggleSeat={onToggleSeat}
        onToggleWhole={() => {}}
      />,
    );
    const s5 = screen.getByRole("button", { name: "Sandalye 5, boş" }) as HTMLButtonElement;
    expect(s5.tagName).toBe("BUTTON");
    expect(s5.type).toBe("button");
    fireEvent.click(s5);
    expect(onToggleSeat).toHaveBeenCalledWith(5);
  });

  it("bütün alınan masada sandalye düğmesi yoktur; tek düğme ve '6 kişilik masa · 6 bilet' yazar", () => {
    const l1 = model.tables[1]!;
    const onToggleWhole = vi.fn();
    render(
      <ActiveTableCard
        table={l1}
        pick={null}
        unitPrice="4000.00"
        currency="TRY"
        onToggleSeat={() => {}}
        onToggleWhole={onToggleWhole}
      />,
    );
    expect(screen.queryByRole("button", { name: /Sandalye/ })).toBeNull();
    expect(screen.getByText("6 kişilik masa · 6 bilet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Masanın tamamını seç" }));
    expect(onToggleWhole).toHaveBeenCalledTimes(1);
  });

  it("masa seçili değilken yönlendirme metni çıkar", () => {
    render(
      <ActiveTableCard
        table={null}
        pick={null}
        unitPrice={null}
        currency="TRY"
        onToggleSeat={() => {}}
        onToggleWhole={() => {}}
      />,
    );
    expect(screen.getByText("Plandan ya da listeden bir masa seçin.")).toBeTruthy();
  });
});
