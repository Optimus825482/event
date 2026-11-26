import type { Page } from "@playwright/test";

import { expect, test, EMPTY_STATE } from "./support/fixtures";
import { clearFindTableLimits, expireEvent, seedDoorEvent, type DoorSeed } from "./support/faz8";

// "Masamı bul": oturumsuz, herkese açık sayfa (geliştirme sunucusu). Hız sınırı kovaları her testten önce temizlenir.
// Not: `cache-control: no-store` ve gerçek 404 başlıkları üretim kipine özgüdür (bkz. rapor); burada geliştirme sunucusunda denetlenir.
test.use({ storageState: EMPTY_STATE });
test.describe.configure({ mode: "serial" });

const STAMP = Date.now().toString(36);
const PNR_HINT = /^[A-Z0-9]{8}$/;
let seed: DoorSeed;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  seed = await seedDoorEvent(`Masam ${STAMP}`);
  expect(seed.pnr).toMatch(PNR_HINT);
});

test.beforeEach(async () => {
  await clearFindTableLimits();
});

async function fill(page: Page, code: string, lastName: string): Promise<void> {
  await page.getByLabel("Rezervasyon kodu ya da PNR").fill(code);
  await page.getByLabel("Soyad", { exact: true }).fill(lastName);
}

async function submit(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Masamı göster" }).click();
}

const RESULT_URL = /\/masam\/(?!limited)[^/?#]+$/;

test("doğru PNR ve soyadla masa sayfası açılır; kişisel veri sızmaz", async ({ page }) => {
  await page.goto("/masam");
  expect(page.url()).not.toContain("/login");
  await expect(page.getByRole("heading", { name: "Masamı bul" })).toBeVisible();
  await fill(page, seed.pnr, "yilmaz");
  await submit(page);
  await page.waitForURL(RESULT_URL);

  const url = page.url();
  expect(url.toLowerCase()).not.toContain(seed.pnr.toLowerCase());
  expect(url.toLowerCase()).not.toContain("yilmaz");
  expect(url.toLowerCase()).not.toContain("yılmaz");

  await expect(page.getByRole("heading", { name: seed.eventName, level: 1 })).toBeVisible();
  const html = await page.content();
  for (const label of ["B1", "B2"]) expect(html).toContain(label);
  const forbidden = [
    seed.buyerFirstName,
    seed.buyerEmail,
    seed.pnr,
    `${seed.pnr.slice(0, 4)}-${seed.pnr.slice(4)}`,
    "Zeynep",
    seed.reservation.bookingCode,
  ];
  for (const text of forbidden) expect(html, `sayfada ${text} olmamalı`).not.toContain(text);

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('[aria-label$="(3B)"]')).toHaveCount(0);

  // Belge yanıtı: önbelleğe alınmaz (geliştirme sunucusu `no-store` yazar; üretim kipinde de aynıdır).
  const document = await page.goto(url);
  expect(document?.headers()["cache-control"] ?? "").toContain("no-store");
});

test("yanlış soyad ve bilinmeyen kod aynı hatayı verir", async ({ page }) => {
  await page.goto("/masam");
  await fill(page, seed.pnr, "Kaya");
  await submit(page);
  await expect(page.getByText("Kod ya da soyad hatalı")).toBeVisible();
  await expect(page).toHaveURL(/\/masam$/);

  await fill(page, "ZZZZZZZZ", "Yılmaz");
  await submit(page);
  await expect(page.getByText("Kod ya da soyad hatalı")).toBeVisible();
  await expect(page).toHaveURL(/\/masam$/);
});

test("rezervasyon kodu ve soyadla yalnızca masa etiketi görünür", async ({ page }) => {
  await page.goto("/masam");
  await fill(page, seed.reservation.bookingCode, seed.reservation.lastName);
  await submit(page);
  await page.waitForURL(RESULT_URL);
  await expect(page.getByText(`Masanız: ${seed.reservation.tableLabel}`)).toBeVisible();
  expect(await page.content()).not.toContain("Zeynep");
});

test("hız sınırı: 6. denemede 429 ve retry-after, sonuç sayfasına ulaşılmaz", async ({ page }) => {
  await page.goto("/masam");
  for (let i = 0; i < 5; i += 1) {
    await fill(page, seed.pnr, `Hatali${i}`);
    await submit(page);
    await expect(page.getByText("Kod ya da soyad hatalı")).toBeVisible();
    // Hata iletisi bir sonraki denemeden önce kaybolur (yeni yanıt beklenir).
    if (i < 4) await page.getByLabel("Soyad", { exact: true }).fill("");
  }
  await fill(page, seed.pnr, "Yılmaz");
  const limited = page.waitForResponse((r) => new URL(r.url()).pathname === "/masam/limited");
  await submit(page);
  const response = await limited;
  expect(response.status()).toBe(429);
  expect(Number(response.headers()["retry-after"])).toBeGreaterThan(0);
  expect(page.url()).not.toMatch(RESULT_URL);
});

test("düşük donanımda 3B düğmesi çıkmaz, 2B plan görünür", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "deviceMemory", { get: () => 1, configurable: true });
  });
  await page.goto("/masam");
  await fill(page, seed.pnr, "Yılmaz");
  await submit(page);
  await page.waitForURL(RESULT_URL);
  await expect(page.getByRole("heading", { name: seed.eventName, level: 1 })).toBeVisible();
  await expect(page.locator('[aria-label="Salon planı"]').first()).toBeVisible();
  await expect(page.getByRole("button", { name: "3B göster" })).toHaveCount(0);
});

test("375 px genişlikte form ve sonuç sayfası yatay taşmaz", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.goto("/masam");
  await expect(page.getByRole("button", { name: "Masamı göster" })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await fill(page, seed.pnr, "Yılmaz");
  await submit(page);
  await page.waitForURL(RESULT_URL);
  await expect(page.getByRole("heading", { name: seed.eventName, level: 1 })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test("etkinlik süresi dolunca bağlantı 404 verir ve arama başarısız olur", async ({ page }) => {
  await page.goto("/masam");
  await fill(page, seed.pnr, "Yılmaz");
  await submit(page);
  await page.waitForURL(RESULT_URL);
  const url = page.url();

  await expireEvent(seed.eventId);
  const gone = await page.goto(url);
  // Geliştirme sunucusunda 404 sayfası akış sırasında 200 ile gelebilir; üretimde gerçek 404 (bkz. rapor).
  await expect(page.getByRole("heading", { name: seed.eventName })).toHaveCount(0);
  expect([200, 404]).toContain(gone?.status());
  await expect(page.getByText(/404|bulunamadı/i).first()).toBeVisible();

  await clearFindTableLimits();
  await page.goto("/masam");
  await fill(page, seed.pnr, "Yılmaz");
  await submit(page);
  await expect(page.getByText("Kod ya da soyad hatalı")).toBeVisible();
  await expect(page).toHaveURL(/\/masam$/);
});
