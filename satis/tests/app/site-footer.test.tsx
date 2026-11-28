// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SiteFooter } from "@/components/site-footer";
import { activeSocialLinks, SOCIAL_LINKS } from "@/content/social";

afterEach(cleanup);

describe("SiteFooter", () => {
  it("alt bilgide ana sayfaya bağlanan logo vardır", () => {
    render(<SiteFooter />);
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Merit Entertainment — Ana sayfa" })).toHaveAttribute("href", "/");
  });

  it("sosyal medya bağlantıları yeni sekmede, güvenli ve adlandırılmış açılır", () => {
    render(<SiteFooter />);
    const nav = screen.getByRole("navigation", { name: "Sosyal Medya" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(activeSocialLinks().map((s) => s.url));
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
    expect(within(nav).getByRole("link", { name: /Instagram/ })).toHaveAttribute(
      "href",
      "https://www.instagram.com/merit.entertainment/",
    );
    expect(within(nav).getByRole("link", { name: /Facebook/ })).toHaveAttribute(
      "href",
      "https://www.facebook.com/meritentertainment/",
    );
  });

  it("adresi boş sosyal hesaplar çizilmez", () => {
    render(<SiteFooter />);
    const nav = screen.getByRole("navigation", { name: "Sosyal Medya" });
    const empty = SOCIAL_LINKS.filter((s) => s.url === "");
    expect(empty.length).toBeGreaterThan(0);
    for (const item of empty) {
      expect(within(nav).queryByRole("link", { name: new RegExp(item.label) })).toBeNull();
    }
  });

  it("iletişim, keşfet ve hukuki bağlantılar yerindedir", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "+90 392 650 40 00" })).toHaveAttribute("href", "tel:+903926504000");
    expect(screen.getByRole("link", { name: "entertainment@merithotels.com" })).toHaveAttribute(
      "href",
      "mailto:entertainment@merithotels.com",
    );
    const explore = within(screen.getByRole("navigation", { name: "Keşfet" }));
    expect(explore.getByRole("link", { name: "Etkinlik Takvimi" })).toHaveAttribute("href", "/takvim");
    expect(explore.getByRole("link", { name: "İade Koşulları" })).toHaveAttribute("href", "/iade");
    const legal = within(screen.getByRole("navigation", { name: "Hukuki" }));
    expect(legal.getByRole("link", { name: "KVKK" })).toHaveAttribute("href", "/kvkk");
    expect(legal.getByRole("link", { name: "Mesafeli Satış" })).toHaveAttribute("href", "/mesafeli-satis");
  });
});
