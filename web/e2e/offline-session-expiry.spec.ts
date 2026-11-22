import { expect, test } from "./support/fixtures";
import { checkInKeys, deleteSessionsOf, qrTokenFor, reservationsByGuest } from "./support/db";
import {
  createDoorUser,
  expectPending,
  openConsoleAndWarm,
  openDevice,
  scanCode,
  seedEvent,
  signIn,
  type OfflineFixture,
} from "./support/offline";

// Sunucuda oturum biterse (satır silinir) boşaltma 401 alır: kuyruk durur, öğeler korunur, yeniden girişten sonra bir kez gönderilir.
test.describe.configure({ mode: "serial" });

const STAMP = Date.now().toString(36);
const EVENT_NAME = `Oturum Bitis Gala ${STAMP}`;
const GUESTS = ["Bitis Misafir Bir", "Bitis Misafir Iki"];
const DOOR_USER = `kapi-bitis-${STAMP}`;

let fixture: OfflineFixture;
let doorPassword = "";

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  fixture = await seedEvent(browser, { eventName: EVENT_NAME, guests: GUESTS, freeTables: 0 });
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    doorPassword = await createDoorUser(page, DOOR_USER);
  } finally {
    await context.close();
  }
});

test("sunucuda oturum bitti: 401 kuyruğu durdurur, öğeler kalır, aynı kullanıcıyla girişten sonra tam bir kez gönderilir", async ({ browser }) => {
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { errors });
  try {
    await signIn(page, DOOR_USER, doorPassword);
    await openConsoleAndWarm(page, fixture.eventId, EVENT_NAME);

    const statuses: number[] = [];
    page.on("response", (r) => {
      if (r.request().method() === "POST" && r.url().endsWith("/api/check-in")) statuses.push(r.status());
    });

    await context.setOffline(true);
    await scanCode(page, await qrTokenFor(GUESTS[0] ?? ""));
    await scanCode(page, await qrTokenFor(GUESTS[1] ?? ""));
    await expectPending(page, 2);

    // Oturum sunucuda ölür; bağlantı gelince boşaltma 401 alır.
    expect(await deleteSessionsOf(DOOR_USER)).toBeGreaterThan(0);
    await context.setOffline(false);

    const alert = page.getByRole("alert").filter({ hasText: "Oturum süresi doldu; kuyruk durduruldu." });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Bekleyen girişler silinmedi");
    await expect(alert.getByRole("link", { name: "Yeniden giriş yap" })).toBeVisible();
    await expectPending(page, 2);
    expect(statuses).toContain(401);
    for (const name of GUESTS) {
      const [row] = await reservationsByGuest(name);
      expect(row?.status).toBe("confirmed");
      expect(await checkInKeys(row?.id ?? "")).toEqual([]);
    }

    // Duraklatılmışken zamanlayıcı/görünürlük tetikleyicileri yeniden denemez.
    const atPause = statuses.length;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForTimeout(1_500);
    expect(statuses.length).toBe(atPause);
    await expectPending(page, 2);

    // Aynı kullanıcıyla yeniden giriş: kuyruk IndexedDB'den geri gelir ve bir kez gönderilir.
    await signIn(page, DOOR_USER, doorPassword);
    await page.goto(`/check-in/${fixture.eventId}`);
    await expect(page.getByRole("heading", { name: EVENT_NAME, level: 1 })).toBeVisible();
    await expectPending(page, 0);
    for (const name of GUESTS) {
      await expect.poll(async () => (await reservationsByGuest(name))[0]?.status).toBe("checked_in");
      const [row] = await reservationsByGuest(name);
      expect(await checkInKeys(row?.id ?? "")).toHaveLength(1);
    }
    await expect(page.getByRole("alert").filter({ hasText: "Oturum süresi doldu" })).toHaveCount(0);
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları").toEqual([]);
});
