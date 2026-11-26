import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../../src");
const FORBIDDEN = [path.join(SRC, "lib/env.ts"), path.join(SRC, "lib/core/client.ts")];
const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

function isClientFile(text: string): boolean {
  const head = text.replace(/^(\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "");
  return /^["']use client["']/.test(head);
}

/** `"use server"` dosyaları istemci paketine girmez; istemci yalnızca RPC başvurusu alır (izinli sınır). */
function isServerActionFile(text: string): boolean {
  const head = text.replace(/^(\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "");
  return /^["']use server["']/.test(head);
}

function importsOf(file: string, text: string): string[] {
  const found: string[] = [];
  const pattern =
    /(?:import|export)\s[^"';]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of text.matchAll(pattern)) {
    const spec = match[1] ?? match[2] ?? match[3];
    if (!spec) continue;
    const base = spec.startsWith("@/")
      ? path.join(SRC, spec.slice(2))
      : spec.startsWith(".")
        ? path.resolve(path.dirname(file), spec)
        : null;
    if (!base) continue;
    const resolved = EXTENSIONS.map((ext) => base + ext).find((p) => existsSync(p) && statSync(p).isFile());
    if (resolved) found.push(resolved);
  }
  return found;
}

/** Başlangıç dosyasından yasak modüle giden ilk içe aktarma zincirini döndürür. */
function findChain(start: string, texts: Map<string, string>): string[] | null {
  const seen = new Set<string>([start]);
  const queue: string[][] = [[start]];
  while (queue.length > 0) {
    const chain = queue.shift()!;
    const current = chain[chain.length - 1]!;
    for (const next of importsOf(current, texts.get(current) ?? "")) {
      if (FORBIDDEN.includes(next)) return [...chain, next];
      if (isServerActionFile(texts.get(next) ?? "")) continue;
      if (seen.has(next) || !texts.has(next)) continue;
      seen.add(next);
      queue.push([...chain, next]);
    }
  }
  return null;
}

describe("yalnızca sunucu modülleri", () => {
  it("'use client' dosyaları env ve çekirdek istemcisini dolaylı da olsa içe aktarmaz", () => {
    const files = listFiles(SRC).filter((f) => /\.(ts|tsx)$/.test(f));
    const texts = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
    const problems: string[] = [];
    for (const [file, text] of texts) {
      if (!isClientFile(text)) continue;
      const chain = findChain(file, texts);
      if (chain) problems.push(chain.map((p) => path.relative(SRC, p).replace(/\\/g, "/")).join(" -> "));
    }
    expect(problems).toEqual([]);
  });

  it("denetçi yasak zinciri yakalar", () => {
    const client = path.join(SRC, "lib/core/client.ts");
    const a = path.join(SRC, "lib/format.ts");
    const b = path.join(SRC, "lib/cn.ts");
    const texts = new Map([
      [a, 'import { x } from "./cn";'],
      [b, 'import "./core/client";'],
      [client, ""],
    ]);
    expect(findChain(a, texts)?.length).toBe(3);
  });

  it("'use server' dosyası sınırdır; ardındaki zincir sayılmaz", () => {
    const client = path.join(SRC, "lib/core/client.ts");
    const a = path.join(SRC, "x/a.tsx");
    const action = path.join(SRC, "x/actions.ts");
    const texts = new Map([
      [a, 'import { go } from "./actions";'],
      [action, '"use server";\nimport "../lib/core/client";'],
      [client, ""],
    ]);
    expect(findChain(a, texts)).toBeNull();
  });
});
