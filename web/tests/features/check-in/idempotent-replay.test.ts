import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { checkInEvents } from "@/db/schema";
import { checkIn } from "@/features/check-in/service";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { actorOf, legacyActorOf, bookedGuest, expectDomain, key } from "./fixtures";
import { managerActor, memberActor, persistActor } from "../../helpers/actors";

describe("checkIn: idempotent tekrar ve erişim (M1)", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("M1: başkasının anahtarı tekrarlanınca saklanan yanıt sızmaz (erişimsiz not_found, başka kullanıcı keyReused)", async () => {
    const owner = await persistActor(db, managerActor("casino"));
    const { event, reservation } = await bookedGuest({ organizerId: owner.id });
    const k = key();
    const first = await checkIn(db, owner, { eventId: event.id, idempotencyKey: k, token: reservation.qrToken });
    expect(first.outcome).toBe("checked_in");

    // Etkinliğe erişimi olmayan, check_in yetkili başka bir organizatör: aynı anahtar + aynı istek.
    const stranger = await legacyActorOf("organizer");
    const leak = await expectDomain(
      checkIn(db, stranger, { eventId: event.id, idempotencyKey: k, token: reservation.qrToken }),
      "not_found",
      "Etkinlik bulunamadı",
    );
    expect(leak.message).not.toContain(reservation.id);

    // Erişimi olan ama anahtarı üretmemiş başka kullanıcı: anahtar başka istek için kullanılmış sayılır.
    const otherDoor = await actorOf(memberActor("casino", { check_in: "vc--" }));
    await expectDomain(
      checkIn(db, otherDoor, { eventId: event.id, idempotencyKey: k, token: reservation.qrToken }),
      "conflict",
      "Bu istek anahtarı başka bir istek için kullanılmış",
    );

    // Anahtarı üreten kullanıcının kendi tekrarı hâlâ aynı yanıtı alır.
    const again = await checkIn(db, owner, { eventId: event.id, idempotencyKey: k, token: reservation.qrToken });
    expect(again).toEqual(first);
  });

  it("M1: saklanan yanıt başka etkinliğe aitse tekrar keyReused çatışması verir", async () => {
    const { event, reservation } = await bookedGuest();
    const door = await actorOf(memberActor("casino", { check_in: "vc--" }));
    const k = key();
    await checkIn(db, door, { eventId: event.id, idempotencyKey: k, token: reservation.qrToken });
    const [row] = await db.select().from(checkInEvents).where(eq(checkInEvents.idempotencyKey, k));
    const stored = row?.response as { data: Record<string, unknown> };
    await db
      .update(checkInEvents)
      .set({ response: { ...stored, data: { ...stored.data, eventId: randomUUID() } } })
      .where(eq(checkInEvents.idempotencyKey, k));
    await expectDomain(
      checkIn(db, door, { eventId: event.id, idempotencyKey: k, token: reservation.qrToken }),
      "conflict",
      "Bu istek anahtarı başka bir istek için kullanılmış",
    );
  });
});
