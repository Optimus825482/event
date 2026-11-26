import type { Page, Request } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { seedDoorEvent, ticketGates, type DoorSeed } from "./support/faz8";
import { openConsoleTab, scanCode } from "./support/offline";

// Bilet girişi: PNR ile toplu/tek tek, bilet QR'ı, rezervasyon kodu ve kapı seçimi (yönetici oturumu, geliştirme sunucusu).
test.describe.configure({ mode: "serial" });

const STAMP = Date.now().toString(36);

function seedNamed(label: string): Promise<DoorSeed> {
  return seedDoorEvent(`Kapı ${label} ${STAMP}`);
}

function gateSelect(page: Page) {
  return page.getByLabel("Kapı", { exact: true });
}

async function openConsole(page: Page, seed: DoorSeed): Promise<void> {
  await page.goto(`/check-in/${seed.eventId}`);
  await expect(page.getByRole("heading", { name: seed.eventName, level: 1 })).toBeVisible();
}

function ticketCheckedInTile(page: Page) {
  return page
    .getByRole("region", { name: "İstatistikler" })
    .locator("div.rounded-lg")
    .filter({ has: page.getByText("Bilet girişi", { exact: true }) })
    .locator("p")
    .nth(1);
}

test("PNR ile toplu ve tek tek giriş: tek istek, farklı anahtarlar, kapı 2", async ({ page }) => {
  const seed = await seedNamed("PNR");
  await openConsole(page, seed);
  await gateSelect(page).selectOption({ label: "Kapı 2" });
  await openConsoleTab(page, "Ara");

  // Küçük harf ve tiresiz PNR.
  await page.locator("#guest-search").fill(seed.pnr.toLowerCase());
  const order = page.getByRole("region", { name: "Sipariş" });
  await expect(order.getByRole("heading")).toHaveText(
    `Sipariş · PNR ${seed.pnr.slice(0, 4)}-${seed.pnr.slice(4)} · ${seed.buyerFirstName} ${seed.buyerLastName}`,
  );
  await expect(order.getByText("Masa B1", { exact: true })).toHaveCount(2);
  await expect(order.getByText("Masa B2", { exact: true })).toHaveCount(1);
  await expect(order.getByRole("checkbox")).toHaveCount(3);

  // Bir bilet seçimden çıkarılır, kalan ikisi tek toplu istekle girer.
  await order.getByRole("checkbox").first().uncheck();
  const requests: Request[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === "/api/check-in") requests.push(r);
  });
  const sent = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/check-in");
  await order.getByRole("button", { name: "Seçilenleri içeri al (2)" }).click();
  const body = (await sent).postDataJSON() as { items: { ticketId: string; gate: number; idempotencyKey: string }[] };
  expect(body.items).toHaveLength(2);
  expect(new Set(body.items.map((i) => i.idempotencyKey)).size).toBe(2);
  for (const item of body.items) {
    expect(item.gate).toBe(2);
    expect(item.ticketId).toBeTruthy();
  }
  await expect(page.getByRole("status").filter({ hasText: "2 bilet içeri alındı" })).toBeVisible();
  expect(requests).toHaveLength(1);

  // Kalan bilet tek tek girer.
  const remaining = order.getByRole("button", { name: /için giriş yap$/ });
  await expect(remaining).toHaveCount(1);
  await remaining.click();
  await expect(order.getByRole("button", { name: /için giriş yap$/ })).toHaveCount(0);
  await expect(ticketCheckedInTile(page)).toHaveText("3");
  await expect.poll(() => ticketGates(seed.eventId)).toEqual([2, 2, 2]);
});

test("bilet QR'ı iki kez okutulunca ikincisi zaten giriş yapmış der", async ({ page }) => {
  const seed = await seedNamed("QR");
  await openConsole(page, seed);
  const first = seed.tickets[0]!;

  await scanCode(page, first.qrPayload);
  const banner = page.getByRole("status").filter({ hasText: "Giriş yapıldı" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(`Masa ${first.tableLabel}`);

  await scanCode(page, first.qrPayload);
  await expect(page.getByRole("status").filter({ hasText: "Bu misafir zaten giriş yaptı" })).toBeVisible();
});

test("rezervasyon koduyla arama tek satır verir ve giriş yaptırır", async ({ page }) => {
  const seed = await seedNamed("Rezervasyon");
  await openConsole(page, seed);
  await openConsoleTab(page, "Ara");

  await page.locator("#guest-search").fill(seed.reservation.bookingCode);
  const rows = page.getByRole("listitem").filter({ hasText: seed.reservation.guestName });
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(`Masa ${seed.reservation.tableLabel}`);
  await rows.first().getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Giriş yapıldı" })).toBeVisible();
});

test("seçilen kapı yenilemeden sonra hatırlanır", async ({ page }) => {
  const seed = await seedNamed("Kapı");
  await openConsole(page, seed);
  await gateSelect(page).selectOption({ label: "Kapı 2" });
  await page.reload();
  await expect(page.getByRole("heading", { name: seed.eventName, level: 1 })).toBeVisible();
  await expect(gateSelect(page)).toHaveValue("2");
});

test("konsol 375 px genişlikte yatay taşmaz", async ({ page }) => {
  const seed = await seedNamed("Mobil");
  await page.setViewportSize({ width: 375, height: 812 });
  await openConsole(page, seed);
  await openConsoleTab(page, "Ara");
  await page.locator("#guest-search").fill(seed.pnr);
  await expect(page.getByRole("region", { name: "Sipariş" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
