import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const PUBLIC = resolve(ROOT, "public");
const SRC = resolve(ROOT, "src");

const FONTS = [
  "cormorant-garamond-latin-500-normal",
  "cormorant-garamond-latin-ext-500-normal",
  "cormorant-garamond-latin-500-italic",
  "cormorant-garamond-latin-ext-500-italic",
  "dm-sans-latin-wght-normal",
  "dm-sans-latin-ext-wght-normal",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|css)$/.test(full) ? [full] : [];
  });
}

describe("yerel yazı tipleri", () => {
  const css = readFileSync(resolve(SRC, "app/globals.css"), "utf8");

  it("yazı tipi dosyaları ve lisans metinleri depodadır", () => {
    for (const f of [...FONTS.map((n) => `${n}.woff2`), "cormorant-license.txt", "dm-sans-license.txt"]) {
      expect(existsSync(resolve(PUBLIC, "fonts", f))).toBe(true);
    }
  });

  it("lisans metinleri SIL OFL'dir", () => {
    for (const f of ["cormorant-license.txt", "dm-sans-license.txt"]) {
      expect(readFileSync(resolve(PUBLIC, "fonts", f), "utf8")).toContain("SIL OPEN FONT LICENSE");
    }
  });

  it("globals.css yalnızca depodaki yerel yazı tiplerini yükler", () => {
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]!.replace(/["']/g, ""));
    expect(urls.sort()).toEqual(FONTS.map((n) => `/fonts/${n}.woff2`).sort());
  });

  it("kaynakta dış yazı tipi kökeni geçmez", () => {
    const hits = sourceFiles(SRC)
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return text.includes("fonts.googleapis.com") || text.includes("fonts.gstatic.com");
      });
    expect(hits).toEqual([]);
  });

  it("gövde ve başlık yığınları yerel aileyle başlar", () => {
    expect(css).toMatch(/--font-sans:\s*"DM Sans"/);
    expect(css).toMatch(/--font-serif:\s*"Cormorant Garamond"/);
  });

  it("hareket azaltma ve yazdırma kuralları vardır", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("@media print");
  });
});
