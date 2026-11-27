// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SalesSiteList } from "@/features/sales-site/components/sales-site-list";
import type { SalesSiteOverview } from "@/features/sales-site/overview";
import { formatMoney } from "@/features/ticketing/view-model";

afterEach(cleanup);

const baseOverview: SalesSiteOverview = {
  demoEnabled: false,
  canSeeSales: true,
  summary: [],
  rows: [],
};

describe("SalesSiteList", () => {
  it("demo anahtarı açıkken DEMO AKTİF bandı görünür, kapalıyken görünmez", () => {
    const { rerender } = render(<SalesSiteList overview={{ ...baseOverview, demoEnabled: true }} />);
    expect(screen.getByRole("status").textContent).toContain("DEMO AKTİF");

    rerender(<SalesSiteList overview={{ ...baseOverview, demoEnabled: false }} />);
    expect(screen.queryByText("DEMO AKTİF")).toBeNull();
  });

  it("özet gerçek ve demo satışı ayrı başlık altında, para birimiyle gösterir", () => {
    render(
      <SalesSiteList
        overview={{
          ...baseOverview,
          summary: [
            {
              isDemo: false,
              currency: "TRY",
              todayTickets: 1,
              todayRevenue: "1500.00",
              totalTickets: 2,
              totalRevenue: "3000.00",
            },
            {
              isDemo: true,
              currency: "TRY",
              todayTickets: 3,
              todayRevenue: "4500.00",
              totalTickets: 3,
              totalRevenue: "4500.00",
            },
          ],
        }}
      />,
    );

    const realSection = screen.getByText("Gerçek satış").closest("section");
    expect(realSection?.textContent).toContain(formatMoney("3000.00", "TRY"));
    expect(realSection?.textContent).toContain("2");

    const demoSection = screen.getByText("Demo satış").closest("section");
    expect(demoSection?.textContent).toContain(formatMoney("4500.00", "TRY"));
  });

  it("rakam yetkisi yokken özet çizilmez, satılan ve doluluk '—' olur", () => {
    render(
      <SalesSiteList
        overview={{
          demoEnabled: false,
          canSeeSales: false,
          summary: null,
          rows: [
            {
              eventId: "e1",
              name: "Gala",
              startsAt: "2026-12-31T18:00:00.000Z",
              isDemo: false,
              siteState: "open",
              saleMode: "seat",
              sold: null,
              occupancyPercent: null,
              images: { status: "complete", missing: [] },
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText("Gerçek satış")).toBeNull();
    expect(screen.queryByText("Henüz satış yok")).toBeNull();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("satır: durum etiketi, yüzde, satış şekli ve eksik görseller", () => {
    render(
      <SalesSiteList
        overview={{
          ...baseOverview,
          rows: [
            {
              eventId: "ev-1",
              name: "Yılbaşı Galası",
              startsAt: "2026-12-31T18:00:00.000Z",
              isDemo: true,
              siteState: "open",
              saleMode: "seat",
              sold: 5,
              occupancyPercent: 63,
              images: { status: "missing", missing: ["cover", "hero"] },
            },
            {
              eventId: "ev-2",
              name: "Taslak Gece",
              startsAt: "2026-12-20T18:00:00.000Z",
              isDemo: false,
              siteState: null,
              saleMode: "table",
              sold: 0,
              occupancyPercent: null,
              images: { status: "complete", missing: [] },
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "Yılbaşı Galası" }).getAttribute("href")).toBe("/sales-site/ev-1");
    expect(screen.getByText("DEMO")).toBeTruthy();
    expect(screen.getByText("Satışta")).toBeTruthy();
    expect(screen.getByText("%63")).toBeTruthy();
    expect(screen.getByText("Sandalye bazlı")).toBeTruthy();
    expect(screen.getByText("Eksik: Kapak, Hero")).toBeTruthy();

    expect(screen.getByText("Sitede değil")).toBeTruthy();
    expect(screen.getByText("Tam")).toBeTruthy();
    expect(screen.getByText("Masa bazlı")).toBeTruthy();
  });
});
