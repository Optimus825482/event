import { expect, type Page } from "@playwright/test";
import { fakeState } from "./fake";

/** Etkinlik sayfasından masayı seçip (isteğe bağlı adetle) "Devam et"e basar; ödeme sayfasında biter. */
export async function startCheckout(page: Page, label: string, options: { quantity?: number } = {}): Promise<void> {
  await page.goto(`/etkinlik/${fakeState().events.gala.id}`);
  await page.getByRole("button", { name: new RegExp(`Masa ${label},`) }).click();
  const panel = page.getByRole("region", { name: "Seçiminiz" });
  for (let i = 1; i < (options.quantity ?? 1); i++) await panel.getByRole("button", { name: "Adedi artır" }).click();
  await panel.getByRole("button", { name: "Devam et" }).click();
  await expect(page).toHaveURL(/\/odeme\//);
  await expect(page.getByRole("button", { name: "Öde" })).toBeVisible();
}

export async function fillBuyer(page: Page, buyer: { lastName?: string } = {}): Promise<void> {
  await page.getByLabel("Ad", { exact: true }).fill("Ayşe");
  await page.getByLabel("Soyad").fill(buyer.lastName ?? "Kaya");
  await page.getByLabel("E-posta").fill("ayse@example.com");
}
