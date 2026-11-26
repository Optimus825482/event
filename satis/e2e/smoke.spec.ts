import { expect, test } from "@playwright/test";
import { fakeState } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";

test("ana sayfa satıştaki etkinliği durumuyla listeler ve 375 px'te taşmaz", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("article").filter({ hasText: "Yılbaşı Galası" });
  await expect(card.getByText("Satışta")).toBeVisible();
  await expect(card.getByText("Başlangıç fiyatı: 1.500,00 ₺")).toBeVisible();
  await expect(card.getByRole("link", { name: "Masa seç" })).toHaveAttribute("href", `/etkinlik/${fakeState().events.gala.id}`);
  await expect(page.getByRole("article").filter({ hasText: "Bahar Konseri" }).getByText("Satış yakında")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("yanıt başlıkları: no-referrer, CSP yalnızca kendi kökenine bağlanır", async ({ page }) => {
  const res = await page.goto("/");
  const headers = res!.headers();
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["content-security-policy"]).toContain("connect-src 'self'");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("hukuki sayfalar yer tutucu olduğunu açıkça söyler", async ({ page }) => {
  for (const path of ["/kvkk", "/mesafeli-satis"]) {
    await page.goto(path);
    await expect(page.locator('[data-placeholder="legal"]')).toContainText("Bu metin yer tutucudur");
    await expectNoHorizontalOverflow(page);
  }
});

test("altın düğmenin metni okunur: hesaplanan renkler token'lardır", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: "Masa seç" }).first();
  expect(await link.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor])).toEqual([
    "rgb(20, 27, 45)",
    "rgb(212, 175, 55)",
  ]);
});
