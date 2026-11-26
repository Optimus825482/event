import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(import.meta.dirname, "../../src");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

const files = tsxFiles(SRC).map((file) => ({ file, text: readFileSync(file, "utf8") }));

describe("renk kuralları", () => {
  it("bileşenlerde ham hex renk yoktur", () => {
    const hits = files.filter(({ text }) => /#[0-9a-fA-F]{3,8}\b/.test(text)).map(({ file }) => file);
    expect(hits).toEqual([]);
  });
  it("Tailwind'in varsayılan palet sınıfları kullanılmaz", () => {
    const pattern =
      /\b(text|bg|border|ring|fill|stroke|from|to|via|outline|decoration|placeholder)-(white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/;
    const hits = files.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
    expect(hits).toEqual([]);
  });
});
