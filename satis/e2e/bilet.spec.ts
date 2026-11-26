import { expect, test, type Page } from "@playwright/test";
import { fillBuyer, startCheckout } from "./support/checkout";
import { fakeState, resetOrders } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";

test.beforeEach(async () => {
  await resetOrders();
});

async function pay(page: Page, label: string, lastName: string, quantity = 1): Promise<void> {
  await startCheckout(page, label, { quantity });
  await fillBuyer(page, { lastName });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page).toHaveURL(/\/bilet\//);
}

/** Öder ve e-bilet sayfasındaki "XXXX-XXXX" PNR'yi okur. */
async function payAndReadPnr(page: Page, label: string, lastName: string): Promise<string> {
  await pay(page, label, lastName);
  const text = (await page.getByText(/PNR [2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}/).textContent()) ?? "";
  return text.replace("PNR ", "").trim();
}

test("ödeme sonrası e-bilet: PNR, kişi başı QR, masa, DEMO ibaresi, gizlilik başlıkları", async ({ page }) => {
  await pay(page, "V2", "Kaya", 2);
  await expect(page.getByText(/PNR [2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}/)).toBeVisible();
  await expect(page.getByText("DEMO - gerçek ödeme alınmadı")).toBeVisible();
  await expect(page.getByRole("img", { name: /Bilet \d QR kodu/ })).toHaveCount(2);
  await expect(page.getByText("Masa V2")).toHaveCount(2);
  const h = (await page.reload())!.headers();
  expect(h["x-robots-tag"]).toContain("noindex");
  expect(h["cache-control"]).toContain("no-store");
  await expect(page.getByText("ayse@example.com")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("bütün satılan loca alınır ve bilet sayısı sandalye sayısıdır", async ({ page }) => {
  await page.goto(`/etkinlik/${fakeState().events.gala.id}`);
  await page.getByRole("button", { name: /Loca L1,/ }).click();
  const panel = page.getByRole("region", { name: "Seçiminiz" });
  await expect(panel.getByText("6 kişi")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Adedi artır" })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Adedi azalt" })).toBeDisabled();
  await panel.getByRole("button", { name: "Devam et" }).click();
  await expect(page).toHaveURL(/\/odeme\//);
  await fillBuyer(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page).toHaveURL(/\/bilet\//);
  await expect(page.getByRole("img", { name: /Bilet \d QR kodu/ })).toHaveCount(6);
});

test("biletimi bul: PNR + soyad e-bilete götürür, PNR adrese yazılmaz", async ({ page }) => {
  const pnr = await payAndReadPnr(page, "A4", "Demir");
  await page.goto("/biletimi-bul");
  await page.getByLabel("PNR").fill(pnr);
  await page.getByLabel("Soyad").fill("demir");
  await page.getByRole("button", { name: "Biletimi bul" }).click();
  await expect(page).toHaveURL(/\/bilet\//);
  expect(page.url()).not.toContain(pnr.replace("-", ""));
  await expect(page.getByText(`PNR ${pnr}`)).toBeVisible();
});

test("yanlış soyad tek mesaj verir", async ({ page }) => {
  const pnr = await payAndReadPnr(page, "A2", "Demir");
  await page.goto("/biletimi-bul");
  await page.getByLabel("PNR").fill(pnr);
  await page.getByLabel("Soyad").fill("Yılmaz");
  await page.getByRole("button", { name: "Biletimi bul" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "PNR ya da soyad hatalı." })).toHaveText("PNR ya da soyad hatalı.");
  await expect(page).toHaveURL("/biletimi-bul");
});

test("ödenmemiş siparişin bilet adresi ödeme sayfasına yönlenir", async ({ page }) => {
  await startCheckout(page, "A3");
  const token = page.url().split("/odeme/")[1]!;
  await page.goto(`/bilet/${token}`);
  await expect(page).toHaveURL(`/odeme/${token}`);
});
