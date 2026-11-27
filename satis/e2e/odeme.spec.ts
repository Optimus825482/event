import { expect, test } from "@playwright/test";
import type { Availability } from "../src/lib/core/contract";
import { openCheckout } from "./sayfa-yardimcilari";
import { fillBuyer } from "./support/checkout";
import { expireOrder, fakeRequests, fakeState, resetOrders, tableId } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";

const { gala } = fakeState().events;

test.beforeEach(async () => {
  await resetOrders();
});

test("ödeme sayfası: özet, geri sayım, DEMO ibaresi, gizlilik başlıkları", async ({ page }) => {
  await openCheckout(page, "A5");
  const res = await page.reload();
  const h = res!.headers();
  expect(h["x-robots-tag"]).toContain("noindex");
  expect(h["cache-control"]).toContain("no-store");
  expect(h["referrer-policy"]).toBe("no-referrer");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByText("Masa A5 · Standart · 1 × 1.500,00 ₺")).toBeVisible();
  await expect(page.getByText("DEMO - gerçek ödeme alınmadı")).toBeVisible();
  const first = await page.getByText(/Kalan süre \d{2}:\d{2}/).textContent();
  await page.waitForTimeout(2100);
  expect(await page.getByText(/Kalan süre \d{2}:\d{2}/).textContent()).not.toBe(first);
  await expect(page.getByLabel(/kart/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("onay kutusu işaretlenmeden ödenemez", async ({ page }) => {
  await openCheckout(page, "A6");
  await fillBuyer(page);
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page.getByText("Devam etmek için metinleri onaylamalısınız")).toBeVisible();
  await expect(page).toHaveURL(/\/odeme\//);
});

test("reddet: mesaj çıkar, sayfada kalınır; ardından öde e-bilete götürür", async ({ page }) => {
  await openCheckout(page, "P2");
  await fillBuyer(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Reddet (deneme)" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Ödeme reddedildi" })).toBeVisible();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page).toHaveURL(/\/bilet\//);
});

test("süresi dolan siparişte form kapanır", async ({ page }) => {
  await openCheckout(page, "P3");
  await expireOrder(page.url().split("/odeme/")[1]!);
  await fillBuyer(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page.getByRole("heading", { name: "Süreniz doldu" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Masayı yeniden seç" })).toHaveAttribute("href", `/etkinlik/${gala.id}`);
  await expect(page.getByRole("button", { name: "Öde" })).toHaveCount(0);
});

test("vazgeç: etkinliğe döner ve sandalyeler serbest kalır", async ({ page }) => {
  await openCheckout(page, "V1");
  await page.getByRole("button", { name: "Vazgeç" }).click();
  await expect(page).toHaveURL(new RegExp(`/etkinlik/${gala.id}`));
  await expect
    .poll(
      async () =>
        ((await (await page.request.get(`/api/durum/${gala.id}`)).json()) as Availability).tables.find(
          (t) => t.id === tableId(gala, "V1"),
        )!.free,
      { timeout: 12_000 },
    )
    .toBe(6);
});

test("geçersiz alanlarla gönderimde odak ilk geçersiz alana taşınır", async ({ page }) => {
  await openCheckout(page, "P1");
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page.getByLabel("Ad", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Ad", { exact: true })).toHaveAttribute("aria-invalid", "true");
  // Ad ile soyad dolu, e-posta boş: odak e-postaya gider.
  await page.getByLabel("Ad", { exact: true }).fill("Ayşe");
  await page.getByLabel("Soyad").fill("Kaya");
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page.getByLabel("E-posta")).toBeFocused();
  // Yalnızca onay eksikse odak onay kutusuna gider.
  await fillBuyer(page);
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page.getByRole("checkbox")).toBeFocused();
});

test("geri sayım: sr-only durum öğesi var, eşikte duyuru yapar", async ({ page }) => {
  await openCheckout(page, "V2");
  const status = page.locator('p[role="status"].sr-only');
  await expect(status).toHaveCount(1);
  await expect(status).toHaveText("");
  // 29 sn kalacak biçimde tohumla; yeniden yüklemede 30 sn eşiği hemen geçilmiş olur.
  await expireOrder(page.url().split("/odeme/")[1]!, 29_000);
  await page.reload();
  await expect(page.locator('p[role="status"].sr-only')).toHaveText("Kalan süre 30 saniye");
});

test("bozuk belirteç 404 verir ve çekirdeğe gitmez", async ({ page }) => {
  const before = (await fakeRequests()).length;
  expect((await page.goto("/odeme/bozuk"))!.status()).toBe(404);
  expect((await fakeRequests()).length).toBe(before);
});
