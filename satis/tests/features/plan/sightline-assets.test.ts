import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SIGHTLINE_SETS } from "@/lib/core/contract";

const ROOT = path.resolve(process.cwd(), "public/sightline");

describe("sightline assets", () => {
  it("diamond setinde 174 WebP vardır ve overview dışındaki her ad etiket kuralına uyar", () => {
    const dir = path.join(ROOT, "diamond");
    const files = fs.readdirSync(dir);
    expect(files).toHaveLength(174);
    for (const file of files) {
      expect(file).toMatch(/^(overview|[A-Z]-[0-9]{1,3}[A-Z]?)\.webp$/);
    }
  });

  it("set 16 MB'ı, tek dosya 200 KB'ı aşmaz", () => {
    const dir = path.join(ROOT, "diamond");
    let total = 0;
    for (const file of fs.readdirSync(dir)) {
      const size = fs.statSync(path.join(dir, file)).size;
      expect(size).toBeLessThanOrEqual(200 * 1024);
      total += size;
    }
    expect(total).toBeLessThanOrEqual(16 * 1024 * 1024);
  });

  it("contract'taki her sahne görüşü setinin klasörü ve overview dosyası vardır", () => {
    for (const set of SIGHTLINE_SETS) {
      expect(fs.existsSync(path.join(ROOT, set, "overview.webp"))).toBe(true);
    }
  });
});
