import path from "node:path";

import { FAKE_CAMERA_FILE } from "./support/constants";
import { expect, test } from "./support/fixtures";
import { qrTokenFor, reservationsByGuest } from "./support/db";
import { openDevice, seedEvent, type OfflineFixture } from "./support/offline";
import { writeQrY4m } from "./support/qr-video";

// Kamera ile QR okuma: Chromium sahte kamera aygıtı, gerçek bir rezervasyon belirtecinin QR görüntüsünü yayınlar.
test.describe.configure({ mode: "serial" });

const STAMP = Date.now().toString(36);
const EVENT_NAME = `Kamera Gala ${STAMP}`;
const CAMERA_GUEST = "Kamera Misafir";
const FAKE_FILE = path.resolve(import.meta.dirname, "..", FAKE_CAMERA_FILE);

let fixture: OfflineFixture;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  fixture = await seedEvent(browser, { eventName: EVENT_NAME, guests: [CAMERA_GUEST], freeTables: 0 });
});

test("kamera: sahte kamera akışındaki QR okunur ve misafir giriş yapar", async ({ browser }) => {
  writeQrY4m(FAKE_FILE, await qrTokenFor(CAMERA_GUEST));
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    await context.grantPermissions(["camera"]);
    await page.goto(`/check-in/${fixture.eventId}`);
    await expect(page.getByRole("heading", { name: EVENT_NAME, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Kamerayla tara" }).click();
    await expect(page.getByText("Kamera açık; QR kodu gösterin")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Giriş yapıldı" })).toContainText(CAMERA_GUEST, { timeout: 45_000 });
    expect((await reservationsByGuest(CAMERA_GUEST))[0]?.status).toBe("checked_in");
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları").toEqual([]);
});
