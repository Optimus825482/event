import ExcelJS from "exceljs";

import { expect, test } from "./support/fixtures";
import { reservationCount, withDb } from "./support/db";
import { addTablesAndSave, allocateAllToCasino, createEvent, publishEvent } from "./support/ui";

const EVENT_NAME = "E2E Excel İçe Aktarma";

test.describe("Excel içe aktarma", () => {
  test("şablon indirilir, iki satır doldurulur, önizlenir ve onayla rezervasyon oluşturulur", async ({ page }, testInfo) => {
    const eventId = await createEvent(page, EVENT_NAME);
    await addTablesAndSave(page, eventId, [
      { label: "X1", capacity: 4 },
      { label: "X2", capacity: 6 },
    ]);
    await allocateAllToCasino(page, eventId);
    await publishEvent(page, eventId);

    await page.goto(`/import/reservations/${eventId}`);
    await expect(page.getByRole("heading", { name: "Rezervasyonları Excel'den içe aktar", level: 1 })).toBeVisible();

    // Şablonu indir.
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Şablonu indir" }).click()]);
    expect(download.suggestedFilename()).toBe("rezervasyon-sablonu.xlsx");
    const templatePath = testInfo.outputPath("sablon.xlsx");
    await download.saveAs(templatePath);

    // İki satır doldur.
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const sheet = workbook.getWorksheet("Veri");
    if (!sheet) throw new Error("Şablonda 'Veri' sayfası yok");
    const header = (sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1).map(String);
    expect(header).toEqual(["Masa etiketi", "Misafir adı", "Telefon", "E-posta", "Kişi sayısı", "Not"]);
    sheet.addRow(["X1", "Excel Misafir Bir", "5320000001", "bir@example.com", 3, "Pencere kenarı"]);
    sheet.addRow(["X2", "Excel Misafir İki", "5320000002", "iki@example.com", 5, ""]);
    const filledPath = testInfo.outputPath("rezervasyonlar.xlsx");
    await workbook.xlsx.writeFile(filledPath);

    // Yükle ve önizle.
    await page.getByLabel("Excel dosyası (.xlsx)").setInputFiles(filledPath);
    await page.getByRole("button", { name: "Önizle" }).click();
    await expect(page.getByRole("heading", { name: "Önizleme: 2 uygun, 0 hatalı satır" })).toBeVisible();
    const preview = page.getByRole("region", { name: /Önizleme/ });
    await expect(preview.getByRole("row")).toHaveCount(3);
    expect(await reservationCount(EVENT_NAME)).toBe(0);

    // Onayla.
    await page.getByRole("button", { name: "Onayla ve içe aktar" }).click();
    await expect(page.getByRole("heading", { name: "Sonuç: 2 satır işlendi, 0 satır atlandı" })).toBeVisible();
    expect(await reservationCount(EVENT_NAME)).toBe(2);

    const rows = await withDb((pool) =>
      pool.query<{ guest_name: string; guest_count: number }>(
        "select r.guest_name, r.guest_count from reservations r join events e on e.id = r.event_id where e.name = $1 order by r.guest_name",
        [EVENT_NAME],
      ),
    );
    expect(rows.rows).toEqual([
      { guest_name: "Excel Misafir Bir", guest_count: 3 },
      { guest_name: "Excel Misafir İki", guest_count: 5 },
    ]);

    await page.goto(`/reservations/${eventId}`);
    await expect(page.getByText("Excel Misafir Bir")).toBeVisible();
    await expect(page.getByText("Excel Misafir İki")).toBeVisible();
  });
});
