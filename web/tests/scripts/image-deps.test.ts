import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(path.join(WEB, rel), "utf8");

/** Betiğin çıplak (paket) import'ları; `node:` ve göreli yollar hariç. */
function packageImports(source: string): string[] {
  const names = new Set<string>();
  for (const m of source.matchAll(/^\s*import\s[^"']*["']([^"']+)["']/gm)) {
    const spec = m[1] ?? "";
    if (spec.startsWith(".") || spec.startsWith("node:") || builtinModules.includes(spec)) continue;
    const parts = spec.split("/");
    names.add(spec.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? spec));
  }
  return [...names].sort();
}

describe("üretim imajındaki düz Node betikleri", () => {
  const dockerfile = read("Dockerfile");
  const roots = /for\(const n of \[([^\]]+)\]\)walk/.exec(dockerfile)?.[1]?.replace(/['"]/g, "").split(",") ?? [];

  it("Dockerfile'ın bağımlılık kapanışı betiklerin tüm paket import'larını kapsar", () => {
    expect(roots.length).toBeGreaterThan(0);
    for (const script of ["scripts/migrate.mjs", "scripts/create-admin.mjs"]) {
      for (const pkg of packageImports(read(script))) {
        expect(roots, `${script} '${pkg}' paketini içe aktarıyor`).toContain(pkg);
      }
    }
  });

  it("kök paketler package.json'da sürüm aralığıyla, kilit dosyasında sabitlenmiş olarak bulunur", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
    const lock = JSON.parse(read("package-lock.json")) as { packages: Record<string, { version?: string }> };
    for (const name of roots) {
      expect(pkg.dependencies[name], `${name} dependencies içinde olmalı`).toBeTruthy();
      expect(lock.packages[`node_modules/${name}`]?.version, `${name} kilit dosyasında`).toMatch(/^\d+\.\d+\.\d+/);
    }
  });

  it("her iki betik imaja /opt/migrator altına kopyalanır", () => {
    expect(dockerfile).toMatch(/COPY[^\n]*scripts\/migrate\.mjs[^\n]*scripts\/create-admin\.mjs[^\n]*\/opt\/migrator\//);
  });
});
