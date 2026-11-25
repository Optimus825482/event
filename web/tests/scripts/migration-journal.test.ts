import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FOLDER = path.resolve(import.meta.dirname, "../../drizzle");
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

interface Entry {
  idx: number;
  tag: string;
  when: number;
}
interface Snapshot {
  id: string;
  prevId: string;
}

const entries: Entry[] = JSON.parse(readFileSync(path.join(FOLDER, "meta", "_journal.json"), "utf8")).entries;
const pad4 = (n: number) => String(n).padStart(4, "0");
const snapshotPath = (i: number) => path.join(FOLDER, "meta", `${pad4(i)}_snapshot.json`);

describe("drizzle/meta/_journal.json bütünlüğü", () => {
  it("journal sıra numaraları 0'dan kesintisiz, etiketler numarayla başlar", () => {
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach((e, i) => {
      expect(e.idx).toBe(i);
      expect(e.tag.startsWith(`${pad4(i)}_`)).toBe(true);
    });
  });

  it("when değerleri kesin artan", () => {
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i]!.when, `${entries[i]!.tag} when değeri öncekinden büyük olmalı`).toBeGreaterThan(entries[i - 1]!.when);
    }
  });

  it("her girdinin SQL ve snapshot dosyası var; snapshot zinciri kopuk değil", () => {
    let prev: Snapshot | undefined;
    entries.forEach((e, i) => {
      expect(existsSync(path.join(FOLDER, `${e.tag}.sql`)), `${e.tag}.sql yok`).toBe(true);
      expect(existsSync(snapshotPath(i)), `${pad4(i)}_snapshot.json yok`).toBe(true);
      const snap: Snapshot = JSON.parse(readFileSync(snapshotPath(i), "utf8"));
      expect(snap.prevId, `${pad4(i)} snapshot zinciri`).toBe(prev ? prev.id : ZERO_UUID);
      prev = snap;
    });
  });

  it("klasörde journal'a girmemiş SQL dosyası yok", () => {
    const inJournal = new Set(entries.map((e) => `${e.tag}.sql`));
    const onDisk = readdirSync(FOLDER).filter((f) => f.endsWith(".sql"));
    expect(onDisk.filter((f) => !inJournal.has(f))).toEqual([]);
  });
});
