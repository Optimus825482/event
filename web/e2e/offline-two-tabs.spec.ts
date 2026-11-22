import type { Request } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { checkInKeys, qrTokenFor, reservationsByGuest } from "./support/db";
import { expectPending, openConsoleAndWarm, openDevice, scanCode, seedEvent, type OfflineFixture } from "./support/offline";

// Aynı cihazda (aynı tarayıcı bağlamı) iki sekme: tek IndexedDB kuyruğu, Web Locks ile tek boşaltma, BroadcastChannel ile eşleme.
test.describe.configure({ mode: "serial" });

const STAMP = Date.now().toString(36);
const EVENT_NAME = `Iki Sekme Gala ${STAMP}`;
const GUESTS = ["Sekme A Bir", "Sekme A Iki", "Sekme B Bir", "Sekme B Iki"];

let fixture: OfflineFixture;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  fixture = await seedEvent(browser, { eventName: EVENT_NAME, guests: GUESTS, freeTables: 0 });
});

type Batch = { keys: string[]; start: number; end: number };

test("iki sekme, tek kuyruk: her öğe tam bir kez gönderilir, sekmeler aynı anda boşaltmaz, sayaçlar sıfırlanır", async ({ browser }) => {
  const errors: string[] = [];
  const { context, page: tabA } = await openDevice(browser, { session: fixture.admin, errors });
  try {
    await openConsoleAndWarm(tabA, fixture.eventId, EVENT_NAME);
    const tabB = await context.newPage();
    tabB.on("pageerror", (e) => errors.push(`${tabB.url()} :: ${e.message}`));
    await tabB.goto(`/check-in/${fixture.eventId}`);
    await expect(tabB.getByRole("heading", { name: EVENT_NAME, level: 1 })).toBeVisible();
    await expectPending(tabA, 0);
    await expectPending(tabB, 0);

    // İstekleri sayar; her yanıtı bilinçli geciktirir ki eşzamanlı ikinci bir boşaltma varsa istek aralıkları çakışsın.
    const batches: Batch[] = [];
    await context.route("**/api/check-in", async (route) => {
      const request: Request = route.request();
      if (request.method() !== "POST") return route.continue();
      const body = JSON.parse(request.postData() ?? "{}") as { items: Array<{ idempotencyKey: string }> };
      const batch: Batch = { keys: body.items.map((i) => i.idempotencyKey), start: Date.now(), end: 0 };
      batches.push(batch);
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      batch.end = Date.now();
      await route.fulfill({ response });
    });

    await context.setOffline(true);
    await expect(tabA.getByText("Çevrimdışı", { exact: true })).toBeVisible();
    await expect(tabB.getByText("Çevrimdışı", { exact: true })).toBeVisible();

    await scanCode(tabA, await qrTokenFor(GUESTS[0] ?? ""));
    await expectPending(tabA, 1);
    // Tasarım: A'daki öğe BroadcastChannel ile B'ye yayılır; B yenilenmeden kendi bekleyen sayacında görür.
    await expectPending(tabB, 1);

    await scanCode(tabB, await qrTokenFor(GUESTS[2] ?? ""));
    await expectPending(tabB, 2);
    await expectPending(tabA, 2);
    await scanCode(tabA, await qrTokenFor(GUESTS[1] ?? ""));
    await scanCode(tabB, await qrTokenFor(GUESTS[3] ?? ""));
    await expectPending(tabA, 4);
    await expectPending(tabB, 4);
    expect(batches).toEqual([]);
    for (const name of GUESTS) expect((await reservationsByGuest(name))[0]?.status).toBe("confirmed");

    // Bağlantı gelir: iki sekme de `online` olayı alır ve aynı anda boşaltmayı dener; yalnızca biri kilidi alır.
    await context.setOffline(false);
    await expectPending(tabA, 0);
    await expectPending(tabB, 0);

    const sent = batches.flatMap((b) => b.keys);
    expect(sent, "her öğe anahtarı tüm isteklerde yalnızca bir kez").toHaveLength(4);
    expect(new Set(sent).size).toBe(4);
    const ordered = [...batches].sort((a, b) => a.start - b.start);
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i]?.start ?? 0, "boşaltma istekleri çakışmamalı").toBeGreaterThanOrEqual(ordered[i - 1]?.end ?? Infinity);
    }

    for (const name of GUESTS) {
      const [row] = await reservationsByGuest(name);
      expect(row?.status).toBe("checked_in");
      expect(await checkInKeys(row?.id ?? "")).toHaveLength(1);
    }

    // Yeniden yükleme hiçbir şeyi yeniden göndermez.
    await tabA.reload();
    await tabB.reload();
    await expectPending(tabA, 0);
    await expectPending(tabB, 0);
    await tabA.waitForTimeout(1_000);
    expect(batches.flatMap((b) => b.keys)).toHaveLength(4);
  } finally {
    await context.close();
  }
  expect(errors, "yakalanmamış tarayıcı hataları").toEqual([]);
});
