import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { checkInEvents } from "@/db/schema";
import { checkIn, registerWalkIn, registerWalkInOnce } from "@/features/check-in/service";
import { memberActor } from "../../helpers/actors";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { createTable } from "../../helpers/factories";
import { actorOf, bookedGuest, checkInLog, expectDomain, key, reservationRow, setReservationStatus } from "./fixtures";

const doorActor = () => actorOf(memberActor("casino", { check_in: "vc--" }));

describe("kapı numarası", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("kapı numarası rezervasyona, giriş kaydına ve yanıta yazılır", async () => {
    const { event, reservation } = await bookedGuest();
    const door = await doorActor();
    const r = await checkIn(db, door, { eventId: event.id, idempotencyKey: key(), token: reservation.qrToken, gate: 2 });
    expect(r).toMatchObject({ outcome: "checked_in", kind: "reservation", reservationId: reservation.id, ticketId: null, pnr: null, gate: 2 });
    expect((await reservationRow(reservation.id)).checkInGate).toBe(2);
    expect((await checkInLog(reservation.id)).map((l) => l.gate)).toEqual([2]);
  });

  it("kapı verilmezse null kalır", async () => {
    const { event, reservation } = await bookedGuest();
    const door = await doorActor();
    const r = await checkIn(db, door, { eventId: event.id, idempotencyKey: key(), token: reservation.qrToken });
    expect(r.gate).toBeNull();
    expect((await reservationRow(reservation.id)).checkInGate).toBeNull();
    expect((await checkInLog(reservation.id)).map((l) => l.gate)).toEqual([null]);
  });

  it("zaten giriş yapılmışsa yanıt İLK girişin kapısını, ikinci kayıt kendi kapısını taşır", async () => {
    const { event, reservation } = await bookedGuest();
    const door = await doorActor();
    await checkIn(db, door, { eventId: event.id, idempotencyKey: key(), token: reservation.qrToken, gate: 1 });
    const r = await checkIn(db, door, { eventId: event.id, idempotencyKey: key(), token: reservation.qrToken, gate: 3 });
    expect(r).toMatchObject({ outcome: "already_checked_in", gate: 1 });
    expect((await checkInLog(reservation.id)).map((l) => l.gate).sort()).toEqual([1, 3]);
    expect((await reservationRow(reservation.id)).checkInGate).toBe(1);
  });

  it("aynı anahtar farklı kapıyla tekrarlanırsa saklanan yanıt döner", async () => {
    const { event, reservation } = await bookedGuest();
    const door = await doorActor();
    const k = key();
    const first = await checkIn(db, door, { eventId: event.id, idempotencyKey: k, token: reservation.qrToken, gate: 1 });
    const again = await checkIn(db, door, { eventId: event.id, idempotencyKey: k, token: reservation.qrToken, gate: 3 });
    expect(again).toEqual(first);
    const log = await checkInLog(reservation.id);
    expect(log).toHaveLength(1);
    expect(log[0]?.gate).toBe(1);
  });

  it("reddedilen deneme de kapısını kaydeder", async () => {
    const { event, reservation } = await bookedGuest();
    await setReservationStatus(reservation.id, "cancelled");
    const door = await doorActor();
    await expectDomain(
      checkIn(db, door, { eventId: event.id, idempotencyKey: key(), token: reservation.qrToken, gate: 2 }),
      "conflict",
    );
    const log = await checkInLog(reservation.id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ outcome: "invalid_status", gate: 2 });
  });

  it("eski saklı yanıtın tekrarı yeni alanları varsayılanlarla döndürür", async () => {
    const { event, reservation } = await bookedGuest();
    const door = await doorActor();
    const k = key();
    await checkIn(db, door, { eventId: event.id, idempotencyKey: k, token: reservation.qrToken });
    const [row] = await db.select().from(checkInEvents).where(eq(checkInEvents.idempotencyKey, k));
    const stored = row?.response as { ok: true; data: Record<string, unknown> };
    const legacy = { ...stored.data };
    for (const field of ["kind", "ticketId", "pnr", "gate"]) delete legacy[field];
    await db.update(checkInEvents).set({ response: { ...stored, data: legacy } }).where(eq(checkInEvents.idempotencyKey, k));
    const again = await checkIn(db, door, { eventId: event.id, idempotencyKey: k, token: reservation.qrToken });
    expect(again).toMatchObject({ kind: "reservation", ticketId: null, pnr: null, gate: null, reservationId: reservation.id });
  });

  it("walk-in kapıyı rezervasyona ve kaydına yazar", async () => {
    const { event } = await bookedGuest();
    const table = await createTable(db, event.id, { capacity: 6, label: "K7" });
    const door = await doorActor();
    const r = await registerWalkIn(db, door, { eventId: event.id, tableId: table.id, guestName: "Kapı", guestCount: 2, gate: 3 });
    expect(r.gate).toBe(3);
    expect((await reservationRow(r.reservationId!)).checkInGate).toBe(3);
    const [log] = await db.select().from(checkInEvents).where(eq(checkInEvents.idempotencyKey, `walk-in:${r.reservationId}`));
    expect(log?.gate).toBe(3);
  });

  it("kuyruktan gelen walk-in (registerWalkInOnce) kapıyı anahtar satırına yazar", async () => {
    const { event } = await bookedGuest();
    const table = await createTable(db, event.id, { capacity: 6, label: "K7" });
    const door = await doorActor();
    const k = key();
    const r = await registerWalkInOnce(db, door, { eventId: event.id, tableId: table.id, guestName: "Kapı", guestCount: 2, idempotencyKey: k, gate: 1 });
    expect(r.gate).toBe(1);
    const [log] = await db.select().from(checkInEvents).where(eq(checkInEvents.idempotencyKey, k));
    expect(log?.gate).toBe(1);
  });
});
