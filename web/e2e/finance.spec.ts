import type { Page } from "@playwright/test";

import { withDb } from "./support/db";
import { expect, test } from "./support/fixtures";
import { addTablesAndSave, createEvent } from "./support/ui";

// Senaryo tek etkinliğin finans akışını sırayla yürütür: her adım bir öncekinin sonucuna dayanır.
test.describe.configure({ mode: "serial" });

let eventId = "";

// Bildirim (toast) kabuğu `aria-live` bölgesidir; `role="status"` taşımaz.
const toast = (page: Page, text: string) => page.locator('[aria-live="polite"]').getByText(text, { exact: true });

const card = (page: Page, label: string) =>
  page.getByRole("region", { name: "Özet" }).locator("div", { has: page.getByText(label, { exact: true }) }).last();

async function priceRow(eventId: string) {
  return withDb((pool) =>
    pool.query<{ final_price: string; recommended_price: string }>(
      "select final_price, recommended_price from event_seat_prices where event_id = $1 and category = 'standard'",
      [eventId],
    ),
  );
}

test.describe("Finans", () => {
  test("bölüm çubuğundan Finans açılır", async ({ page }) => {
    eventId = await createEvent(page, "E2E Finans");
    // Şema varsayılanı: pending + standart → 8 satılabilir sandalye.
    await addTablesAndSave(page, eventId, [
      { label: "T1", capacity: 4 },
      { label: "T2", capacity: 4 },
    ]);
    await page.goto(`/events/${eventId}`);
    await page.getByRole("link", { name: "Finans" }).click();
    await page.waitForURL(`**/events/${eventId}/finance`);
    await expect(page.getByRole("heading", { name: "Finans", level: 1 })).toBeVisible();
  });

  test("kalemler ve özet", async ({ page }) => {
    await page.goto(`/events/${eventId}/finance`);

    await page.getByRole("button", { name: "Kalem ekle" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Yön").click();
    await page.getByRole("option", { name: "Gider" }).click();
    await dialog.getByLabel("Kategori").click();
    await page.getByRole("option", { name: "Sanatçı ücreti" }).click();
    await dialog.getByLabel("Kalem adı").fill("Sahne sanatçısı");
    await dialog.getByLabel(/^Tahmini tutar/).fill("100000");
    await dialog.getByRole("button", { name: "Kaydet" }).click();
    await expect(toast(page, "Kalem eklendi")).toBeVisible();

    await page.getByRole("button", { name: "Kalem ekle" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Yön").click();
    await page.getByRole("option", { name: "Gelir" }).click();
    await dialog.getByLabel("Kategori").click();
    await page.getByRole("option", { name: "Sponsorluk" }).click();
    await dialog.getByLabel("Kalem adı").fill("Ana sponsor");
    await dialog.getByLabel(/^Tahmini tutar/).fill("20000");
    await dialog.getByRole("button", { name: "Kaydet" }).click();
    await expect(toast(page, "Kalem eklendi")).toBeVisible();

    await expect(card(page, "Tahmini gider")).toContainText("100.000,00 TRY");
    await expect(card(page, "Tahmini diğer gelir")).toContainText("20.000,00 TRY");

    await page.getByRole("button", { name: "Sahne sanatçısı kalemini düzenle" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Gerçekleşen tutar/).fill("105000,50");
    await dialog.getByRole("button", { name: "Kaydet" }).click();
    await expect(toast(page, "Kalem güncellendi")).toBeVisible();
    await expect(card(page, "Gerçekleşen gider")).toContainText("105.000,50 TRY");
  });

  test("tavsiye hesaplanır ama kesin fiyatı doldurmaz", async ({ page }) => {
    await page.goto(`/events/${eventId}/finance`);
    await page.getByLabel("Hedef kâr", { exact: true }).fill("20000");
    await page.getByRole("button", { name: "Planı kaydet" }).click();
    await expect(toast(page, "Plan kaydedildi")).toBeVisible();
    // Toast, `router.refresh()` bitmeden önce görünür; form kayıtlı değerle yeniden kurulunca (20000,00) veri tazedir.
    await expect(page.getByLabel("Hedef kâr", { exact: true })).toHaveValue("20000,00");

    await page.getByRole("button", { name: "Tavsiye fiyatı hesapla" }).click();
    await expect(toast(page, "Tavsiye hesaplandı")).toBeVisible();

    const pricing = page.getByRole("region", { name: "Fiyatlandırma" });
    await expect(pricing.getByRole("row").filter({ hasText: "Standart" })).toContainText("12.500,00");
    await expect(pricing).toContainText("Dağıtılacak tutar: 100.000,00");
    await expect(page.getByLabel("Standart kesin fiyat")).toHaveValue("");
    await expect(page.getByText("Kesin fiyat gerekli")).toBeVisible();
  });

  test("kesin fiyat kaydedilir ve yenilemede kalır", async ({ page }) => {
    await page.goto(`/events/${eventId}/finance`);
    await page.getByLabel("Standart kesin fiyat").fill("13000");
    await page.getByRole("button", { name: "Fiyatları kaydet" }).click();
    await expect(toast(page, "Fiyatlar kaydedildi")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Standart kesin fiyat")).toHaveValue("13000,00");
    await expect(page.getByText("Kesin fiyat gerekli")).toHaveCount(0);

    const rows = (await priceRow(eventId)).rows;
    expect(rows[0]?.final_price).toBe("13000.00");
    expect(rows[0]?.recommended_price).toBe("12500.00");
  });

  test("geçersiz tutar kaydedilmez", async ({ page }) => {
    await page.goto(`/events/${eventId}/finance`);
    await page.getByLabel("Standart kesin fiyat").fill("13.000,00");
    await page.getByRole("button", { name: "Fiyatları kaydet" }).click();
    await expect(page.getByText("Tutarı binlik ayırıcı olmadan yazın")).toBeVisible();

    const rows = (await priceRow(eventId)).rows;
    expect(rows[0]?.final_price).toBe("13000.00");
  });
});
