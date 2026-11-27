// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import AboutPage from "@/app/hakkimizda/page";
import { ABOUT } from "@/content/about";

afterEach(cleanup);

const PUBLIC_DIR = resolve(import.meta.dirname, "../../public");

describe("Hakkımızda sayfası", () => {
  it("bölümler sırayla: hikâye, kısa bilgiler, organizasyonun kurgusu, ayrıcalıklar, sahneler", () => {
    render(<AboutPage />);
    const headings = screen.getAllByRole("heading").map((h) => [h.tagName, h.textContent]);
    expect(headings).toEqual([
      ["H1", "Merit Entertainment"],
      ["H2", "Organizasyonun kurgusu"],
      ["H2", "Merit ayrıcalığı"],
      ["H3", "Modern Organizasyon Alanları"],
      ["H3", "Ses, Işık & Sahne Teknolojisi"],
      ["H3", "Seçkin Misafir Deneyimi"],
      ["H2", "Sahnelerimiz"],
      ...ABOUT.venues.map((v) => ["H3", v.name]),
    ]);
  });

  it("kısa bilgiler beş satırdır ve kuruluş yılını gösterir", () => {
    render(<AboutPage />);
    const facts = within(screen.getByRole("region", { name: "Merit International" }));
    expect(facts.getAllByRole("term").map((t) => t.textContent)).toEqual([
      "Kuruluş",
      "Otel",
      "Ülke",
      "Sahne programı",
      "Merkez",
    ]);
    expect(facts.getByText("1988")).toBeInTheDocument();
  });

  it("program ve takvim bağlantıları site içine gider", () => {
    render(<AboutPage />);
    expect(screen.getByRole("link", { name: /Konser programını inceleyin/ })).toHaveAttribute("href", "/etkinlikler");
    expect(screen.getByRole("link", { name: /Etkinlik takvimini inceleyin/ })).toHaveAttribute("href", "/takvim");
  });

  it("görseller kendi kökenimizden, alt metinli ve diskte mevcuttur", () => {
    render(<AboutPage />);
    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBe(1 + ABOUT.venues.length);
    for (const img of imgs) {
      const src = img.getAttribute("src")!;
      expect(src).toMatch(/^\/hakkimizda\/[a-z-]+\.webp$/);
      expect(img.getAttribute("alt")).not.toBe("");
      expect(existsSync(resolve(PUBLIC_DIR, `.${src}`))).toBe(true);
    }
  });
});
