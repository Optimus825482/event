import { expect, test } from "@playwright/test";
import { fillBuyer, startCheckout } from "./support/checkout";
import { expireOrder, fakeRequests, fakeState, resetOrders } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";

const { gala } = fakeState().events;

test.beforeEach(async () => {
  await resetOrders();
});

test("ödeme sayfası: özet, geri sayım, DEMO ibaresi, gizlilik başlıkları", async ({ page }) => {
  await startCheckout(page, "A5");
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
  await startCheckout(page, "A6");
  await fillBuyer(page);
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page.getByText("Devam etmek için metinleri onaylamalısınız")).toBeVisible();
  await expect(page).toHaveURL(/\/odeme\//);
});

test("reddet: mesaj çıkar, sayfada kalınır; ardından öde e-bilete götürür", async ({ page }) => {
  await startCheckout(page, "P2");
  await fillBuyer(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Reddet (deneme)" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Ödeme reddedildi" })).toBeVisible();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page).toHaveURL(/\/bilet\//);
});

test("süresi dolan siparişte form kapanır", async ({ page }) => {
  await startCheckout(page, "P3");
  await expireOrder(page.url().split("/odeme/")[1]!);
  await fillBuyer(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page.getByRole("heading", { name: "Süreniz doldu" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Masayı yeniden seç" })).toHaveAttribute("href", `/etkinlik/${gala.id}`);
  await expect(page.getByRole("button", { name: "Öde" })).toHaveCount(0);
});

test("vazgeç: etkinliğe döner ve sandalyeler serbest kalır", async ({ page }) => {
  await startCheckout(page, "V1");
  await page.getByRole("button", { name: "Vazgeç" }).click();
  await expect(page).toHaveURL(`/etkinlik/${gala.id}`);
  await expect(page.getByRole("button", { name: "Masa V1, VIP, boş sandalye 6/6" })).toBeVisible({ timeout: 12_000 });
});

test("bozuk belirteç 404 verir ve çekirdeğe gitmez", async ({ page }) => {
  const before = (await fakeRequests()).length;
  expect((await page.goto("/odeme/bozuk"))!.status()).toBe(404);
  expect((await fakeRequests()).length).toBe(before);
});
