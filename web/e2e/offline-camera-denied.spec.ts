import { expect, test } from "./support/fixtures";
import { qrTokenFor, reservationsByGuest } from "./support/db";
import { openDevice, scanCode, seedEvent, type OfflineFixture } from "./support/offline";

// Kamera izni yokken (`permissions: []`, sahte arayüz bayrağı yok; ayrı proje): mesaj gösterilir, elle giriş sürer.
const STAMP = Date.now().toString(36);
const EVENT_NAME = `Izinsiz Gala ${STAMP}`;
const GUESTS = { denied: "Elle Giris Misafir", headless: "Kamerasiz Misafir" };

let fixture: OfflineFixture;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  fixture = await seedEvent(browser, { eventName: EVENT_NAME, guests: [GUESTS.denied, GUESTS.headless], freeTables: 0 });
});

async function expectManualEntryStillWorks(page: Parameters<typeof scanCode>[0], guest: string) {
  await expect(page.getByRole("button", { name: "Kamerayla tara" })).toBeVisible();
  await scanCode(page, await qrTokenFor(guest));
  await expect(page.getByRole("status").filter({ hasText: "Giriş yapıldı" })).toContainText(guest);
  expect((await reservationsByGuest(guest))[0]?.status).toBe("checked_in");
}

test("izin reddedilince (NotAllowedError) Türkçe mesaj gösterilir ve elle QR girişi çalışır", async ({ browser }) => {
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    // Başsız Chromium izin istemi gösteremez (NotSupportedError); gerçek bir ret, tarayıcının
    // verdiği hatayla (NotAllowedError) simüle edilir. Uygulamanın hata eşlemesi ve yedek yolu sınanır.
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
    });
    await page.goto(`/check-in/${fixture.eventId}`);
    await expect(page.getByRole("heading", { name: EVENT_NAME, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Kamerayla tara" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Kamera izni reddedildi" })).toContainText("manuel aramayla giriş");
    await expectManualEntryStillWorks(page, GUESTS.denied);
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları").toEqual([]);
});

test("kamera hiç açılamıyorsa (gerçek tarayıcı hatası) genel mesaj gösterilir ve elle giriş çalışır", async ({ browser }) => {
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    await page.goto(`/check-in/${fixture.eventId}`);
    await expect(page.getByRole("heading", { name: EVENT_NAME, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Kamerayla tara" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Kamera başlatılamadı" })).toContainText("manuel aramayla giriş");
    await expectManualEntryStillWorks(page, GUESTS.headless);
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları").toEqual([]);
});
