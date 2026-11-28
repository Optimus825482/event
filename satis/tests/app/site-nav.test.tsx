// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let path = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

import { TicketDialog } from "@/components/event/ticket-dialog";
import { SiteNav } from "@/components/site-nav";
import { isCurrentPath } from "@/content/site";

afterEach(cleanup);

describe("SiteNav", () => {
  it("menü öğeleri sabit sırada ve sonda Bilet Al", () => {
    path = "/";
    render(<SiteNav />);
    const links = within(document.querySelector('[data-nav="desktop"]') as HTMLElement).getAllByRole("link");
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Ana Sayfa", "/"],
      ["Yaklaşan Etkinlikler", "/etkinlikler"],
      ["Etkinlik Takvimi", "/takvim"],
      ["Biletim (PNR)", "/biletimi-bul"],
      ["Hakkımızda", "/hakkimizda"],
      ["Bilet Al", "/etkinlikler"],
    ]);
  });

  it("yalnızca bulunulan sayfa aria-current taşır", () => {
    path = "/takvim";
    render(<SiteNav />);
    const desktop = within(document.querySelector('[data-nav="desktop"]') as HTMLElement);
    expect(desktop.getByRole("link", { name: "Etkinlik Takvimi" })).toHaveAttribute("aria-current", "page");
    expect(desktop.getByRole("link", { name: "Ana Sayfa" })).not.toHaveAttribute("aria-current");
  });

  it("mobil menü yol değişince kapanır", () => {
    path = "/";
    const { rerender } = render(<SiteNav />);
    const details = document.querySelector('details[data-nav="mobile"]') as HTMLDetailsElement;
    details.open = true;
    path = "/sss";
    rerender(<SiteNav />);
    expect(details.open).toBe(false);
  });

  it("mobil menü Escape ile kapanır", () => {
    path = "/";
    render(<SiteNav />);
    const details = document.querySelector('details[data-nav="mobile"]') as HTMLDetailsElement;
    details.open = true;
    fireEvent.keyDown(details, { key: "Escape" });
    expect(details.open).toBe(false);
  });

  it.each([
    ["/", "/", true],
    ["/takvim", "/", false],
    ["/takvim", "/takvim", true],
    ["/etkinlikler/x", "/etkinlikler", true],
    ["/etkinlik/x", "/etkinlikler", false],
  ])("isCurrentPath(%s, %s) = %s", (p, h, out) => {
    expect(isCurrentPath(p, h)).toBe(out);
  });

  it("Bilet Al: etkinlik sayfasında kişi sayısı penceresini açar, pencere yoksa etkinliklere gider", () => {
    path = "/etkinlik/e1";
    render(
      <>
        <SiteNav />
        <TicketDialog eventId="e1" eyebrow="SANATÇI · 12 ARALIK 2026" maxSeatsPerOrder={8} />
      </>,
    );
    const cta = within(document.querySelector('[data-nav="desktop"]') as HTMLElement).getByRole("link", { name: "Bilet Al" });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    fireEvent(cta, click);
    expect(click.defaultPrevented).toBe(true);
    expect(document.getElementById("bilet-al")).toHaveAttribute("open");
  });

  it("Bilet Al: pencere olmayan sayfada bağlantı olağan davranır", () => {
    path = "/";
    render(<SiteNav />);
    const cta = within(document.querySelector('[data-nav="desktop"]') as HTMLElement).getByRole("link", { name: "Bilet Al" });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    fireEvent(cta, click);
    expect(cta).toHaveAttribute("href", "/etkinlikler");
    expect(document.getElementById("bilet-al")).toBeNull();
  });
});
