// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { SiteHeader } from "@/components/site-header";
import { BRAND_LOGO } from "@/content/site";

afterEach(cleanup);

const PUBLIC_DIR = resolve(import.meta.dirname, "../../public");

describe("SiteHeader", () => {
  it("logo ana sayfaya bağlanır ve erişilebilir adı taşır", () => {
    render(<SiteHeader />);
    const home = screen.getByRole("link", { name: "Merit Entertainment — Ana sayfa" });
    expect(home).toHaveAttribute("href", "/");
    const img = home.querySelector("img") as HTMLImageElement;
    expect(img).toHaveAttribute("src", BRAND_LOGO.src);
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("width");
    expect(img).toHaveAttribute("height");
  });

  it("logo dosyası kendi kökenimizden sunulur", () => {
    expect(BRAND_LOGO.src.startsWith("/")).toBe(true);
    expect(existsSync(resolve(PUBLIC_DIR, `.${BRAND_LOGO.src}`))).toBe(true);
  });

  it("sekme ve dokunmatik simgeleri uygulama kuralıyla tanımlıdır", () => {
    const appDir = resolve(import.meta.dirname, "../../src/app");
    expect(existsSync(resolve(appDir, "icon.png"))).toBe(true);
    expect(existsSync(resolve(appDir, "apple-icon.png"))).toBe(true);
  });
});
