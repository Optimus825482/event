import { expect, test, type Page } from "@playwright/test";
import { expectHeadingOrder, openCheckout } from "./sayfa-yardimcilari";
import { fillBuyer } from "./support/checkout";
import { fakeState, holdAs, resetOrders, tableId } from "./support/fake";
import { expectNoHorizontalOverflow } from "./support/layout";

const { gala, masa } = fakeState().events;

test.beforeEach(async () => {
  await resetOrders();
});

async function openCheckoutWithSeats(page: Page, label: string, seatNos: number[]): Promise<void> {
  const order = await holdAs(gala.id, tableId(gala, label), seatNos.length, seatNos);
  await page.goto(`/odeme/${order.orderToken}`);
}

async function pay(page: Page, label: string, lastName: string, quantity = 1): Promise<void> {
  await openCheckout(page, label, { quantity });
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
  await expectHeadingOrder(page);
  await expectNoHorizontalOverflow(page);
});

test("sandalye bazlı etkinlikte bilet kartı seçilen sandalye numaralarını gösterir", async ({ page }) => {
  await openCheckoutWithSeats(page, "A6", [4, 7]);
  await fillBuyer(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page).toHaveURL(/\/bilet\//);
  await expect(page.getByText("Sandalye 4", { exact: true })).toBeVisible();
  await expect(page.getByText("Sandalye 7", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Satın alma adımları" }).locator('[aria-current="step"]')).toHaveText(
    /E-Bilet/,
  );
  await expectHeadingOrder(page);
  await expectNoHorizontalOverflow(page);
});

test("bütün satılan loca: bilet sayısı sandalye sayısıdır ve sandalye numarası yazılmaz", async ({ page }) => {
  await openCheckout(page, "L1", { quantity: 6 });
  await fillBuyer(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page).toHaveURL(/\/bilet\//);
  await expect(page.getByRole("img", { name: /Bilet \d QR kodu/ })).toHaveCount(6);
  await expect(page.getByText(/^Sandalye \d+$/)).toHaveCount(0);
});

test("masa bazlı etkinlikte bilet kartında sandalye numarası yoktur", async ({ page }) => {
  await openCheckout(page, "A1", { quantity: 8, event: masa });
  await fillBuyer(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Öde" }).click();
  await expect(page).toHaveURL(/\/bilet\//);
  await expect(page.getByText("Masa A1")).toHaveCount(8);
  await expect(page.getByText(/^Sandalye \d+$/)).toHaveCount(0);
});

test("biletimi bul: PNR + soyad e-bilete götürür, PNR adrese yazılmaz", async ({ page }) => {
  const pnr = await payAndReadPnr(page, "A4", "Demir");
  await page.goto("/biletimi-bul");
  await expect(page.getByRole("heading", { level: 1, name: "Biletim (PNR)" })).toBeVisible();
  await page.getByLabel("PNR").fill(pnr);
  await page.getByLabel("Soyad").fill("demir");
  await page.getByRole("button", { name: "Biletimi bul" }).click();
  await expect(page).toHaveURL(/\/bilet\//);
  expect(page.url()).not.toContain(pnr.replace("-", ""));
  await expect(page.getByText(`PNR ${pnr}`)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("yanlış soyad tek mesaj verir", async ({ page }) => {
  const pnr = await payAndReadPnr(page, "A2", "Demir");
  await page.goto("/biletimi-bul");
  await page.getByLabel("PNR").fill(pnr);
  await page.getByLabel("Soyad").fill("Yılmaz");
  await page.getByRole("button", { name: "Biletimi bul" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "PNR ya da soyad hatalı." })).toHaveText(
    "PNR ya da soyad hatalı.",
  );
  await expect(page).toHaveURL("/biletimi-bul");
});

test("ödenmemiş siparişin bilet adresi ödeme sayfasına yönlenir", async ({ page }) => {
  await openCheckout(page, "A3");
  const token = page.url().split("/odeme/")[1]!;
  await page.goto(`/bilet/${token}`);
  await expect(page).toHaveURL(`/odeme/${token}`);
});
