// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import AboutPage from "@/app/hakkimizda/page";

afterEach(cleanup);

describe("Hakkımızda sayfası", () => {
  it("başlık ve üç özellik kartı meritevent kurumsal düzenindedir", () => {
    render(<AboutPage />);
    const headings = screen.getAllByRole("heading").map((h) => [h.tagName, h.textContent]);
    expect(headings).toEqual([
      ["H1", "Merit Entertainment"],
      ["H2", "Modern Organizasyon Alanları"],
      ["H2", "Ses, Işık & Sahne Teknolojisi"],
      ["H2", "Seçkin Misafir Deneyimi"],
    ]);
  });
});
