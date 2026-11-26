import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { exportPeriodReport } from "@/features/reports/export";
import { managerActor } from "../../helpers/actors";
import { insertArchive } from "../../helpers/archive";
import { truncateAll } from "../../helpers/db";

beforeEach(truncateAll);

const actor = managerActor("entertainment");

const PERIOD_HEADERS = [
  "Etkinlik", "Tarih", "Sanatçı", "Tür", "Para birimi", "Satılabilir sandalye", "Satılan bilet", "Demo bilet",
  "Bilet geliri", "Demo bilet geliri", "Sanatçı ücreti", "Tahmini gider", "Gerçekleşen gider", "Tahmini diğer gelir",
  "Gerçekleşen diğer gelir", "Net (gerçekleşen)", "Casino masa", "Rezervasyon", "No-show", "Beklenen misafir",
  "Giriş yapan misafir", "Giriş yapan bilet", "F&B personel", "Doluluk %", "Katılım %", "No-show %",
];

async function load(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  return workbook;
}

async function readSheet(bytes: Uint8Array, name: string): Promise<(string | number | null)[][]> {
  const sheet = (await load(bytes)).getWorksheet(name);
  if (!sheet) throw new Error(`sayfa yok: ${name}`);
  const rows: (string | number | null)[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: (string | number | null)[] = [];
    for (let c = 1; c <= sheet.columnCount; c += 1) cells.push((row.getCell(c).value as string | number | null) ?? null);
    rows.push(cells);
  });
  return rows;
}

describe("dönem raporu Excel", () => {
  it("dönem raporu: başlıklar, etkinlik satırı ve demo sütunları ayrı", async () => {
    await insertArchive(db, {
      eventName: "Gala", startsAt: new Date("2027-01-10T18:00:00Z"), artistName: "Sezen Aksu", eventType: "Konser",
      sellableSeatCount: 14, ticketsSold: 4, ticketRevenue: "550.50", demoTicketsSold: 2, demoTicketRevenue: "501.00",
      estimatedExpense: "1500.00", estimatedOtherIncome: "300.00", actualExpense: "1680.00", actualOtherIncome: "250.25", artistFee: "1200.00",
    });
    const res = await exportPeriodReport(db, actor, { from: "2027-01-01", to: "2027-01-31" });
    if (!res.ok) throw new Error(res.message);
    expect(res.filename).toBe("donem-raporu-2027-01-01_2027-01-31.xlsx");
    const rows = await readSheet(res.bytes, "Dönem raporu");
    expect(rows[0]).toEqual(PERIOD_HEADERS);
    expect(rows[1]!.slice(0, 5)).toEqual(["Gala", "10.01.2027 20:00", "Sezen Aksu", "Konser", "TRY"]);
    expect(rows[1]!.slice(6, 10)).toEqual([4, 2, 550.5, 501]);
    expect(rows[1]![15]).toBe(-879.25);
    const totals = await readSheet(res.bytes, "Toplamlar");
    expect(totals[1]!.slice(0, 6)).toEqual(["TRY", 1, 4, 2, 550.5, 501]);
    expect(totals[0]!.slice(7, 11)).toEqual(["Tahmini gider", "Gerçekleşen gider", "Tahmini diğer gelir", "Gerçekleşen diğer gelir"]);
    expect(totals[1]!.slice(7, 11)).toEqual([1500, 1680, 300, 250.25]);
  });

  it("iki para birimi iki toplam satırı verir", async () => {
    await insertArchive(db, { startsAt: new Date("2027-01-10T18:00:00Z"), currency: "TRY" });
    await insertArchive(db, { startsAt: new Date("2027-01-11T18:00:00Z"), currency: "EUR" });
    const res = await exportPeriodReport(db, actor, { from: "2027-01-01", to: "2027-01-31" });
    if (!res.ok) throw new Error(res.message);
    const totals = await readSheet(res.bytes, "Toplamlar");
    expect(totals).toHaveLength(3);
    expect([totals[1]![0], totals[2]![0]]).toEqual(["EUR", "TRY"]);
  });

  it("'=' ile başlayan etkinlik adı formül değil metin hücresidir", async () => {
    await insertArchive(db, { eventName: "=1+1", startsAt: new Date("2027-01-10T18:00:00Z") });
    const res = await exportPeriodReport(db, actor, { from: "2027-01-01", to: "2027-01-31" });
    if (!res.ok) throw new Error(res.message);
    const cell = (await load(res.bytes)).getWorksheet("Dönem raporu")!.getCell("A2");
    expect(cell.value).toBe("=1+1");
    expect(typeof cell.value).toBe("string");
    expect(cell.formula).toBeUndefined();
  });

  it("para hücreleri iki ondalık sayı biçimindedir", async () => {
    await insertArchive(db, { startsAt: new Date("2027-01-10T18:00:00Z"), ticketRevenue: "550.50" });
    const res = await exportPeriodReport(db, actor, { from: "2027-01-01", to: "2027-01-31" });
    if (!res.ok) throw new Error(res.message);
    const cell = (await load(res.bytes)).getWorksheet("Dönem raporu")!.getCell("I2");
    expect(cell.numFmt).toBe("#,##0.00");
    expect(typeof cell.value).toBe("number");
  });

  it("dönem boşsa yalnızca başlık satırı", async () => {
    const res = await exportPeriodReport(db, actor, { from: "2027-01-01", to: "2027-01-31" });
    if (!res.ok) throw new Error(res.message);
    expect(await readSheet(res.bytes, "Dönem raporu")).toHaveLength(1);
  });

  it.each([
    [{ from: "2027-01-31", to: "2027-01-01" }, 400, "Bitiş, başlangıçtan önce olamaz"],
    [{ from: null, to: null }, 400, "Geçerli bir tarih girin"],
    [{ from: "2020-01-01", to: "2027-01-01" }, 400, "Dönem en fazla 5 yıl olabilir"],
  ])("geçersiz dönem %j → %i", async (params, status, message) => {
    const res = await exportPeriodReport(db, actor, params);
    expect(res).toEqual({ ok: false, status, message });
  });

  it("yetkisiz kullanıcı geçersiz dönemle de 403 alır (400 değil)", async () => {
    expect(await exportPeriodReport(db, managerActor("fnb"), { from: "2027-01-31", to: "2027-01-01" })).toEqual({
      ok: false, status: 403, message: "Bu işlem için yetkiniz yok",
    });
  });

  it("oturumsuz → 401; F&B ve Casino yöneticisi → 403", async () => {
    const params = { from: "2027-01-01", to: "2027-01-31" };
    expect(await exportPeriodReport(db, null, params)).toEqual({ ok: false, status: 401, message: "Oturum gerekli" });
    for (const department of ["fnb", "casino"] as const) {
      expect(await exportPeriodReport(db, managerActor(department), params)).toEqual({
        ok: false, status: 403, message: "Bu işlem için yetkiniz yok",
      });
    }
  });
});
