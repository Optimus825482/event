// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventSales, SEAT_TAKEN_MESSAGE } from "@/features/plan/event-sales";
import { PARTY_FULL_NOTICE, PROCEED_LABEL, seatTakenNotice } from "@/features/plan/picks";
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

const closedSale: EventDetail["sale"] = {
  state: "closed",
  mode: "seat",
  opensAt: null,
  closesAt: null,
  holdMinutes: 10,
  maxSeatsPerOrder: 12,
  blockSingleLeftover: true,
  demo: false,
};

const dialog = () => screen.getByRole("dialog");
const inDialog = () => within(dialog());
const proceedButton = () => inDialog().getByRole("button", { name: PROCEED_LABEL }) as HTMLButtonElement;

describe("EventSales", () => {
  it("kişi sayısı verilmemişse 2 kişiyle tam genişlikte salon arenası açılır", () => {
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} />);
    expect(screen.queryByText("Kaç kişisiniz?")).toBeNull();
    expect(screen.queryByRole("button", { name: "Masaları göster" })).toBeNull();
    expect(screen.getByTestId("mock-plan-viewer")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("0/2 kişi seçildi");
    expect(screen.getByRole("status").textContent).toContain("2 Kişi");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("kişi sayısı verilmişse sayaç o sayıyla başlar", () => {
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={4} />);
    expect(screen.getByRole("status").textContent).toContain("0/4 kişi seçildi");
  });

  it("satış kapalıyken plan salt okunurdur: kişi sayısı ve Devam et yoktur", () => {
    render(<EventSales event={makeEvent({ sale: closedSale })} initialAvailability={mockAvailability} />);
    expect(screen.getByTestId("mock-plan-viewer")).toBeTruthy();
    expect(screen.queryByLabelText("Kişi sayısı")).toBeNull();
    expect(screen.queryByRole("button", { name: "Devam et" })).toBeNull();
  });

  it("satış kapalıyken masaya dokununca masa penceresi açılır: bilgi ve satış durumu, sandalye seçimi ve ödeme yok", () => {
    render(<EventSales event={makeEvent({ sale: closedSale })} initialAvailability={mockAvailability} />);
    expect(screen.queryByRole("button", { name: "PlanSeat-A1-4" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    expect(inDialog().getByRole("heading", { level: 2, name: "Masa A1" })).toBeTruthy();
    expect(inDialog().getByText("Satış kapalı")).toBeTruthy();
    expect(inDialog().getByText("Masa A1 — Sahne Görünümü")).toBeTruthy();
    expect(inDialog().queryByRole("group", { name: /sandalyeleri/ })).toBeNull();
    expect(inDialog().getByRole("button", { name: PROCEED_LABEL })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: "Devam et" })).toBeNull();
    fireEvent.click(inDialog().getByRole("button", { name: "Kapat" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("satış kapalıyken masa listeden de seçilebilir (klavye erişimi) ve pencere açılır", () => {
    render(
      <EventSales
        event={makeEvent({ sale: { ...closedSale, state: "not_started" } })}
        initialAvailability={mockAvailability}
      />,
    );
    fireEvent.change(screen.getByLabelText("Masa veya loca"), { target: { value: "a1" } });
    expect(inDialog().getByRole("heading", { level: 2, name: "Masa A1" })).toBeTruthy();
    expect(inDialog().getByText("Satış yakında")).toBeTruthy();
  });

  it("masa penceresi: başlık, müsait yer, tür rozeti, etkinlik, seçim, kişi başı ve toplam; KDV satırı yok", () => {
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    const d = inDialog();
    expect(dialog().getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("dialog", { name: "Masa A1" })).toBeTruthy();
    expect(d.getByText("8 kişilik yer müsait")).toBeTruthy();
    expect(d.getByRole("heading", { name: "Masa A1" })).toBeTruthy();
    expect(d.getByText("Yılbaşı Galası · 22:00")).toBeTruthy();
    expect(d.getByText("Masa A1 · 2 Kişi · Sandalye 1, 2")).toBeTruthy();
    expect(d.getByText("Kişi Başı Fiyat").nextElementSibling?.textContent).toBe("1.500,00 ₺");
    expect(d.getByText("Toplam Tutar").nextElementSibling?.textContent).toBe("3.000,00 ₺");
    expect(d.queryByText(/KDV/)).toBeNull();
    expect(d.getByRole("button", { name: "Kapat" })).toBeTruthy();
  });

  it("numaralı masada kişi sayısı kadar boş sandalye önseçilir ve hemen ödemeye geçilebilir", async () => {
    holdActionMock.mockResolvedValueOnce({ ok: true, data: { orderToken: "tok-auto" } });
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    expect(inDialog().getByRole("button", { name: "Sandalye 1, seçili" }).getAttribute("aria-pressed")).toBe("true");
    expect(inDialog().getByRole("button", { name: "Sandalye 2, seçili" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("2/2 kişi seçildi");
    await act(async () => {
      fireEvent.click(proceedButton());
    });
    expect(holdActionMock).toHaveBeenCalledWith({
      eventId: "evt-1",
      clientKey: expect.any(String),
      items: [{ tableId: "a1", quantity: 2, seatNos: [1, 2] }],
    });
    expect(pushMock).toHaveBeenCalledWith("/odeme/tok-auto");
  });

  it("pencere dokunulmadan kapatılırsa (Kapat, ×, Esc) önseçim geri alınır; değiştirilen seçim korunur", () => {
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    fireEvent.click(inDialog().getByRole("button", { name: "Kapat" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("0/2 kişi seçildi");

    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    fireEvent.click(inDialog().getByRole("button", { name: "Kapat" }));
    expect(screen.getByRole("status").textContent).toContain("0/2 kişi seçildi");

    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    fireEvent(dialog(), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("0/2 kişi seçildi");

    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    fireEvent.click(inDialog().getByRole("button", { name: "Sandalye 2, seçili" }));
    fireEvent.click(inDialog().getByRole("button", { name: "Sandalye 5, boş" }));
    fireEvent.click(inDialog().getByRole("button", { name: "Kapat" }));
    expect(screen.getByRole("status").textContent).toContain("2/2 kişi seçildi");
    expect(screen.getByRole("button", { name: "Seçili: Masa A1" })).toBeTruthy();
  });

  it("masa arama kutusundan seçilen masa pencerede açılır", () => {
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);
    fireEvent.change(screen.getByLabelText("Masa numarası ara"), { target: { value: "A2" } });
    fireEvent.click(screen.getByRole("button", { name: /^Masa A2/ }));
    expect(screen.getByRole("dialog", { name: "Masa A2" })).toBeTruthy();
  });

  it("kişi sayısı dolunca pencerede yeni sandalye seçilmez ve uyarı pencerede çıkar", () => {
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    fireEvent.click(inDialog().getByRole("button", { name: "Sandalye 3, boş" }));
    expect(inDialog().getByText(PARTY_FULL_NOTICE)).toBeTruthy();
    expect(inDialog().getByRole("button", { name: "Sandalye 3, boş" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("iki masadan seçilen sandalyeler tek tutma çağrısında numaralarıyla gider", async () => {
    holdActionMock.mockResolvedValueOnce({ ok: true, data: { orderToken: "tok" } });
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={4} />);

    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    for (const no of [1, 2, 3]) {
      fireEvent.click(inDialog().getByRole("button", { name: `Sandalye ${no}, seçili` }));
    }
    fireEvent.click(inDialog().getByRole("button", { name: "Sandalye 7, boş" }));
    fireEvent.click(inDialog().getByRole("button", { name: "Kapat" }));

    fireEvent.click(screen.getByRole("button", { name: "Plan-A2" }));
    expect(inDialog().getByText("Masa A2 · 2 Kişi · Sandalye 1, 2")).toBeTruthy();
    expect(inDialog().getByText("Masa A1 · sandalye 4, 7")).toBeTruthy();
    expect(inDialog().getByText("Toplam Tutar").nextElementSibling?.textContent).toBe("6.000,00 ₺");

    await act(async () => {
      fireEvent.click(proceedButton());
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

  it("masa bazlı kipte masa bütün önseçilir, sandalye düğmesi yoktur ve seatNos taşımaz", async () => {
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
    expect(inDialog().queryByRole("button", { name: /Sandalye/ })).toBeNull();
    expect(inDialog().getByText("8 kişilik masa · 8 bilet")).toBeTruthy();
    expect(inDialog().getByText("Masa A1 · 8 Kişi (bütün masa)")).toBeTruthy();
    await act(async () => {
      fireEvent.click(proceedButton());
    });

    expect(holdActionMock).toHaveBeenCalledWith({
      eventId: "evt-1",
      clientKey: expect.any(String),
      items: [{ tableId: "a1", quantity: 8 }],
    });
  });

  it("yoklama seçili sandalyeyi dolu getirirse seçimden düşer ve uyarı pencerede duyurulur", () => {
    const { rerender } = render(
      <EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));

    mockAvailability = {
      at: "2026-12-01T10:00:10Z",
      tables: [
        { id: "a1", free: 7, freeSeats: [2, 3, 4, 5, 6, 7, 8] },
        { id: "a2", free: 8, freeSeats: seq(8) },
      ],
    };
    rerender(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);

    expect(inDialog().getByText(seatTakenNotice("Masa A1", [1]))).toBeTruthy();
    expect(screen.getByText(/1\/2 kişi seçildi/)).toBeTruthy();
    expect(proceedButton().disabled).toBe(true);
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

    await act(async () => {
      fireEvent.click(proceedButton());
    });

    mockAvailability = {
      at: "2026-12-01T10:00:10Z",
      tables: [
        { id: "a1", free: 6, freeSeats: [3, 4, 5, 6, 7, 8] },
        { id: "a2", free: 8, freeSeats: seq(8) },
      ],
    };
    rerender(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);

    expect(screen.queryByText(seatTakenNotice("Masa A1", [1, 2]))).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("2/2 kişi seçildi");

    await act(async () => {
      resolveHold({ ok: true, data: { orderToken: "tok-pending" } });
    });
    expect(pushMock).toHaveBeenCalledWith("/odeme/tok-pending");
  });

  it("seats_unavailable: sandalye mesajı pencerede gösterilir, doluluk yenilenir, yerel yama uygulanır", async () => {
    holdActionMock.mockResolvedValueOnce({
      ok: false,
      code: "seats_unavailable",
      message: "Seçilen masada yeterli boş sandalye yok",
      details: { tableId: "a1", free: 6 },
    });
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);

    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    await act(async () => {
      fireEvent.click(proceedButton());
    });

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(inDialog().getByRole("alert").textContent).toBe(SEAT_TAKEN_MESSAGE);
    expect(refreshAvailMock).toHaveBeenCalledTimes(1);
    expect(patchAvailMock).toHaveBeenCalledWith("a1", 6);
  });

  it("aynı seçimle yeniden denemede clientKey aynıdır; seçim değişince yenilenir", async () => {
    holdActionMock.mockResolvedValue({ ok: false, code: "invalid", message: "Hata" });
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);

    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    await act(async () => {
      fireEvent.click(proceedButton());
    });
    await act(async () => {
      fireEvent.click(proceedButton());
    });

    const key1 = holdActionMock.mock.calls[0]![0].clientKey;
    const key2 = holdActionMock.mock.calls[1]![0].clientKey;
    expect(key1).toBe(key2);

    fireEvent.click(inDialog().getByRole("button", { name: "Sandalye 2, seçili" }));
    fireEvent.click(inDialog().getByRole("button", { name: "Sandalye 8, boş" }));
    await act(async () => {
      fireEvent.click(proceedButton());
    });
    const key3 = holdActionMock.mock.calls[2]![0].clientKey;
    expect(key3).not.toBe(key1);
  });

  it("sahne görüşü pencerede gösterilir; 3B yokken masadan bakış düğmesi pasiftir", () => {
    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    expect(inDialog().getByText("Bu konum için kayıtlı sahne görseli yok.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "3B'de masadan bak" })).toBeNull();
    expect(inDialog().getByRole("button", { name: "Masadan Sahneye Bak" })).toHaveProperty("disabled", true);
  });

  it("pencere sahne görüşü fotoğrafını ve plandaki sahneye göre mesafe · açıyı gösterir; sahne yoksa açı yazılmaz", () => {
    const base = makeEvent();
    const withStage = makeEvent({
      site: { ...base.site, sightlineSet: "diamond" },
      plan: {
        ...base.plan,
        tables: base.plan.tables.map((t) => (t.id === "a1" ? { ...t, label: "M-1" } : t)),
        // Sahne ortası (100, 25) px; M-1 (100, 100) tam karşıda 5 m.
        decor: [{ id: "s", kind: "stage", x: 40, y: 10, width: 120, height: 30, rotation: 0, label: "Sahne" }],
      },
    });
    const { unmount } = render(
      <EventSales event={withStage} initialAvailability={mockAvailability} initialPartySize={2} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Plan-M-1" }));
    expect(inDialog().getByRole("img").getAttribute("src")).toBe("/sightline/diamond/M-1.webp");
    expect(inDialog().getByText("Masa M-1 — Sahne Görünümü")).toBeTruthy();
    expect(inDialog().getByText("5m · Orta")).toBeTruthy();
    unmount();

    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    expect(inDialog().queryByText(/\dm · /)).toBeNull();
  });

  it("holdAction sipariş döndürdüğünde sayfa değiştirmeden ödeme penceresini açar", async () => {
    holdActionMock.mockResolvedValueOnce({
      ok: true,
      data: {
        orderToken: "tok-modal",
        serverNow: "2026-12-01T10:00:00Z",
        order: {
          orderId: "ord-1",
          eventId: "evt-1",
          eventName: "Yılbaşı Galası",
          startsAt: "2026-12-31T20:00:00Z",
          status: "pending",
          holdExpiresAt: "2026-12-01T10:10:00Z",
          currency: "TRY",
          total: "3000.00",
          isDemo: false,
          pnr: null,
          items: [{ tableId: "a1", tableLabel: "A1", category: "standard", quantity: 2, unitPrice: "1500.00" }],
          tickets: [],
          orderToken: "tok-modal",
          demoNotice: null,
        },
      },
    });

    render(<EventSales event={makeEvent()} initialAvailability={mockAvailability} initialPartySize={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Plan-A1" }));
    await act(async () => {
      fireEvent.click(proceedButton());
    });

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Ödeme", hidden: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Öde", hidden: true })).toBeTruthy();
  });
});
