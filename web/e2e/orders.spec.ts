import type { Page } from "@playwright/test";

import { seedPaidDemoOrder } from "./support/faz6";
import { expect, test } from "./support/fixtures";
import { addTablesAndSave, createEvent, publishEvent } from "./support/ui";

// Senaryo tek etkinlikte sırayla ilerler: her adım bir öncekinin sonucuna dayanır.
test.describe.configure({ mode: "serial" });

const EVENT_NAME = "E2E Siparişler";
const PNR = "E2EPNR23";

let eventId = "";
let orderId = "";

// Bildirim (toast) kabuğu `aria-live` bölgesidir; `role="status"` taşımaz.
const toast = (page: Page, text: string) => page.locator('[aria-live="polite"]').getByText(text).first();

test.describe("Siparişler", () => {
  test("hazırlık: etkinlik, A1 masası, yayın ve demo sipariş", async ({ page }) => {
    eventId = await createEvent(page, EVENT_NAME);
    await addTablesAndSave(page, eventId, [{ label: "A1", capacity: 8 }]);
    await publishEvent(page, eventId);
    ({ orderId } = await seedPaidDemoOrder({
      eventName: EVENT_NAME,
      tableLabel: "A1",
      seats: 5,
      pnr: PNR,
      buyer: { firstName: "Ayse", lastName: "Yilmaz", email: "ayse@example.com" },
    }));
    expect(orderId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("bölüm çubuğundaki Siparişler bağlantısı liste sayfasına götürür", async ({ page }) => {
    await page.goto(`/events/${eventId}`);
    await page.getByRole("link", { name: "Siparişler" }).click();
    await page.waitForURL(`**/events/${eventId}/orders`);
    await expect(page.getByRole("heading", { name: "Siparişler", level: 1 })).toBeVisible();
  });

  test("liste: PNR, DEMO rozeti, açıklama ve doluluk", async ({ page }) => {
    await page.goto(`/events/${eventId}/orders`);
    await expect(page.getByRole("link", { name: "E2EP-NR23" })).toBeVisible();
    await expect(page.getByText("DEMO", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("DEMO - gerçek ödeme alınmadı").first()).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "A1" })).toContainText("5/8");
  });

  test("ayrıntı: 5 QR görseli ve alıcı adı; e-bilet yeniden gönderme SMTP uyarısı verir", async ({ page }) => {
    await page.goto(`/events/${eventId}/orders`);
    await page.getByRole("link", { name: "E2EP-NR23" }).click();
    await page.waitForURL(`**/events/${eventId}/orders/${orderId}`);
    await expect(page.getByRole("img", { name: /QR/ })).toHaveCount(5);
    await expect(page.getByText("Ayse Yilmaz")).toBeVisible();

    await page.getByRole("button", { name: "E-bileti yeniden gönder" }).click();
    await expect(toast(page, "SMTP ayarları yapılandırılmamış")).toBeVisible();
  });

  test("oturumsuz satış API'si giriş sayfasına yönlenmez: sır tanımsızken 503", async ({ playwright, baseURL }) => {
    const context = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try {
      const res = await context.get("/api/sales/v1/events", { maxRedirects: 0 });
      expect(res.status()).toBe(503);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("sales_api_disabled");
    } finally {
      await context.dispose();
    }
  });
});
