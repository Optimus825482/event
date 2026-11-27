// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { saveSiteContentAction } = vi.hoisted(() => ({
  saveSiteContentAction: vi.fn(),
}));

vi.mock("@/features/sales-site/actions", () => ({
  saveSiteContentAction,
  uploadSiteImageAction: vi.fn(),
  removeSiteImageAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

import { SiteContentForm } from "@/features/sales-site/components/site-content-form";
import type { SiteContentView } from "@/features/sales-site/content-service";

const baseView: SiteContentView = {
  eventId: "11111111-1111-4111-8111-111111111111",
  eventName: "Gala",
  startsAt: "2026-12-31T20:00:00.000Z",
  isDemo: false,
  siteState: "open",
  saleMode: "seat",
  coverImage: null,
  heroImage: null,
  artist: null,
  summary: "Eski metin",
  doorsOpenAt: "2026-12-31T17:30:00.000Z",
  ageLimit: "18+",
  dressCode: "Şık",
  sightlineSet: "diamond",
  images: { status: "missing", missing: ["cover", "hero"] },
};

describe("SiteContentForm", () => {
  beforeEach(() => {
    saveSiteContentAction.mockResolvedValue({ ok: true, data: { eventId: baseView.eventId } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("alanlar görünümden dolar; kapı saati Kıbrıs duvar saatidir", () => {
    render(<SiteContentForm view={baseView} canEdit={true} />);
    expect((screen.getByLabelText("Tanıtım metni") as HTMLTextAreaElement).value).toBe("Eski metin");
    expect((screen.getByLabelText("Kapı saati") as HTMLInputElement).value).toBe("2026-12-31T19:30");
    expect((screen.getByLabelText("Yaş sınırı") as HTMLInputElement).value).toBe("18+");
    expect((screen.getByLabelText("Kıyafet") as HTMLInputElement).value).toBe("Şık");
    expect((screen.getByLabelText("Sahne görüşü") as HTMLSelectElement).value).toBe("diamond");
  });

  it("Kaydet eylemi form değerleriyle çağırır", async () => {
    render(<SiteContentForm view={baseView} canEdit={true} />);
    fireEvent.change(screen.getByLabelText("Tanıtım metni"), { target: { value: "Yeni metin" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(saveSiteContentAction).toHaveBeenCalledWith({
        eventId: baseView.eventId,
        summary: "Yeni metin",
        doorsOpenAt: "2026-12-31T19:30",
        ageLimit: "18+",
        dressCode: "Şık",
        sightlineSet: "diamond",
      });
    });
  });

  it("alan hatası ilgili alanın altında görünür", async () => {
    saveSiteContentAction.mockResolvedValue({
      ok: false,
      code: "invalid",
      message: "Girdi geçersiz",
      fieldErrors: { doorsOpenAt: ["Geçersiz tarih"] },
    });
    render(<SiteContentForm view={baseView} canEdit={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(screen.getByText("Geçersiz tarih")).toBeTruthy();
    });
  });

  it("düzenleme yetkisi yokken alanlar kilitli ve Kaydet yok", () => {
    render(<SiteContentForm view={baseView} canEdit={false} />);
    expect((screen.getByLabelText("Tanıtım metni") as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByLabelText("Kapı saati") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Yaş sınırı") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Kıyafet") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Sahne görüşü") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Kaydet" })).toBeNull();
  });
});
