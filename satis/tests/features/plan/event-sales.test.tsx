// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventSales, SEAT_TAKEN_MESSAGE } from "@/features/plan/event-sales";
import { seatTakenNotice } from "@/features/plan/picks";
import type { Availability, EventDetail } from "@/lib/core/contract";

const pushMock = vi.fn();
const refreshRouterMock = vi.fn();
const holdActionMock = vi.fn();
const refreshAvailMock = vi.fn();
const patchAvailMock = vi.fn();

let mockAvailability: Availability;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshRouterMock }),
}));

vi.mock("@/features/checkout/actions", () => ({
  holdAction: (...args: unknown[]) => holdActionMock(...args),
}));

vi.mock("@/features/plan/use-availability", () => ({
  useAvailability: () => ({
    availability: mockAvailability,
    stale: false,
    refresh: refreshAvailMock,
    patch: patchAvailMock,
  }),
}));

vi.mock("@/features/plan/plan-viewer", () => ({
  PlanViewer: ({
    model,
    view,
    onTable,
    onSeat,
  }: {
    model: { tables: { id: string; label: string }[] };
    view: { can3d: boolean; failed: boolean };
    onTable?: (id: string) => void;
    onSeat?: (id: string, seatNo: number) => void;
  }) => (
    <div data-testid="mock-plan-viewer" data-can3d={String(view.can3d)} data-failed={String(view.failed)}>
      {onTable
        ? model.tables.map((t) => (
            <button key={t.id} type="button" onClick={() => onTable(t.id)}>
              Plan-{t.label}
            </button>
          ))
        : null}
      {onSeat ? (
        <button type="button" onClick={() => onSeat("a1", 4)}>
          PlanSeat-A1-4
        </button>
      ) : null}
    </div>
  ),
}));

const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

function makeEvent(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: "evt-1",
    name: "Yılbaşı Galası",
    startsAt: "2026-12-31T20:00:00Z",
    endsAt: null,
    artistName: null,
    eventType: null,
    coverImage: null,
    artistImage: null,
    isDemo: false,
    currency: "TRY",
    minPrice: "1500.00",
    saleState: "open",
    description: null,
    sale: {
      state: "open",
      mode: "seat",
      opensAt: null,
      closesAt: null,
      holdMinutes: 10,
      maxSeatsPerOrder: 12,
      blockSingleLeftover: true,
      demo: false,
      ...(overrides.sale ?? {}),
    },
    site: {
      heroImage: null,
      summary: null,
      doorsOpenAt: null,
      ageLimit: null,
      dressCode: null,
      sightlineSet: null,
      ...(overrides.site ?? {}),
    },
    prices: [
      { category: "standard", label: "Standart", price: "1500.00" },
      { category: "vip", label: "VIP", price: "4000.00" },
    ],
    plan: {
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
          id: "a2",
          label: "A2",
          x: 200,
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
      ],
      decor: [],
      lines: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
  mockAvailability = {
    at: "2026-12-01T10:00:00Z",
    tables: [
      { id: "a1", free: 8, freeSeats: seq(8) },
      { id: "a2", free: 8, freeSeats: seq(8) },
    ],
  };
});

afterEach(cleanup);

describe("EventSales", () => {
  it("kişi sayısı verilmemişse önce kişi sayısı sorulur; onaylanınca plan ve panel açılır", () => {
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} />);
    expect(screen.getByLabelText("Kaç kişisiniz?")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Seçiminiz" })).toBeNull();

    fireEvent.submit(screen.getByLabelText("Kaç kişisiniz?").closest("form")!);
    expect(screen.getByRole("region", { name: "Seçiminiz" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("0/2 kişi seçildi");
  });

  it("kişi sayısı verilmişse adım atlanır ve sayaç o sayıyla başlar", () => {
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={4} />);
    expect(screen.queryByLabelText("Kaç kişisiniz?")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("0/4 kişi seçildi");
  });

  it("satış kapalıyken plan salt okunurdur: kişi adımı, panel ve Devam et yoktur", () => {
    render(
      <EventSales
        event={makeEvent({
          sale: {
            state: "closed",
            mode: "seat",
            opensAt: null,
            closesAt: null,
            holdMinutes: 10,
            maxSeatsPerOrder: 12,
            blockSingleLeftover: true,
            demo: false,
          },
        })}
        initialAvailability={mockAvailability}
      />,
    );
    expect(screen.getByTestId("mock-plan-viewer")).toBeTruthy();
    expect(screen.queryByLabelText("Kaç kişisiniz?")).toBeNull();
    expect(screen.queryByRole("region", { name: "Seçiminiz" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Devam et" })).toBeNull();
  });

  it("satış kapalıyken de masaya dokununca sahne görüşü o masayı gösterir; sandalye seçimi yoktur", () => {
    render(
      <EventSales
        event={makeEvent({
          sale: {
            state: "closed",
            mode: "seat",
            opensAt: null,
            closesAt: null,
            holdMinutes: 10,
            maxSeatsPerOrder: 12,
            blockSingleLeftover: true,
            demo: false,
          },
        })}
        initialAvailability={mockAvailability}
      />,
    );
    expect(screen.getByRole("region", { name: "Sahne görüşü" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "PlanSeat-A1-4" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    expect(screen.getByText("Masa A1 · Sahne görüşü")).toBeTruthy();
    expect(screen.queryByRole("group", { name: /Sandalye/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Devam et" })).toBeNull();
  });

  it("satış kapalıyken masa listeden de seçilebilir (klavye erişimi)", () => {
    render(
      <EventSales
        event={makeEvent({
          sale: {
            state: "not_started",
            mode: "seat",
            opensAt: null,
            closesAt: null,
            holdMinutes: 10,
            maxSeatsPerOrder: 12,
            blockSingleLeftover: true,
            demo: false,
          },
        })}
        initialAvailability={mockAvailability}
      />,
    );
    fireEvent.change(screen.getByLabelText("Masa veya loca"), { target: { value: "a1" } });
    expect(screen.getByText("Masa A1 · Sahne görüşü")).toBeTruthy();
  });

  it("kişi sayısı sorulurken salon planı ve sahne görüşü yine gösterilir", () => {
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} />);
    expect(screen.getByLabelText("Kaç kişisiniz?")).toBeTruthy();
    expect(screen.getByTestId("mock-plan-viewer")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Sahne görüşü" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "PlanSeat-A1-4" })).toBeNull();
  });

  it("iki masadan seçilen sandalyeler tek tutma çağrısında numaralarıyla gider", async () => {
    holdActionMock.mockResolvedValueOnce({ ok: true, data: { orderToken: "tok" } });
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={4} />);

    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    fireEvent.click(screen.getByRole("button", { name: "Sandalye 4, boş" }));
    fireEvent.click(screen.getByRole("button", { name: "Sandalye 7, boş" }));

    fireEvent.click(screen.getByRole("button", { name: "Plan-A2" }));
    fireEvent.click(screen.getByRole("button", { name: "Sandalye 1, boş" }));
    fireEvent.click(screen.getByRole("button", { name: "Sandalye 2, boş" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Devam et" }));
    });

    expect(holdActionMock).toHaveBeenCalledWith({
      eventId: "evt-1",
      clientKey: expect.any(String),
      items: [
        { tableId: "a1", quantity: 2, seatNos: [4, 7] },
        { tableId: "a2", quantity: 2, seatNos: [1, 2] },
      ],
    });
    expect(pushMock).toHaveBeenCalledWith("/odeme/tok");
  });

  it("masa bazlı kipte masa bütün gider ve seatNos taşımaz", async () => {
    holdActionMock.mockResolvedValueOnce({ ok: true, data: { orderToken: "tok-table" } });
    const base = makeEvent();
    const tableEvent = makeEvent({
      sale: { ...base.sale, mode: "table" },
      plan: {
        ...base.plan,
        tables: base.plan.tables.map((t) => ({ ...t, wholeOnly: true })),
      },
    });
    render(<EventSales event={tableEvent} initialAvailability={mockAvailability} initialPartySize={2} />);

    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Devam et" }));
    });

    expect(holdActionMock).toHaveBeenCalledWith({
      eventId: "evt-1",
      clientKey: expect.any(String),
      items: [{ tableId: "a1", quantity: 8 }],
    });
  });

  it("yoklama seçili sandalyeyi dolu getirirse seçimden düşer ve uyarı duyurulur", () => {
    const { rerender } = render(
      <EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    fireEvent.click(screen.getByRole("button", { name: "Sandalye 4, boş" }));
    fireEvent.click(screen.getByRole("button", { name: "Sandalye 7, boş" }));

    mockAvailability = {
      at: "2026-12-01T10:00:10Z",
      tables: [
        { id: "a1", free: 7, freeSeats: [1, 2, 3, 5, 6, 7, 8] },
        { id: "a2", free: 8, freeSeats: seq(8) },
      ],
    };
    rerender(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);

    expect(screen.getByText(seatTakenNotice("Masa A1", [4]))).toBeTruthy();
    expect(screen.getByText(/1\/2 kişi seçildi/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Devam et" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("tutma sürerken gelen yoklama seçimi düşürmez", async () => {
    let resolveHold!: (v: unknown) => void;
    holdActionMock.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveHold = res;
        }),
    );

    const { rerender } = render(
      <EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    fireEvent.click(screen.getByRole("button", { name: "Sandalye 4, boş" }));
    fireEvent.click(screen.getByRole("button", { name: "Sandalye 7, boş" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Devam et" }));
    });

    mockAvailability = {
      at: "2026-12-01T10:00:10Z",
      tables: [
        { id: "a1", free: 6, freeSeats: [1, 2, 3, 5, 6, 8] },
        { id: "a2", free: 8, freeSeats: seq(8) },
      ],
    };
    rerender(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);

    expect(screen.queryByText(seatTakenNotice("Masa A1", [4, 7]))).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("2/2 kişi seçildi");

    await act(async () => {
      resolveHold({ ok: true, data: { orderToken: "tok-pending" } });
    });
    expect(pushMock).toHaveBeenCalledWith("/odeme/tok-pending");
  });

  it("seats_unavailable: sandalye mesajı gösterilir, doluluk yenilenir, yerel yama uygulanır", async () => {
    holdActionMock.mockResolvedValueOnce({
      ok: false,
      code: "seats_unavailable",
      message: "Seçilen masada yeterli boş sandalye yok",
      details: { tableId: "a1", free: 6 },
    });
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);

    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    fireEvent.click(screen.getByRole("button", { name: "Sandalye 4, boş" }));
    fireEvent.click(screen.getByRole("button", { name: "Sandalye 7, boş" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Devam et" }));
    });

    expect(screen.getByRole("alert").textContent).toBe(SEAT_TAKEN_MESSAGE);
    expect(refreshAvailMock).toHaveBeenCalledTimes(1);
    expect(patchAvailMock).toHaveBeenCalledWith("a1", 6);
  });

  it("aynı seçimle yeniden denemede clientKey aynıdır; seçim değişince yenilenir", async () => {
    holdActionMock.mockResolvedValue({ ok: false, code: "invalid", message: "Hata" });
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);

    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    fireEvent.click(screen.getByRole("button", { name: "Sandalye 4, boş" }));
    fireEvent.click(screen.getByRole("button", { name: "Sandalye 7, boş" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Devam et" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Devam et" }));
    });

    const key1 = holdActionMock.mock.calls[0]![0].clientKey;
    const key2 = holdActionMock.mock.calls[1]![0].clientKey;
    expect(key1).toBe(key2);

    fireEvent.click(screen.getByRole("button", { name: "Sandalye 7, seçili" }));
    fireEvent.click(screen.getByRole("button", { name: "Sandalye 8, boş" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Devam et" }));
    });
    const key3 = holdActionMock.mock.calls[2]![0].clientKey;
    expect(key3).not.toBe(key1);
  });

  it("sahne görüşü etkin masayı izler ve 3B yokken düğme sunmaz", () => {
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    expect(screen.getByText("Bu masa için sahne görüşü fotoğrafı yok.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "3B'de masadan bak" })).toBeNull();
  });
});
