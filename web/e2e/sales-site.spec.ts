import { randomBytes } from "node:crypto";
import { createManager, openSession } from "./support/departments";
import { seedPaidDemoOrder } from "./support/faz6";
import { expect, test } from "./support/fixtures";
import { pngFile, textFile } from "./support/ss-p1";
import { addTablesAndSave, createEvent, publishEvent } from "./support/ui";

const EVENT_NAME = "E2E Satış Sitesi";
const FNB_PASS = `Fnb1-${randomBytes(12).toString("base64url")}`;

test.describe("Satış Sitesi yönetimi", () => {
  test.describe.configure({ mode: "serial" });

  let eventId = "";

  test("menü: Entertainment grubunda Satış Sitesi bağlantısı liste sayfasını açar", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Ana menü" });
    await nav.getByRole("link", { name: "Satış Sitesi" }).click();
    await page.waitForURL(/\/sales-site$/);
    await expect(page.getByRole("heading", { name: "Satış Sitesi", level: 1 })).toBeVisible();
  });

  test("liste: yeni etkinlik 'Sitede değil' ve görselleri eksik", async ({ page }) => {
    eventId = await createEvent(page, EVENT_NAME);
    await page.goto("/sales-site");
    await expect(page.getByText("DEMO AKTİF")).toHaveCount(0);
    const row = page.getByRole("row").filter({ hasText: EVENT_NAME });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Sitede değil");
    await expect(row).toContainText("Eksik: Kapak, Hero");
  });

  test("içerik kaydedilir ve yenilemede korunur", async ({ page }) => {
    await page.goto("/sales-site");
    await page.getByRole("link", { name: EVENT_NAME }).click();
    await page.waitForURL(new RegExp(`/sales-site/${eventId}$`));

    await page.getByLabel("Tanıtım metni").fill("Yılbaşı gecesine özel gala.");
    await page.getByLabel("Kapı saati").fill("2030-06-15T18:30");
    await page.getByLabel("Yaş sınırı").fill("18+");
    await page.getByLabel("Kıyafet").fill("Şık");
    await page.getByLabel("Sahne görüşü").selectOption("diamond");
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Site içeriği kaydedildi" })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Tanıtım metni")).toHaveValue("Yılbaşı gecesine özel gala.");
    await expect(page.getByLabel("Kapı saati")).toHaveValue("2030-06-15T18:30");
    await expect(page.getByLabel("Yaş sınırı")).toHaveValue("18+");
    await expect(page.getByLabel("Kıyafet")).toHaveValue("Şık");
    await expect(page.getByLabel("Sahne görüşü")).toHaveValue("diamond");
  });

  test("kapak ve hero yüklenince önizleme görünür, liste 'Tam' der", async ({ page }) => {
    await page.goto(`/sales-site/${eventId}`);
    await page.getByLabel("Kapak görseli yükle").setInputFiles(await pngFile("kapak.png"));
    const coverImg = page.locator('img[alt="Kapak görseli"]');
    await expect(coverImg).toBeVisible();
    const coverSrc = await coverImg.getAttribute("src");
    expect(coverSrc).toBeTruthy();
    const coverRes = await page.request.get(coverSrc!);
    expect(coverRes.status()).toBe(200);
    expect(coverRes.headers()["content-type"]).toBe("image/webp");
    await expect.poll(() => coverImg.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    await page.getByLabel("Hero görseli yükle").setInputFiles(await pngFile("hero.png"));
    const heroImg = page.locator('img[alt="Hero görseli"]');
    await expect(heroImg).toBeVisible();
    await expect.poll(() => heroImg.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    await page.goto("/sales-site");
    const row = page.getByRole("row").filter({ hasText: EVENT_NAME });
    await expect(row).toContainText("Tam");
  });

  test("görüntü olmayan dosya reddedilir", async ({ page }) => {
    await page.goto(`/sales-site/${eventId}`);
    await page.getByLabel("Kapak görseli yükle").setInputFiles(textFile());
    await expect(page.getByRole("alert").filter({ hasText: "Yalnızca JPG, PNG veya WebP görüntüleri yüklenebilir" })).toBeVisible();
  });

  test("Siparişler sekmesi mevcut sipariş ekranını gösterir", async ({ page }) => {
    await addTablesAndSave(page, eventId, [{ label: "A1", capacity: 8 }]);
    await publishEvent(page, eventId);
    await seedPaidDemoOrder({
      eventName: EVENT_NAME,
      tableLabel: "A1",
      seats: 5,
      pnr: "E2ESS234",
      buyer: { firstName: "Ali", lastName: "Veli", email: "ali@example.com" },
    });

    await page.goto(`/sales-site/${eventId}?tab=siparisler`);
    await expect(page.getByRole("link", { name: "E2ES-S234" })).toBeVisible();
    await expect(page.getByText("5/8")).toBeVisible();

    await page.goto("/sales-site");
    const row = page.getByRole("row").filter({ hasText: EVENT_NAME });
    await expect(row).toContainText("5");
  });

  test("F&B yöneticisi adresi yazınca rakamları ve Siparişler sekmesini göremez", async ({ page, browser }) => {
    const fnbDept = { username: "e2e-fnb-ss", fullName: "F&B Müdürü", label: "Food & Beverage" };
    await createManager(page, fnbDept, FNB_PASS);

    const { context, page: fnbPage } = await openSession(browser, fnbDept, FNB_PASS);
    try {
      await fnbPage.goto("/sales-site");
      await expect(fnbPage.getByText("Gerçek satış")).toHaveCount(0);
      await expect(fnbPage.getByText("Demo satış")).toHaveCount(0);
      const row = fnbPage.getByRole("row").filter({ hasText: EVENT_NAME });
      await expect(row).toContainText("—");

      await fnbPage.goto(`/sales-site/${eventId}?tab=siparisler`);
      await expect(fnbPage.getByRole("link", { name: "Siparişler" })).toHaveCount(0);
      await expect(fnbPage.getByLabel("Tanıtım metni")).toBeDisabled();
    } finally {
      await context.close();
    }
  });
});
