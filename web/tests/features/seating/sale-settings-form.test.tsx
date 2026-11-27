// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaleSettingsForm } from "@/features/seating/components/sale-settings-form";
import type { SaleSettings } from "@/features/seating/settings-service";

const saveMock = vi.fn();

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("@/features/seating/actions", () => ({
  saveSaleSettingsAction: (...args: unknown[]) => saveMock(...args),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

afterEach(cleanup);

beforeEach(() => {
  saveMock.mockReset();
  saveMock.mockResolvedValue({ ok: true, data: {} });
});

const eventId = "00000000-0000-4000-8000-000000000001";

function makeSettings(overrides: Partial<SaleSettings> = {}): SaleSettings {
  return {
    eventId,
    saleMode: "seat",
    sharedTables: true,
    blockSingleLeftover: true,
    locaOnline: false,
    holdMinutes: 15,
    maxSeatsPerOrder: 12,
    saleStartsAt: null,
    saleEndsAt: null,
    currency: "TRY",
    ...overrides,
  };
}

describe("SaleSettingsForm", () => {
  it("Paylaşımlı masa anahtarı yoktur; Satış şekli vardır", () => {
    render(
      <SaleSettingsForm eventId={eventId} settings={makeSettings()} canEdit saleModeLocked={false} onSaved={() => {}} />,
    );
    expect(screen.queryByLabelText("Paylaşımlı masa")).toBeNull();
    expect(screen.getByRole("group", { name: "Satış şekli" })).toBeTruthy();
  });

  it("kayıt gövdesi saleMode taşır, sharedTables taşımaz", async () => {
    render(
      <SaleSettingsForm
        eventId={eventId}
        settings={makeSettings({ saleMode: "seat" })}
        canEdit
        saleModeLocked={false}
        onSaved={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Masa bazlı/ }));
    fireEvent.click(screen.getByRole("button", { name: "Kuralları kaydet" }));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ eventId, saleMode: "table" }));
    expect(saveMock.mock.calls[0]![0]).not.toHaveProperty("sharedTables");
  });

  it("saleModeLocked iken seçenek kapalıdır ama diğer kurallar kaydedilir", async () => {
    render(
      <SaleSettingsForm
        eventId={eventId}
        settings={makeSettings({ saleMode: "seat" })}
        canEdit
        saleModeLocked
        onSaved={() => {}}
      />,
    );
    expect((screen.getByRole("radio", { name: /Masa bazlı/ }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Kuralları kaydet" }));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ eventId, saleMode: "seat" }));
  });

  it("canEdit yokken satış şekli de kapalıdır", () => {
    render(
      <SaleSettingsForm
        eventId={eventId}
        settings={makeSettings()}
        canEdit={false}
        saleModeLocked={false}
        onSaved={() => {}}
      />,
    );
    expect((screen.getByRole("radio", { name: /Masa bazlı/ }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("radio", { name: /Sandalye bazlı/ }) as HTMLInputElement).disabled).toBe(true);
  });
});
