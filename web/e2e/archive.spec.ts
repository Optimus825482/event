import { randomBytes } from "node:crypto";

import ExcelJS from "exceljs";
import type { Page } from "@playwright/test";

import { withDb } from "./support/db";
import { ADMIN_STATE, EMPTY_STATE, expect, loginAs, test } from "./support/fixtures";
import { addTablesAndSave, allocateAllToCasino, createEvent, fillReservation, publishEvent } from "./support/ui";

// Senaryolar aynı etkinlik üzerinde sırayla ilerler.
test.describe.configure({ mode: "serial", timeout: 240_000 });

const EVENT_NAME = "E2E Arşiv Gecesi";
const ARTIST = "E2E Sanatçı";
const FNB_USER = "e2e-arsiv-fnb";
const PASSWORD = `Ar1-${randomBytes(12).toString("base64url")}`;
const JUNE = "from=2030-06-01&to=2030-06-30";

let eventId = "";

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "yatay taşma (px)").toBeLessThanOrEqual(0);
}

/** WCAG karşıtlık oranı: seçilen öğelerin metin rengi ile en yakın opak arka planı arasındaki en düşük oran. */
async function minContrast(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const parse = (c: string): [number, number, number, number] => {
      if (!ctx) return [0, 0, 0, 1];
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, (d[3] ?? 255) / 255];
    };
    const lum = (r: number, g: number, b: number) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el: Element): [number, number, number] => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c[3] > 0.95) return [c[0], c[1], c[2]];
      }
      return [0, 0, 0];
    };
    let min = Infinity;
    for (const el of Array.from(document.querySelectorAll(sel))) {
      if (!(el as HTMLElement).innerText?.trim()) continue;
      const fg = parse(getComputedStyle(el).color);
      const bg = bgOf(el);
      const l1 = lum(fg[0], fg[1], fg[2]);
      const l2 = lum(bg[0], bg[1], bg[2]);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < min) min = ratio;
    }
    return min;
  }, selector);
}

test.describe("Arşiv, sanatçılar ve raporlar", () => {
  test("menüde Entertainment altında Arşiv, Sanatçılar ve Raporlar görünür", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Entertainment", exact: true, level: 2 }) }).click();
    const nav = page.getByRole("navigation", { name: "Ana menü" });
    await expect(nav).toBeVisible();
    for (const [label, href] of [
      ["Arşiv", "/archive"],
      ["Sanatçılar", "/artists"],
      ["Raporlar", "/reports"],
    ] as const) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
    }
  });

  test("sanatçı eklenir; etkinlik sayısı 0", async ({ page }) => {
    await page.goto("/artists");
    await page.getByLabel("Ad", { exact: true }).fill(ARTIST);
    await page.getByRole("button", { name: "Sanatçı ekle" }).click();
    const row = page.getByRole("row").filter({ hasText: ARTIST });
    await expect(row).toBeVisible();
    // "Etkinlik sayısı" sütunu 3. hücre.
    await expect(row.getByRole("cell").nth(2)).toHaveText("0");
  });

  test("etkinlik oluşturulur, sanatçı yazılır, masa/rezervasyon eklenir; tamamlanmadan arşivde yok", async ({ page }) => {
    eventId = await createEvent(page, EVENT_NAME);
    await page.getByLabel("Sanatçı").fill("e2e sanatçı");
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    // Kayıt başarılıysa sayfa yenilenir ve sanatçı satırı görünür.
    await expect(page.getByText(`Sanatçı: ${ARTIST}`)).toBeVisible();
    await page.reload();
    await expect(page.getByText(`Sanatçı: ${ARTIST}`)).toBeVisible();

    await addTablesAndSave(page, eventId, [
      { label: "T1", capacity: 4 },
      { label: "T2", capacity: 4 },
    ]);
    await allocateAllToCasino(page, eventId);
    await publishEvent(page, eventId);
    await page.goto(`/reservations/${eventId}/new`);
    await fillReservation(page, { table: "T1", guests: 3, name: "Arşiv Misafir" });
    await page.waitForURL((url) => !url.pathname.endsWith("/new"));

    await page.goto("/archive");
    await expect(page.getByRole("heading", { name: "Arşiv", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: EVENT_NAME })).toHaveCount(0);
  });

  test("etkinlik başlatılıp tamamlanır", async ({ page }) => {
    await page.goto(`/events/${eventId}`);
    await page.getByRole("button", { name: "Başlat", exact: true }).click();
    await page.getByRole("button", { name: "Tamamla", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Tamamla", exact: true }).click();
    await expect(page.getByText("Tamamlandı", { exact: true }).first()).toBeVisible();
  });

  test("arşiv listesi ve ayrıntı; değişmezlik ve yeniden oluşturma", async ({ page }) => {
    await page.goto("/archive");
    const link = page.getByRole("link", { name: EVENT_NAME });
    await expect(link).toBeVisible();
    expect(await minContrast(page, "main td, main th, main p, main h1, main a")).toBeGreaterThanOrEqual(4.5);
    await link.click();
    await page.waitForURL(/\/archive\/[0-9a-f-]{36}$/);

    const stat = (label: string) =>
      page.locator("dt", { hasText: new RegExp(`^${label}$`) }).locator("xpath=following-sibling::dd[1]");
    await expect(page.getByText("Sürüm 1")).toBeVisible();
    await expect(stat("Masa sayısı")).toHaveText("2");
    await expect(stat("Toplam kapasite")).toHaveText("8");
    await expect(stat("Casino masası")).toHaveText("2");
    await expect(stat("Rezervasyon")).toHaveText("1");
    await expect(stat("No-show")).toHaveText(/100/);
    await expect(stat("Satılan bilet")).toHaveText("0");
    await expect(page.getByRole("heading", { name: "Demo satış" })).toHaveCount(0);
    expect(await minContrast(page, "main dt, main dd, main h2, main td, main th")).toBeGreaterThanOrEqual(4.5);

    // Değişmezlik: kaynak tablo değişse de arşiv aynı kalır.
    await withDb((pool) => pool.query("update event_tables set capacity = 12 where event_id = $1", [eventId]));
    await page.reload();
    await expect(stat("Toplam kapasite")).toHaveText("8");

    await page.getByRole("button", { name: "Arşivi yeniden oluştur" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Yeniden oluştur" }).click();
    await expect(page.getByText("Sürüm 2")).toBeVisible();
    await expect(stat("Toplam kapasite")).toHaveText("24");
  });

  test("dönem raporu, dönem formu hatası ve Excel dışa aktarımları", async ({ page }, testInfo) => {
    await page.goto(`/reports?${JUNE}`);
    await expect(page.getByRole("row").filter({ hasText: EVENT_NAME })).toBeVisible();
    await page.goto("/reports?from=2030-07-01&to=2030-07-31");
    await expect(page.getByText("Bu dönemde arşivlenmiş etkinlik yok.")).toBeVisible();

    // Geçersiz dönem: hata uyarısı gösterilir, rapor ve dışa aktarma yok.
    await page.goto("/reports?from=2030-07-31&to=2030-07-01");
    await expect(page.locator("#period-error")).toBeVisible();
    await expect(page.locator("#period-error")).toHaveAttribute("role", "alert");
    await expect(page.getByLabel("Başlangıç")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("link", { name: "Excel'e aktar" })).toHaveCount(0);

    await page.goto(`/reports?${JUNE}`);
    const [periodDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Excel'e aktar" }).click(),
    ]);
    expect(periodDownload.suggestedFilename()).toBe("donem-raporu-2030-06-01_2030-06-30.xlsx");
    const periodPath = testInfo.outputPath("donem.xlsx");
    await periodDownload.saveAs(periodPath);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(periodPath);
    const sheet = wb.getWorksheet("Dönem raporu");
    if (!sheet) throw new Error("'Dönem raporu' sayfası yok");
    const header = (sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1).map(String);
    const row = (sheet.getRow(2).values as ExcelJS.CellValue[]).slice(1);
    expect(row.slice(0, 5)).toEqual([EVENT_NAME, "15.06.2030 20:00", ARTIST, "Gala", "TRY"]);
    expect(row[header.indexOf("Satılan bilet")]).toBe(0);
    expect(row[header.indexOf("Rezervasyon")]).toBe(1);

    await page.goto(`/archive/${eventId}`);
    const [archiveDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Excel'e aktar" }).click(),
    ]);
    expect(archiveDownload.suggestedFilename()).toBe("arsiv-2030-06-15.xlsx");
    const archivePath = testInfo.outputPath("arsiv.xlsx");
    await archiveDownload.saveAs(archivePath);
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.readFile(archivePath);
    expect(wb2.worksheets.map((s) => s.name)).toEqual(["Özet", "Kategoriler", "Finans kalemleri", "Kapılar"]);
  });

  test("sanatçı geçmişi görünür; arşivde etkinliği olan sanatçı silinemez", async ({ page }) => {
    await page.goto("/artists");
    const row = page.getByRole("row").filter({ hasText: ARTIST });
    await expect(row.getByRole("cell").nth(2)).toHaveText("1");
    await row.getByRole("link", { name: ARTIST }).click();
    await page.waitForURL(/\/artists\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("link", { name: EVENT_NAME })).toBeVisible();

    await page.getByRole("button", { name: "Sil", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Sil", exact: true }).click();
    await expect(page.getByText("Arşivde etkinliği olan sanatçı silinemez; pasife alın").first()).toBeVisible();
    await expect(page).toHaveURL(/\/artists\/[0-9a-f-]{36}$/);
  });

  test("375px genişlikte sayfalar yatay taşmaz", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_STATE, viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    try {
      for (const path of ["/archive", `/archive/${eventId}`, "/artists", `/reports?${JUNE}`]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
      await page.goto("/artists");
      await page.getByRole("link", { name: ARTIST }).click();
      await page.waitForURL(/\/artists\/[0-9a-f-]{36}$/);
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });

  test("F&B kullanıcısı beş adreste 403 görür (geçersiz dönemli /reports dahil)", async ({ page, browser }) => {
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Yeni kullanıcı" }).click();
    await page.getByLabel("Kullanıcı adı", { exact: true }).fill(FNB_USER);
    await page.getByLabel("Ad soyad").fill("Arşiv F&B");
    await page.getByLabel("Rol", { exact: true }).selectOption({ label: "Departman kullanıcısı" });
    await page.getByLabel("Food & Beverage", { exact: true }).check();
    await page.getByLabel("Food & Beverage düzeyi").selectOption({ label: "Yönetici" });
    await page.getByLabel("Parola", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Kullanıcı oluştur" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Kullanıcı oluşturuldu" })).toBeVisible();

    const artistId = await withDb(
      async (pool) => (await pool.query<{ id: string }>("select id from artists where name = $1", [ARTIST])).rows[0]?.id,
    );
    expect(artistId).toBeTruthy();
    const context = await browser.newContext({ storageState: EMPTY_STATE });
    const fnb = await context.newPage();
    try {
      await loginAs(fnb, FNB_USER, PASSWORD);
      await fnb.waitForURL((url) => !url.pathname.startsWith("/login"));
      const paths = ["/archive", `/archive/${eventId}`, "/artists", `/artists/${artistId}`, "/reports", "/reports?from=bozuk&to=2030-01-01"];
      for (const path of paths) {
        await fnb.goto(path);
        await expect(fnb.getByRole("heading", { name: "Bu sayfaya erişim yetkiniz yok" }), path).toBeVisible();
        await expect(fnb.getByText(EVENT_NAME)).toHaveCount(0);
      }
    } finally {
      await context.close();
    }
  });
});
