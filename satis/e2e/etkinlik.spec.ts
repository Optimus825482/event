import { expect, test } from "@playwright/test";
import { expectHeadingOrder } from "./sayfa-yardimcilari";
import { fakeRequests, fakeState } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";

const { gala, kapali, masa } = fakeState().events;

test("etkinlik sayfası: görsel, tarih, kapı ve konser saati, yaş sınırı, kıyafet, tanıtım", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}`);
  await expect(page.getByRole("heading", { level: 1, name: gala.name })).toBeVisible();
  for (const text of ["Kapı Açılış", "Konser Saati", "18+", "Şık", "Yılbaşı gecesine özel gala.", "Demo Sanatçı"]) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }
  const img = page.locator('main img[src^="/api/gorsel/"]').first();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expectHeadingOrder(page);
  await expectNoHorizontalOverflow(page);
});

test("Bilet Al kişi sayısını sorar ve masa seçimine götürür", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}#bilet-al`);
  const group = page.getByRole("group", { name: "Kaç kişilik bilet alacaksınız?" });
  await expect(group.getByRole("radio")).toHaveCount(Math.min(12, gala.sale.maxSeatsPerOrder));
  await expect(group.getByRole("radio", { name: "2 Kişi", exact: true })).toBeChecked();
  await group.getByText("4 Kişi", { exact: true }).click();
  await page.getByRole("button", { name: "Masa Seçimine Geç →" }).click();
  await expect(page).toHaveURL(`/etkinlik/${gala.id}?kisi=4#masa-secimi`);
  await expect(page.locator("section#masa-secimi").getByRole("heading", { level: 2, name: "Masa Seçimi" })).toBeInViewport();
  await expect(page.getByRole("radio", { name: "4 Kişi", exact: true })).toBeChecked();
});

test("kişi sayısı adımı JavaScript kapalıyken de çalışır", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto(`/etkinlik/${gala.id}`);
  await page.getByText("3 Kişi", { exact: true }).click();
  await page.getByRole("button", { name: "Masa Seçimine Geç →" }).click();
  await expect(page).toHaveURL(`/etkinlik/${gala.id}?kisi=3#masa-secimi`);
  await context.close();
});

test.describe("kisi parametresi", () => {
  for (const raw of ["99", "0", "abc", "2.5", ""]) {
    test(`geçersiz değer (${raw || "boş"}) sayfayı bozmaz`, async ({ page }) => {
      expect((await page.goto(`/etkinlik/${gala.id}?kisi=${raw}`))!.status()).toBe(200);
      await expect(page.getByRole("radio", { name: "2 Kişi", exact: true })).toBeChecked();
      await expect(page.locator("section#masa-secimi")).toBeVisible();
    });
  }
});

test("masa seçimi kapsayıcısı kisi ile açıldığında planı çizer", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}?kisi=2#masa-secimi`);
  await expect(page.locator("section#masa-secimi").getByText(/A1/).first()).toBeVisible();
  await expect(
    page.getByText("Sandalye bazlı satış: salondan masanızı ve numaralı sandalyelerinizi seçersiniz."),
  ).toBeVisible();
});

test("masa bazlı etkinlikte açıklama masa bazlıdır", async ({ page }) => {
  await page.goto(`/etkinlik/${masa.id}?kisi=2`);
  await expect(page.getByText("Masa bazlı satış: masalar bütün olarak satılır.")).toBeVisible();
});

test("satışı kapalı etkinlikte durum yazılır, kişi sayısı adımı yoktur, plan bölümü durur", async ({ page }) => {
  await page.goto(`/etkinlik/${kapali.id}`);
  await expect(page.getByText("Satış kapalı")).toBeVisible();
  await expect(page.getByRole("group", { name: "Kaç kişilik bilet alacaksınız?" })).toHaveCount(0);
  await expect(page.locator("section#masa-secimi")).toBeVisible();
});

test("bilinmeyen etkinlik 404 verir ve çekirdeğe doluluk isteği gitmez", async ({ page }) => {
  const before = (await fakeRequests()).filter((r) => r.path.endsWith("/availability")).length;
  const res = await page.goto(`/etkinlik/${crypto.randomUUID()}`);
  expect(res!.status()).toBe(404);
  expect((await fakeRequests()).filter((r) => r.path.endsWith("/availability")).length).toBe(before);
});
