// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let path = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

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
      ["Takvim", "/takvim"],
      ["Biletim (PNR)", "/biletimi-bul"],
      ["Hakkımızda", "/hakkimizda"],
      ["Bilet Al", "/etkinlikler"],
    ]);
  });

  it("yalnızca bulunulan sayfa aria-current taşır", () => {
    path = "/takvim";
    render(<SiteNav />);
    const desktop = within(document.querySelector('[data-nav="desktop"]') as HTMLElement);
    expect(desktop.getByRole("link", { name: "Takvim" })).toHaveAttribute("aria-current", "page");
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
});
