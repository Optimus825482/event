import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { qrTokenFor, reservationCount } from "./support/db";
import { createEvent, fillReservation } from "./support/ui";

// Bu dosyadaki senaryolar aynı etkinlik üzerinde sırayla ilerler (etkinlik, yerleşim, rezervasyon, check-in).
test.describe.configure({ mode: "serial" });

const EVENT_NAME = "E2E Gala Gecesi";
let eventId = "";

test.describe("Etkinlik ve masa yerleşimi", () => {
  test("etkinlik oluşturulur, masalar eklenir, kaydedilir, yenilemede kalır ve etkinlik yayınlanır", async ({ page }) => {
    eventId = await createEvent(page, EVENT_NAME);
    await expect(page.getByText("Taslak", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Masa yerleşimi" }).click();
    await expect(page.getByRole("heading", { name: "Masa yerleşimi", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Masa ekle" })).toBeVisible();

    const specs = [
      { label: "T1", capacity: 4 },
      { label: "T2", capacity: 6 },
      { label: "T3", capacity: 8 },
    ];
    for (const spec of specs) {
      await page.getByRole("button", { name: "Masa ekle" }).click();
      const panel = page.getByRole("region", { name: "Masa özellikleri" });
      await panel.getByLabel("Etiket").fill(spec.label);
      await panel.getByLabel("Etiket").press("Enter");
      await expect(panel.getByLabel("Etiket")).toHaveValue(spec.label);
      await panel.getByLabel("Kapasite").fill(String(spec.capacity));
      await panel.getByLabel("Kapasite").press("Enter");
      await expect(panel.getByLabel("Kapasite")).toHaveValue(String(spec.capacity));
    }

    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Yerleşim kaydedildi (3 masa, 18 kişi)" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "Masa ekle" })).toBeVisible();
    await expect(page.getByText("Henüz masa yok")).toHaveCount(0);
    // İstatistik paneli eski arayüzün adlarını kullanır ("Toplam Masa", "Toplam Kapasite").
    const summary = page.getByRole("region", { name: "İstatistikler" }).locator("dl");
    await expect(summary.getByText("Toplam Masa", { exact: true }).locator("xpath=following-sibling::dd")).toHaveText("3");
    await expect(summary.getByText("Toplam Kapasite", { exact: true }).locator("xpath=following-sibling::dd")).toHaveText("18");

    // Etkinlik sayfasında da kalıcı masalar listelenir.
    await page.goto(`/events/${eventId}`);
    await expect(page.getByRole("heading", { name: "Masalar" })).toBeVisible();
    for (const spec of specs) await expect(page.getByText(`${spec.capacity} kişilik`, { exact: true })).toBeVisible();
    await expect(page.getByText("Toplam kapasite").locator("xpath=following-sibling::dd")).toHaveText("18");

    await page.getByRole("button", { name: "Yayınla" }).click();
    await expect(page.getByText("Yayında", { exact: true })).toBeVisible();
  });
});

test.describe("Rezervasyon", () => {
  const first = "Ayşe Yılmaz";
  const second = "Mehmet Kaya";

  test("ikinci aktif rezervasyon ve kapasite aşımı reddedilir; iptal sonrası masa yeniden alınır", async ({ page, browser }) => {
    // Bayat formu önceden açan ikinci bir sekme: aynı masayı hâlâ boş görür.
    const staleContext = await browser.newContext({ storageState: await page.context().storageState() });
    const stale = await staleContext.newPage();
    await stale.goto(`/reservations/${eventId}/new`);
    await expect(stale.getByRole("button", { name: "Rezervasyonu oluştur" })).toBeVisible();

    await page.goto(`/reservations/${eventId}/new`);
    await expect(page.getByText("3 / 3 masa boş")).toBeVisible();
    await fillReservation(page, { table: "T1", guests: 3, name: first, phone: "5321110001" });
    await page.waitForURL(new RegExp(`/reservations/${eventId}/[0-9a-f-]{36}$`));
    const firstUrl = page.url();
    await expect(page.getByRole("heading", { name: first, level: 1 })).toBeVisible();
    await expect(page.locator("dd", { hasText: "T1 (4 kişilik)" })).toBeVisible();

    // İkinci aktif rezervasyon: bayat formdan aynı masa.
    await fillReservation(stale, { table: "T1", guests: 2, name: second });
    await expect(stale.getByRole("alert").filter({ hasText: "Bu masa için aktif bir rezervasyon var" })).toBeVisible();
    await expect(stale).toHaveURL(/\/reservations\/[0-9a-f-]{36}\/new$/);
    expect(await reservationCount(EVENT_NAME)).toBe(1);

    // Kapasite aşımı: tarayıcı doğrulaması engeller.
    await page.goto(`/reservations/${eventId}/new`);
    await expect(page.getByText("2 / 3 masa boş")).toBeVisible();
    await fillReservation(page, { table: "T2", guests: 9, name: "Kapasite Aşan" });
    const guests = page.getByLabel("Kişi sayısı");
    expect(await guests.evaluate((el: HTMLInputElement) => el.validity.rangeOverflow)).toBe(true);
    await expect(page).toHaveURL(/\/new$/);
    expect(await reservationCount(EVENT_NAME)).toBe(1);

    // Doğrulamayı atlayan bir istemciye karşı sunucu da reddeder.
    await guests.evaluate((el: HTMLInputElement) => el.removeAttribute("max"));
    await page.getByRole("button", { name: "Rezervasyonu oluştur" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "masa kapasitesini (6) aşıyor" })).toBeVisible();
    expect(await reservationCount(EVENT_NAME)).toBe(1);

    // İptal ve yeniden rezervasyon.
    await page.goto(firstUrl);
    await page.getByRole("button", { name: "İptal et" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "İptal et" }).click();
    await expect(page.getByText("İptal edildi", { exact: true })).toBeVisible();

    await page.goto(`/reservations/${eventId}/new`);
    await expect(page.getByText("3 / 3 masa boş")).toBeVisible();
    await fillReservation(page, { table: "T1", guests: 2, name: second, phone: "5321110002" });
    await page.waitForURL(new RegExp(`/reservations/${eventId}/[0-9a-f-]{36}$`));
    await expect(page.getByRole("heading", { name: second, level: 1 })).toBeVisible();

    // Check-in senaryosu için T2'ye bir rezervasyon daha.
    await page.goto(`/reservations/${eventId}/new`);
    await fillReservation(page, { table: "T2", guests: 4, name: "Zeynep Demir", phone: "5321110003" });
    await page.waitForURL(new RegExp(`/reservations/${eventId}/[0-9a-f-]{36}$`));
    await staleContext.close();
  });
});

test.describe("Check-in", () => {
  const stat = (page: Page, label: string) =>
    page
      .getByRole("region", { name: "İstatistikler" })
      .locator("div.rounded-lg", { has: page.getByText(label, { exact: true }) })
      .locator("p")
      .nth(1);

  test("manuel giriş, tekrarında zaten giriş yaptı, QR ile giriş, walk-in ve istatistikler", async ({ page }) => {
    await page.goto(`/check-in/${eventId}`);
    await expect(stat(page, "Beklenen")).toHaveText("2");
    await expect(stat(page, "Giriş yaptı")).toHaveText("0");

    // Konsol sekmelidir (Tarama/Ara/Geçmiş/Walk-in); gizli sekmedeki alanlar kullanılamaz.
    const tab = (name: string) => page.getByRole("tablist", { name: "Check-in bölümleri" }).getByRole("tab", { name, exact: true });

    // Manuel arama ve giriş.
    await tab("Ara").click();
    await page.getByRole("searchbox", { name: "Misafir ara" }).fill("Mehmet");
    const row = page.getByRole("listitem").filter({ hasText: "Mehmet Kaya" });
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Masa T1" })).toBeVisible();
    await expect(stat(page, "Giriş yaptı")).toHaveText("1");
    await expect(row.getByText("Giriş yaptı", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Giriş yap" })).toHaveCount(0);

    // Aynı rezervasyonu QR ile tekrar okutmak hata değil, uyarıdır.
    const mehmetToken = await qrTokenFor("Mehmet Kaya");
    await tab("Tarama").click();
    await page.getByRole("textbox", { name: "QR kod" }).fill(mehmetToken);
    await page.getByRole("form", { name: "QR kod ile giriş" }).getByRole("button", { name: "Giriş yap" }).click();
    await expect(page.getByText("Bu misafir zaten giriş yaptı")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Giriş yapılamadı" })).toHaveCount(0);
    await expect(stat(page, "Giriş yaptı")).toHaveText("1");

    // QR metni yoluyla ilk giriş.
    const zeynepToken = await qrTokenFor("Zeynep Demir");
    await page.getByRole("textbox", { name: "QR kod" }).fill(zeynepToken);
    await page.getByRole("textbox", { name: "QR kod" }).press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Giriş yapıldı" })).toContainText("Zeynep Demir");
    await expect(stat(page, "Giriş yaptı")).toHaveText("2");
    await expect(stat(page, "Kalan")).toHaveText("0");

    // Geçersiz QR hata gösterir.
    await page.getByRole("textbox", { name: "QR kod" }).fill("gecersiz-kod");
    await page.getByRole("textbox", { name: "QR kod" }).press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: "Giriş yapılamadı" }).filter({ hasText: "QR kod geçersiz" })).toBeVisible();

    // Walk-in.
    await tab("Walk-in").click();
    const walkIn = page.getByRole("form", { name: "Walk-in misafir kaydı" });
    await expect(walkIn.getByLabel("Masa")).toContainText("T3");
    await walkIn.getByLabel("Masa").selectOption({ index: 1 });
    await walkIn.getByLabel("Misafir adı").fill("Kapıdan Gelen");
    await walkIn.getByLabel("Kişi sayısı").fill("3");
    await walkIn.getByRole("button", { name: "Kaydet ve giriş yap" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Giriş yapıldı" })).toContainText("Kapıdan Gelen");
    await tab("Geçmiş").click();
    await expect(page.getByRole("region", { name: "Son girişler" })).toContainText("Kapıdan Gelen");
    await expect(stat(page, "Giriş yaptı")).toHaveText("3");
    await expect(stat(page, "Beklenen")).toHaveText("3");
    await expect(stat(page, "Oran")).toHaveText("%100");
  });

  test("alan planı 3B görünümü tuval çizer; konsol hatası ve CSP ihlali olmaz", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(`${page.url()} :: ${m.text()}`);
    });
    await page.goto(`/check-in/${eventId}`);
    await page.getByRole("link", { name: "Alan planı" }).click();
    await page.waitForURL(new RegExp(`/check-in/${eventId}/plan`));
    await expect(page.getByRole("heading", { name: "Alan planı", level: 1 })).toBeVisible();

    const views = page.getByRole("group", { name: "Görünüm" });
    await expect(views.getByRole("button", { name: "2B", exact: true })).toHaveAttribute("aria-pressed", "true");
    // Konsol canlı akış (EventSource) tuttuğundan "networkidle" beklenemez; 3B'nin yerel varlıkları beklenir.
    const assets = ["/fonts/Geist-Regular.ttf", "/images/merit-royal-logo.png", "/images/merit-international-logo.png"].map((asset) =>
      page.waitForResponse((r) => new URL(r.url()).pathname === asset),
    );
    await views.getByRole("button", { name: "3B", exact: true }).click();
    await expect(views.getByRole("button", { name: "3B", exact: true })).toHaveAttribute("aria-pressed", "true");
    const scene = page.getByTestId("venue-3d");
    await expect(scene.locator("canvas")).toBeVisible();
    await expect(page.getByText("3B plan yükleniyor…")).toHaveCount(0);
    // WebGL tuvali gerçekten boyutlanmıştır (boş bir yer tutucu değil).
    const size = await scene.locator("canvas").evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
    expect(size.w).toBeGreaterThan(0);
    expect(size.h).toBeGreaterThan(0);
    // Etiket yazı tipi ve logo dokuları yerelden gelir (CDN yok); hatalar fikstür ve bu dizi tarafından toplanır.
    for (const response of await Promise.all(assets)) expect(response.status(), response.url()).toBeLessThan(400);
    expect(consoleErrors, "konsol hataları").toEqual([]);
  });
});
