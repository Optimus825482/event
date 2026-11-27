import { expect, test } from "@playwright/test";
import { expectHeadingOrder } from "./sayfa-yardimcilari";
import { expectNoHorizontalOverflow } from "./support/layout";

for (const [path, h1] of [
  ["/hakkimizda", "Merit Entertainment"],
  ["/sss", "Sık Sorulan Sorular"],
  ["/iade", "İptal & İade Koşulları"],
  ["/kvkk", "KVKK Aydınlatma Metni"],
  ["/mesafeli-satis", "Mesafeli Satış Sözleşmesi"],
] as const) {
  test(`${path}: tek başlık, düzgün başlık sırası, 375 px'te taşma yok`, async ({ page }) => {
    expect((await page.goto(path))!.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: h1 })).toBeVisible();
    await expectHeadingOrder(page);
    await expectNoHorizontalOverflow(page);
  });
}

test("SSS klavyeyle açılır ve iade sayfasına bağlanır", async ({ page }) => {
  await page.goto("/sss");
  const second = page.locator("main details").nth(1);
  await second.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(second).toHaveAttribute("open", "");
  await expect(second.getByText(/numaralı sandalyelerinizi/)).toBeVisible();
  await page.locator("main details").filter({ hasText: "İptal ve iade koşulları nelerdir?" }).locator("summary").click();
  await expect(page.locator("main").getByRole("link", { name: "İade Koşulları" })).toHaveAttribute("href", "/iade");
});

test("iade sayfası taslak olduğunu açıkça söyler; hukuki sayfalar yer tutucudur", async ({ page }) => {
  await page.goto("/iade");
  await expect(page.locator('[data-placeholder="policy"]')).toContainText("Bu metin taslaktır");
  await expect(page.locator("main").getByRole("link", { name: /KVKK/ })).toHaveAttribute("href", "/kvkk");
  for (const path of ["/kvkk", "/mesafeli-satis"]) {
    await page.goto(path);
    await expect(page.locator('[data-placeholder="legal"]')).toContainText("Bu metin yer tutucudur");
  }
});
