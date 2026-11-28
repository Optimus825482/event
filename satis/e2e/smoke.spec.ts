import { expect, test } from "@playwright/test";
import { fakeState } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";

test("ana sayfa satıştaki etkinliği durumuyla listeler ve 375 px'te taşmaz", async ({ page }) => {
  await page.goto("/");
  const gala = fakeState().events.gala;
  const card = page.getByRole("article").filter({ hasText: gala.artistName ?? gala.name });
  // Kartta fiyat satırı yok; başlangıç fiyatı üst karuseldeki slaytta yazılır.
  await expect(card.getByText(/Başlangıç/)).toHaveCount(0);
  await expect(card.getByText(`${gala.artistName ?? gala.name}`)).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "En yakın etkinlikler" })
      .getByText("Başlangıç: 1.500,00 ₺")
      .first(),
  ).toBeVisible();
  await expect(card.getByRole("link", { name: "Bilet Al" })).toHaveAttribute("href", `/etkinlik/${gala.id}#bilet-al`);
  await expect(page.getByRole("article").filter({ hasText: "Bahar Konseri" }).getByText("Satış yakında")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("üst menü ve alt bilgi: bağlantılar, içeriğe geç, 375 px'te menü açılır", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "İçeriğe geç" })).toBeFocused();
  await page.getByText("Menü", { exact: true }).click();
  const menu = page.getByRole("navigation", { name: "Ana menü" });
  for (const name of ["Ana Sayfa", "Yaklaşan Etkinlikler", "Takvim", "Biletim (PNR)", "Hakkımızda", "Bilet Al"]) {
    await expect(menu.getByRole("link", { name }).last()).toBeVisible();
  }
  await expect(page.getByRole("navigation", { name: "Keşfet" }).getByRole("link", { name: "İade Koşulları" })).toHaveAttribute(
    "href",
    "/iade",
  );
  await expect(page.getByRole("navigation", { name: "Hukuki" }).getByRole("link", { name: "KVKK" })).toHaveAttribute(
    "href",
    "/kvkk",
  );
  await expect(page.getByText("© 2026 Merit Entertainment. Tüm hakları saklıdır.")).toBeVisible();
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
  const link = page.getByRole("article").first().getByRole("link", { name: "Bilet Al" });
  expect(await link.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor])).toEqual([
    "rgb(8, 9, 13)",
    "rgb(212, 175, 55)",
  ]);
});
