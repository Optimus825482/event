import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/check-in/route";
import { db } from "@/db/client";
import { checkInEvents, reservations } from "@/db/schema";
import { registerWalkInOnce } from "@/features/check-in/service";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { createTable } from "../../helpers/factories";
import { loginAs } from "../realtime/helpers";
import { actorOf, bookedGuest, expectDomain, key } from "./fixtures";

async function setup() {
  const { event } = await bookedGuest();
  const table = await createTable(db, event.id, { capacity: 6, label: "K7" });
  return { event, table };
}

async function guestRows(eventId: string, name: string) {
  const rows = await db.select().from(reservations).where(eq(reservations.eventId, eventId));
  return rows.filter((r) => r.guestName === name);
}

type BatchBody = { results: Array<{ idempotencyKey: string; result: unknown }> };

describe("registerWalkInOnce: anahtarla tek sefer (çevrimdışı kuyruk)", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("aynı anahtarla tekrar yeni rezervasyon açmaz, aynı yanıtı döndürür; anahtar tek satırda saklanır", async () => {
    const { event, table } = await setup();
    const door = await actorOf("controller");
    const k = key();
    const input = { eventId: event.id, tableId: table.id, guestName: "Kapı", guestCount: 3, idempotencyKey: k };

    const first = await registerWalkInOnce(db, door, input);
    const again = await registerWalkInOnce(db, door, input);

    expect(first).toMatchObject({ outcome: "checked_in", tableLabel: "K7", guestName: "Kapı", guestCount: 3 });
    expect(again).toEqual(first);
    expect(await guestRows(event.id, "Kapı")).toHaveLength(1);
    const logs = await db.select().from(checkInEvents).where(eq(checkInEvents.idempotencyKey, k));
    expect(logs).toHaveLength(1);
    expect(logs[0]?.reservationId).toBe(first.reservationId);
    expect(logs[0]?.actorId).toBe(door.id);
  });

  it("istemci zaman damgası giriş zamanı olur (24 saat içindeyse)", async () => {
    const { event, table } = await setup();
    const door = await actorOf("controller");
    const at = new Date(Date.now() - 3_600_000);
    const res = await registerWalkInOnce(db, door, {
      eventId: event.id,
      tableId: table.id,
      guestName: "Geç",
      guestCount: 1,
      idempotencyKey: key(),
      clientTimestamp: at.toISOString(),
    });
    expect(new Date(res.checkedInAt).getTime()).toBe(at.getTime());
  });

  it("aynı anahtar farklı bir istekle ya da başka kullanıcıyla gelirse çatışma; yeni rezervasyon açılmaz", async () => {
    const { event, table } = await setup();
    const other = await createTable(db, event.id, { capacity: 4, label: "K8" });
    const door = await actorOf("controller");
    const k = key();
    const base = { eventId: event.id, guestName: "Kapı", guestCount: 2, idempotencyKey: k };
    await registerWalkInOnce(db, door, { ...base, tableId: table.id });

    await expectDomain(
      registerWalkInOnce(db, door, { ...base, tableId: other.id }),
      "conflict",
      "Bu istek anahtarı başka bir istek için kullanılmış",
    );
    const stranger = await actorOf("controller");
    await expectDomain(
      registerWalkInOnce(db, stranger, { ...base, tableId: table.id }),
      "conflict",
      "Bu istek anahtarı başka bir istek için kullanılmış",
    );
    expect(await guestRows(event.id, "Kapı")).toHaveLength(1);
  });

  it("iş kuralı reddi de saklanır: masa sonradan boşalsa bile tekrar aynı ret döner, rezervasyon açılmaz", async () => {
    const { event, table } = await setup();
    const door = await actorOf("controller");
    await registerWalkInOnce(db, door, {
      eventId: event.id,
      tableId: table.id,
      guestName: "İlk",
      guestCount: 1,
      idempotencyKey: key(),
    });
    const second = { eventId: event.id, tableId: table.id, guestName: "İkinci", guestCount: 1, idempotencyKey: key() };
    const err = await expectDomain(registerWalkInOnce(db, door, second), "conflict");

    await db.update(reservations).set({ status: "cancelled" }).where(eq(reservations.guestName, "İlk"));
    const replayed = await expectDomain(registerWalkInOnce(db, door, second), "conflict");
    expect(replayed.message).toBe(err.message);
    expect(await guestRows(event.id, "İkinci")).toHaveLength(0);
  });

  it("POST /api/check-in toplu istekte kind=walk_in öğesi anahtarla tek sefer işlenir", async () => {
    const { event, table } = await setup();
    const door = await loginAs("controller");
    const k = key();
    const item = {
      kind: "walk_in",
      eventId: event.id,
      idempotencyKey: k,
      clientTimestamp: new Date().toISOString(),
      tableId: table.id,
      guestName: "Kuyruktan",
      guestCount: 2,
    };
    const send = async () => {
      const res = await POST(
        new Request("http://localhost:3000/api/check-in", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost:3000", cookie: door.cookie },
          body: JSON.stringify({ ownerId: door.id, items: [item] }),
        }),
      );
      return (await res.json()) as BatchBody;
    };
    const a = await send();
    const b = await send();

    expect(a.results[0]?.idempotencyKey).toBe(k);
    expect(a.results[0]?.result).toMatchObject({ ok: true, data: { outcome: "checked_in", guestName: "Kuyruktan" } });
    expect(b).toEqual(a);
    expect(await guestRows(event.id, "Kuyruktan")).toHaveLength(1);
  });
});
