import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

describe("saat dilimi", () => {
  it("src altında Europe/Istanbul geçmez", () => {
    const needle = ["Europe", "Istanbul"].join("/");
    const offenders = listFiles(path.resolve(import.meta.dirname, "../../src")).filter((file) =>
      readFileSync(file, "utf8").includes(needle),
    );
    expect(offenders).toEqual([]);
  });
});
