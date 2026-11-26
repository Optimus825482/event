import type { Request } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { checkedInCount, checkInKeys, qrTokenFor, reservationsByGuest, withDb } from "./support/db";
import { seedDoorEvent } from "./support/faz8";
import {
  expectPending,
  openConsoleAndWarm,
  openDevice,
  queueRegion,
  scanCode,
  seedEvent,
  submitWalkIn,
  type OfflineFixture,
} from "./support/offline";

// Üretim derlemesinde (service worker kayıtlı) gerçek tarayıcıyla çevrimdışı check-in akışı.
test.describe.configure({ mode: "serial" });

const STAMP = Date.now().toString(36);
const EVENT_NAME = `Offline Gala ${STAMP}`;
const GUEST = {
  online: "Online Misafir",
  offline: "Cevrimdisi Misafir",
  lost: "Kayip Yanit Misafir",
};
/** Biletin giriş durumu ve `check_in_events` satır sayısı. */
async function ticketCheckInCount(ticketId: string): Promise<{ checkedIn: boolean; events: number }> {
  return withDb(async (pool) => {
    const t = await pool.query<{ checked_in: boolean }>(
      "select checked_in_at is not null as checked_in from tickets where id = $1",
      [ticketId],
    );
    const e = await pool.query<{ n: string }>("select count(*)::text as n from check_in_events where ticket_id = $1", [
      ticketId,
    ]);
    return { checkedIn: t.rows[0]?.checked_in ?? false, events: Number(e.rows[0]?.n ?? "0") };
  });
}

const WALK_IN = { offline: "Cevrimdisi Walkin", lost: "Kayip Yanit Walkin" };

let fixture: OfflineFixture;

async function oneCheckIn(name: string) {
  const rows = await reservationsByGuest(name);
  expect(rows).toHaveLength(1);
  const [row] = rows;
  if (!row) throw new Error(`Rezervasyon yok: ${name}`);
  return { ...row, keys: await checkInKeys(row.id) };
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  fixture = await seedEvent(browser, {
    eventName: EVENT_NAME,
    guests: [GUEST.online, GUEST.offline, GUEST.lost],
    freeTables: 3,
  });
});

test("çevrimdışı check-in ve walk-in kuyruğa alınır, yenilemede kalır, bağlanınca tam bir kez gönderilir", async ({ browser }) => {
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    await openConsoleAndWarm(page, fixture.eventId, EVENT_NAME);

    // Çevrimiçi check-in çalışır.
    await scanCode(page, await qrTokenFor(GUEST.online));
    await expect(page.getByRole("status").filter({ hasText: "Giriş yapıldı" })).toContainText(GUEST.online);
    await expectPending(page, 0);
    expect((await oneCheckIn(GUEST.online)).status).toBe("checked_in");
    const before = await checkedInCount(EVENT_NAME);

    // Bağlantı kesilir: check-in ve walk-in kuyruğa girer, onaylanmış gibi gösterilmez.
    await context.setOffline(true);
    await expect(queueRegion(page).getByText("Çevrimdışı", { exact: true })).toBeVisible();
    await scanCode(page, await qrTokenFor(GUEST.offline));
    await expect(page.getByRole("status").filter({ hasText: "Çevrimdışı — kuyruğa alındı" })).toContainText("ONAYLANMADI");
    await expectPending(page, 1);
    await submitWalkIn(page, { table: "W1", name: WALK_IN.offline, guests: 2 });
    await expectPending(page, 2);
    expect((await oneCheckIn(GUEST.offline)).status).toBe("confirmed");
    expect(await reservationsByGuest(WALK_IN.offline)).toHaveLength(0);

    // Çevrimdışıyken yenileme: kabuk service worker'dan açılır, kuyruk IndexedDB'den geri gelir.
    await page.reload();
    await expect(page.getByRole("heading", { name: EVENT_NAME, level: 1 })).toBeVisible();
    await expectPending(page, 2);
    await expect(queueRegion(page).getByText("Çevrimdışı", { exact: true })).toBeVisible();

    // Bağlantı gelir: iki öğe de gönderilir, sayaç sıfırlanır.
    await context.setOffline(false);
    await expectPending(page, 0);
    await expect(page.getByText("2 giriş sunucuya eşitlendi")).toBeAttached();

    const checkedIn = await oneCheckIn(GUEST.offline);
    expect(checkedIn.status).toBe("checked_in");
    expect(checkedIn.keys).toHaveLength(1);
    const walkIn = await oneCheckIn(WALK_IN.offline);
    expect(walkIn.status).toBe("checked_in");
    expect(walkIn.keys).toHaveLength(1);
    expect(await checkedInCount(EVENT_NAME)).toBe(before + 2);

    // Yeniden yükleyince bir daha gönderilmez.
    await page.reload();
    await expectPending(page, 0);
    expect(await checkedInCount(EVENT_NAME)).toBe(before + 2);
    expect((await oneCheckIn(GUEST.offline)).keys).toHaveLength(1);
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları").toEqual([]);
});

test("yanıt kaybolur: aynı anahtarla yeniden gönderilir ve veritabanında tek check-in kalır", async ({ browser }) => {
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    await openConsoleAndWarm(page, fixture.eventId, EVENT_NAME);

    // İstek sunucuya ulaşır ve işlenir; istemci yalnızca ağ hatası görür (ilk çağrıda).
    const sentKeys: string[][] = [];
    let swallow = true;
    await context.route("**/api/check-in", async (route) => {
      const request: Request = route.request();
      if (request.method() !== "POST") return route.continue();
      const body = JSON.parse(request.postData() ?? "{}") as { items: Array<{ idempotencyKey: string }> };
      sentKeys.push(body.items.map((i) => i.idempotencyKey));
      if (swallow) {
        swallow = false;
        await route.fetch();
        await route.abort("connectionreset");
        return;
      }
      await route.continue();
    });

    // 1) check-in
    await scanCode(page, await qrTokenFor(GUEST.lost));
    await expect(page.getByRole("status").filter({ hasText: "kuyruğa alındı" })).toBeVisible();
    // Sunucu ilk isteği zaten işledi.
    expect((await oneCheckIn(GUEST.lost)).status).toBe("checked_in");
    await expect(async () => {
      await page.getByRole("button", { name: "Şimdi gönder" }).click({ timeout: 1_000 });
      await expectPending(page, 0);
    }).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 3_000] });
    expect(sentKeys).toHaveLength(2);
    expect(sentKeys[1]).toEqual(sentKeys[0]);
    const lost = await oneCheckIn(GUEST.lost);
    expect(lost.keys).toEqual(sentKeys[0]);

    // 2) walk-in: aynı senaryo
    swallow = true;
    sentKeys.length = 0;
    await submitWalkIn(page, { table: "W2", name: WALK_IN.lost, guests: 3 });
    await expect(page.getByRole("status").filter({ hasText: "kuyruğa alındı" })).toBeVisible();
    expect((await oneCheckIn(WALK_IN.lost)).status).toBe("checked_in");
    await expect(async () => {
      await page.getByRole("button", { name: "Şimdi gönder" }).click({ timeout: 1_000 });
      await expectPending(page, 0);
    }).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 3_000] });
    expect(sentKeys).toHaveLength(2);
    expect(sentKeys[1]).toEqual(sentKeys[0]);
    const walkIn = await oneCheckIn(WALK_IN.lost);
    expect(walkIn.keys).toEqual(sentKeys[0]);
    expect(walkIn.status).toBe("checked_in");
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları").toEqual([]);
});

test("service worker /api/** yanıtlarını önbellekten asla sunmaz", async ({ browser }) => {
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    await openConsoleAndWarm(page, fixture.eventId, EVENT_NAME);
    const probe = () =>
      page.evaluate(async () => {
        const result: Record<string, string> = {};
        for (const url of ["/api/auth/get-session", "/api/health"]) {
          try {
            const res = await fetch(url, { credentials: "same-origin" });
            result[url] = `http ${res.status}`;
          } catch (error) {
            result[url] = error instanceof TypeError ? "network-error" : "other-error";
          }
        }
        return result;
      });

    const online = await probe();
    expect(online["/api/auth/get-session"]).toBe("http 200");
    expect(online["/api/health"]).toBe("http 200");

    // Çevrimdışı: bayat kopya yerine ağ hatası.
    await context.setOffline(true);
    expect(await probe()).toEqual({ "/api/auth/get-session": "network-error", "/api/health": "network-error" });
    await context.setOffline(false);

    const cached = await page.evaluate(async () => {
      const hits: string[] = [];
      for (const url of ["/api/auth/get-session", "/api/health", "/api/check-in"]) {
        if (await caches.match(url)) hits.push(url);
      }
      return hits;
    });
    expect(cached).toEqual([]);
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları").toEqual([]);
});

test("çevrimdışı okutulan bilet QR'ı bağlantı gelince tek giriş olarak eşitlenir", async ({ browser }) => {
  const door = await seedDoorEvent(`Bilet Offline ${STAMP}`);
  const ticket = door.tickets[0]!;
  const errors: string[] = [];
  const { context, page } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    await openConsoleAndWarm(page, door.eventId, door.eventName);

    // Bağlantı kesilir: bilet QR'ı kuyruğa girer, sunucuda henüz giriş yoktur.
    await context.setOffline(true);
    await expect(queueRegion(page).getByText("Çevrimdışı", { exact: true })).toBeVisible();
    await scanCode(page, ticket.qrPayload);
    await expect(page.getByRole("status").filter({ hasText: "Çevrimdışı — kuyruğa alındı" })).toContainText("ONAYLANMADI");
    await expectPending(page, 1);
    expect(await ticketCheckInCount(ticket.ticketId)).toEqual({ checkedIn: false, events: 0 });

    // Bağlantı gelir: tek giriş olarak eşitlenir.
    await context.setOffline(false);
    await expectPending(page, 0);
    await expect.poll(() => ticketCheckInCount(ticket.ticketId)).toEqual({ checkedIn: true, events: 1 });

    // Yeniden yükleyince bir daha gönderilmez.
    await page.reload();
    await expectPending(page, 0);
    expect(await ticketCheckInCount(ticket.ticketId)).toEqual({ checkedIn: true, events: 1 });
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları").toEqual([]);
});
