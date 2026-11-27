import { expect, test } from "@playwright/test";
import { expectHeadingOrder } from "./sayfa-yardimcilari";
import { fakeRequests, fakeState } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";
import { formatEventDay } from "../src/lib/time-zone";

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

const eyebrow = (e: typeof gala) => `${e.artistName ?? e.name} · ${formatEventDay(e.startsAt)}`.toLocaleUpperCase("tr-TR");

test("Bilet Al penceresi kişi sayısını sorar ve masa seçimine götürür", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}#bilet-al`);
  const dialog = page.getByRole("dialog", { name: "Kişi sayısı" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByText(eyebrow(gala), { exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 2, name: "Kişi sayısı" })).toBeVisible();
  await expect(
    dialog.getByText("Kişi sayısına uygun masalar gösterilir. Müsait localar bütün olarak rezerve edilir."),
  ).toBeVisible();
  await expect(page.getByText("Kaç kişisiniz?")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Masaları göster" })).toHaveCount(0);
  const select = dialog.getByRole("combobox", { name: "Kişi sayısı" });
  await expect(select).toBeFocused();
  await expect(select.locator("option")).toHaveCount(Math.min(12, gala.sale.maxSeatsPerOrder));
  await expect(select).toHaveValue("2");
  await expect(select.locator("option:checked")).toHaveText("2 kişi");
  await select.selectOption("4");
  await dialog.getByRole("button", { name: "Masa seçimine geç →" }).click();
  await expect(page).toHaveURL(`/etkinlik/${gala.id}?kisi=4#masa-secimi`);
  await expect(page.locator("section#masa-secimi").getByRole("heading", { level: 2, name: "Masa Seçimi" })).toBeInViewport();
  await expect(page.getByRole("complementary", { name: "Bilet seçimi" }).getByLabel("Kişi sayısı")).toHaveValue("4");

  // Sayfadaki Bilet Al aynı pencereyi seçili sayıyla açar; Esc kapatır ve odak düğmeye döner.
  const trigger = page.getByRole("main").getByRole("link", { name: "Bilet Al" });
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Kişi sayısı" })).toHaveValue("4");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("pencere kipli: odak pencerede kalır, kapat düğmesi kapatır", async ({ page }) => {
  await page.goto(`/etkinlik/${gala.id}`);
  await page.getByRole("main").getByRole("link", { name: "Bilet Al" }).click();
  const dialog = page.getByRole("dialog", { name: "Kişi sayısı" });
  await expect(dialog).toBeVisible();
  // showModal: üst katmanda, sayfanın geri kalanı etkisiz (odak dışarı çıkamaz).
  expect(await dialog.evaluate((el) => el.matches(":modal"))).toBe(true);
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await dialog.getByRole("button", { name: "Pencereyi kapat" }).click();
  await expect(dialog).toBeHidden();
});

test("üst menüdeki Bilet Al etkinlik sayfasında pencereyi açar, başka sayfada etkinliklere gider", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/etkinlik/${gala.id}`);
  await page.locator('[data-nav="desktop"]').getByRole("link", { name: "Bilet Al" }).click();
  await expect(page.getByRole("dialog", { name: "Kişi sayısı" })).toBeVisible();
  await expect(page).toHaveURL(`/etkinlik/${gala.id}`);

  await page.goto("/takvim");
  await page.locator('[data-nav="desktop"]').getByRole("link", { name: "Bilet Al" }).click();
  await expect(page).toHaveURL("/etkinlikler");
});

test("kişi sayısı penceresi JavaScript kapalıyken de çalışır", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto(`/etkinlik/${gala.id}`);
  const dialog = page.locator("dialog#bilet-al");
  await expect(dialog).toBeHidden();
  await page.getByRole("main").getByRole("link", { name: "Bilet Al" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox", { name: "Kişi sayısı" }).selectOption("3");
  await dialog.getByRole("button", { name: "Masa seçimine geç →" }).click();
  await expect(page).toHaveURL(`/etkinlik/${gala.id}?kisi=3#masa-secimi`);
  await context.close();
});

test.describe("kisi parametresi", () => {
  for (const raw of ["99", "0", "abc", "2.5", ""]) {
    test(`geçersiz değer (${raw || "boş"}) sayfayı bozmaz`, async ({ page }) => {
      expect((await page.goto(`/etkinlik/${gala.id}?kisi=${raw}`))!.status()).toBe(200);
      await expect(page.locator("dialog#bilet-al").getByRole("combobox", { includeHidden: true })).toHaveValue("2");
      await expect(page.getByRole("complementary", { name: "Bilet seçimi" }).getByLabel("Kişi sayısı")).toHaveValue("2");
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

test("satışı kapalı etkinlikte durum yazılır, kişi sayısı penceresi yoktur, plan bölümü durur", async ({ page }) => {
  await page.goto(`/etkinlik/${kapali.id}#bilet-al`);
  await expect(page.getByText("Satış kapalı")).toBeVisible();
  await expect(page.locator("dialog#bilet-al")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: "Bilet Al" })).toHaveCount(0);
  await expect(page.locator("section#masa-secimi")).toBeVisible();
});

test("bilinmeyen etkinlik 404 verir ve çekirdeğe doluluk isteği gitmez", async ({ page }) => {
  const before = (await fakeRequests()).filter((r) => r.path.endsWith("/availability")).length;
  const res = await page.goto(`/etkinlik/${crypto.randomUUID()}`);
  expect(res!.status()).toBe(404);
  expect((await fakeRequests()).filter((r) => r.path.endsWith("/availability")).length).toBe(before);
});
