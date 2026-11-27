import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { exportArchive } from "@/features/archive/export";
import { archiveEvent } from "@/features/archive/snapshot";
import { managerActor } from "../../helpers/actors";
import { seedScenario } from "../../helpers/archive";
import { truncateAll } from "../../helpers/db";
import { createEvent } from "../../helpers/factories";

beforeEach(truncateAll);

const actor = managerActor("entertainment");

async function readSheet(bytes: Uint8Array, name: string): Promise<(string | number | null)[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  const sheet = workbook.getWorksheet(name);
  if (!sheet) throw new Error(`sayfa yok: ${name}`);
  const rows: (string | number | null)[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: (string | number | null)[] = [];
    for (let c = 1; c <= sheet.columnCount; c += 1) cells.push((row.getCell(c).value as string | number | null) ?? null);
    rows.push(cells);
  });
  return rows;
}

describe("arşiv Excel", () => {
  it("arşiv dosyası dört sayfa içerir; özet değerleri arşivle aynı", async () => {
    const s = await seedScenario(db);
    await db.transaction((tx) => archiveEvent(tx, s.event.id, null));
    const res = await exportArchive(db, actor, s.event.id);
    if (!res.ok) throw new Error(res.message);
    expect(res.filename).toBe("arsiv-2027-01-10.xlsx");
    const summary = Object.fromEntries((await readSheet(res.bytes, "Özet")).slice(1) as [string, unknown][]);
    expect(summary).toMatchObject({
      "Etkinlik": "Gala", "Sanatçı": "Sezen Aksu", "Satılan bilet": 6, "Bilet geliri": 1051.5,
      "Demo bilet (gerçek ödeme alınmadı)": 0, "Demo bilet geliri (gerçek ödeme alınmadı)": 0,
      "Net (gerçekleşen)": -378.25, "F&B personel": 4, "Doluluk %": 42.9, "Katılım %": 50, "No-show %": 50,
    });
    expect(await readSheet(res.bytes, "Kategoriler")).toEqual([
      ["Kategori", "Satılan bilet", "Gelir"], ["Standart", 3, 300], ["Premium", 0, 0], ["VIP", 3, 751.5],
    ]);
    expect((await readSheet(res.bytes, "Finans kalemleri"))[1]).toEqual(["Gider", "artist_fee", "Sanatçı ücreti", 1000, 1200]);
    expect(await readSheet(res.bytes, "Kapılar")).toEqual([["Kapı", "Bilet", "Rezervasyon"], [1, 2, 0], [2, 0, 1]]);
  });

  it("Özet sayfasında para ve yüzde satırları biçimlenir", async () => {
    const s = await seedScenario(db);
    await db.transaction((tx) => archiveEvent(tx, s.event.id, null));
    const res = await exportArchive(db, actor, s.event.id);
    if (!res.ok) throw new Error(res.message);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.bytes as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet("Özet")!;
    const fmt = new Map<string, string>();
    sheet.eachRow((row) => fmt.set(String(row.getCell(1).value), row.getCell(2).numFmt));
    expect(fmt.get("Bilet geliri")).toBe("#,##0.00");
    expect(fmt.get("Net (gerçekleşen)")).toBe("#,##0.00");
    expect(fmt.get("Doluluk %")).toBe('0.0" %"');
    expect(fmt.get("No-show %")).toBe('0.0" %"');
    expect(fmt.get("Satılan bilet")).not.toBe("#,##0.00");
  });

  it("arşivi olmayan etkinlik → 404; oturumsuz → 401; izinsiz → 403", async () => {
    const event = await createEvent(db, { status: "completed", startsAt: new Date("2027-01-10T18:00:00Z") });
    expect(await exportArchive(db, actor, event.id)).toEqual({ ok: false, status: 404, message: "Arşiv kaydı bulunamadı" });
    expect(await exportArchive(db, actor, randomUUID())).toMatchObject({ ok: false, status: 404 });
    expect(await exportArchive(db, null, event.id)).toEqual({ ok: false, status: 401, message: "Oturum gerekli" });
    expect(await exportArchive(db, managerActor("fnb"), event.id)).toEqual({
      ok: false, status: 403, message: "Bu işlem için yetkiniz yok",
    });
  });
});
