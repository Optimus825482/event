import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FEATURES_DIR = path.resolve(import.meta.dirname, "../../src/features");

const TYPE_EXPORT = /^export\s+(?:type|interface)\b/;
const DEFINE_ACTION_EXPORT =
  /^export\s+const\s+[A-Za-z_$][\w$]*\s*(?::[^=]+)?=\s*defineAction\s*[<(]/;

/**
 * Bir action dosyasındaki, `defineAction(...)` sonucu olmayan dışa aktarımları
 * satır numarasıyla döner. Tür dışa aktarımları (derlemede silinir) serbesttir.
 */
function findViolations(source: string): string[] {
  const violations: string[] = [];
  for (const match of source.matchAll(/^export\b/gm)) {
    const rest = source.slice(match.index);
    if (TYPE_EXPORT.test(rest) || DEFINE_ACTION_EXPORT.test(rest)) continue;
    const line = source.slice(0, match.index).split("\n").length;
    violations.push(`satır ${line}: ${(rest.split("\n")[0] ?? "").trim()}`);
  }
  return violations;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function isActionFile(file: string): boolean {
  const rel = path.relative(FEATURES_DIR, file).split(path.sep).join("/");
  if (rel.endsWith(".test.ts") || !rel.endsWith(".ts")) return false;
  return /(^|\/)actions\.ts$/.test(rel) || /(^|\/)actions\/[^/]+\.ts$/.test(rel);
}

describe("action dosyaları yalnızca defineAction dışa aktarır", () => {
  it("src/features altındaki tüm action dosyaları kurala uyar", () => {
    const failures = walk(FEATURES_DIR)
      .filter(isActionFile)
      .flatMap((file) =>
        findViolations(readFileSync(file, "utf8")).map(
          (v) => `${path.relative(FEATURES_DIR, file)} ${v}`,
        ),
      );
    expect(failures, `defineAction kullanmayan dışa aktarımlar:\n${failures.join("\n")}`).toEqual([]);
  });

  it("tarayıcı gerçek dosya adlarını tanır", () => {
    expect(isActionFile(path.join(FEATURES_DIR, "events/actions.ts"))).toBe(true);
    expect(isActionFile(path.join(FEATURES_DIR, "events/actions/create.ts"))).toBe(true);
    expect(isActionFile(path.join(FEATURES_DIR, "events/queries.ts"))).toBe(false);
    expect(isActionFile(path.join(FEATURES_DIR, "events/actions/create.test.ts"))).toBe(false);
  });

  describe("kendi kendini sınama", () => {
    it("kurala uyan örnekte ihlal yoktur", () => {
      const good = [
        `"use server";`,
        `import { defineAction } from "@/lib/action";`,
        `export type Foo = { a: 1 };`,
        `export const createEvent = defineAction({`,
        `  module: "events",`,
        `});`,
        `export const typed: Thing =`,
        `  defineAction({ module: "events" });`,
      ].join("\n");
      expect(findViolations(good)).toEqual([]);
    });

    it("kuralı çiğneyen örnekte her ihlali yakalar", () => {
      const bad = [
        `export async function plain() {}`,
        `export const sneaky = async () => 1;`,
        `export const fine = defineAction({});`,
        `export { other } from "./other";`,
        `export default defineAction({});`,
        `export const notCalled = defineAction;`,
      ].join("\n");
      const found = findViolations(bad);
      expect(found).toHaveLength(5);
      expect(found[0]).toContain("satır 1");
      expect(found.join("\n")).not.toContain("satır 3");
    });
  });
});
