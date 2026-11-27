// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventFacts } from "@/components/event/event-facts";
import { eventVenue, VenueMap, venueLinks } from "@/components/event/venue-map";
import { CONTACT } from "@/content/site";

afterEach(cleanup);

describe("VenueMap", () => {
  it("mekân sitenin iletişim bilgisindeki salondur (adres uydurulmaz)", () => {
    expect(eventVenue()).toEqual({ name: CONTACT.venue, address: CONTACT.address });
  });

  it("bağlantılar mekân adı + adresi kodlanmış sorguyla kurar", () => {
    const q = encodeURIComponent("Merit Royal Diamond Hotel & Spa, Alsancak, Girne / KKTC");
    expect(venueLinks({ name: "Merit Royal Diamond Hotel & Spa", address: "Alsancak, Girne / KKTC" })).toEqual({
      embed: `https://www.google.com/maps?q=${q}&output=embed`,
      search: `https://www.google.com/maps/search/?api=1&query=${q}`,
      directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    });
  });

  it("Konum başlığı, tembel yüklenen harita, adres; yol tarifi ve haritada aç yeni sekmede", () => {
    const venue = eventVenue();
    const links = venueLinks(venue);
    render(<VenueMap venue={venue} />);
    expect(screen.getByRole("heading", { level: 2, name: "Konum" })).toBeInTheDocument();
    const frame = screen.getByTitle(`${venue.name} haritası`);
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute("src", links.embed);
    expect(frame).toHaveAttribute("loading", "lazy");
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer-when-downgrade");
    expect(screen.getByText(venue.name)).toBeInTheDocument();
    expect(screen.getByText(venue.address)).toBeInTheDocument();
    const directions = screen.getByRole("link", { name: "Yol tarifi al" });
    const open = screen.getByRole("link", { name: "Google Haritalar'da aç" });
    expect(directions).toHaveAttribute("href", links.directions);
    expect(open).toHaveAttribute("href", links.search);
    for (const link of [directions, open]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});

describe("EventFacts", () => {
  it("action ızgaranın son hücresidir", () => {
    render(<EventFacts facts={[{ label: "Tarih", value: "12 Aralık 2026" }]} action={<button type="button">Bilet Al</button>} />);
    const grid = screen.getByText("Tarih").closest("dl")!;
    expect(grid.lastElementChild).toContainElement(screen.getByRole("button", { name: "Bilet Al" }));
  });
});
