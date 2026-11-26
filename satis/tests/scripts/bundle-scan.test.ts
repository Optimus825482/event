import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findLeaks } from "../../scripts/bundle-scan.mjs";

let dir: string;

function write(relativePath: string, content: string) {
  const full = join(dir, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "latin1");
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "satis-bundle-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("findLeaks", () => {
  it("iğneyi içeren dosyaları göreli yollarıyla bulur", () => {
    write("static/chunks/a.js", "var x='NOBETCI-123'");
    write("server/app/page.js", "temiz");
    write("static/b.css", ".x{}");
    expect(findLeaks(dir, ["NOBETCI-123"])).toEqual(["static/chunks/a.js"]);
  });

  it("temiz dizinde boş liste döner", () => {
    write("a.js", "temiz");
    expect(findLeaks(dir, ["yok"])).toEqual([]);
  });

  it("alt dizinleri ve birden çok iğneyi tarar", () => {
    write("a/b/c.js", "X");
    write("d.map", "Y");
    write("e.js", "Z");
    expect(findLeaks(dir, ["X", "Y"])).toEqual(["a/b/c.js", "d.map"]);
  });
});
