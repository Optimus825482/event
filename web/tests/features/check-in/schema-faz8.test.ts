import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { checkInEvents, reservations, tickets } from "@/db/schema";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { ticketedEvent, ticketLog, ticketRow } from "../../helpers/door";
import { pgErrorCode } from "../../helpers/factories";
import { bookedGuest, key, rejection, reservationRow } from "./fixtures";

/** Postgres hatasının kısıt adı (`DrizzleQueryError` ise `cause` içinde). */
function constraintOf(err: unknown): string | undefined {
  const e = err as { constraint?: string; cause?: { constraint?: string } };
  return e?.constraint ?? e?.cause?.constraint;
}

describe("Faz 8 şeması: kapı ve bilet sütunları", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("yeni sütunlar boş bırakılabilir (eski kayıtlar)", async () => {
    const { reservation } = await bookedGuest();
    expect((await reservationRow(reservation.id)).checkInGate).toBeNull();
    const [log] = await db.insert(checkInEvents).values({ idempotencyKey: key(), outcome: "not_found" }).returning();
    expect([log?.ticketId, log?.gate]).toEqual([null, null]);
  });

  it.each([0, 10])("kapı %i rezervasyonda ve giriş kaydında reddedilir", async (gate) => {
    const { reservation } = await bookedGuest();
    expect(
      pgErrorCode(
        await rejection(db.update(reservations).set({ checkInGate: gate }).where(eq(reservations.id, reservation.id))),
      ),
    ).toBe("23514");
    expect(
      pgErrorCode(await rejection(db.insert(checkInEvents).values({ idempotencyKey: key(), outcome: "not_found", gate }))),
    ).toBe("23514");
  });

  it("kapı 1 ve 9 kabul edilir", async () => {
    const { reservation } = await bookedGuest();
    await db.update(reservations).set({ checkInGate: 9 }).where(eq(reservations.id, reservation.id));
    expect((await reservationRow(reservation.id)).checkInGate).toBe(9);
    const [log] = await db
      .insert(checkInEvents)
      .values({ idempotencyKey: key(), outcome: "not_found", gate: 1 })
      .returning();
    expect(log?.gate).toBe(1);
  });

  it("bir giriş kaydı hem rezervasyona hem bilete bağlanamaz", async () => {
    const te = await ticketedEvent();
    const { reservation } = await bookedGuest();
    const ticketId = te.tickets[0]!.ticketId;
    const err = await rejection(
      db.insert(checkInEvents).values({
        idempotencyKey: key(),
        outcome: "checked_in",
        reservationId: reservation.id,
        ticketId,
      }),
    );
    expect(pgErrorCode(err)).toBe("23514");
    expect(constraintOf(err)).toBe("check_in_events_single_target");
  });

  it("giriş kaydı olan bilet silinemez", async () => {
    const te = await ticketedEvent();
    const ticketId = te.tickets[0]!.ticketId;
    await db.insert(checkInEvents).values({ idempotencyKey: key(), outcome: "checked_in", ticketId, gate: 2 });
    expect((await ticketLog(ticketId)).map((l) => l.gate)).toEqual([2]);
    expect(pgErrorCode(await rejection(db.delete(tickets).where(eq(tickets.id, ticketId))))).toBe("23503");
  });

  it("ticketedEvent: iki masada üç bilet, hepsi issued ve QR'lı", async () => {
    const te = await ticketedEvent();
    expect(te.tickets.map((t) => t.tableLabel).sort()).toEqual(["B1", "B1", "B2"]);
    for (const t of te.tickets) {
      const row = await ticketRow(t.ticketId);
      expect(row.status).toBe("issued");
      expect(row.qrToken).not.toBeNull();
    }
    expect(te.order.pnr).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    expect(te.event.status).toBe("active");
    expect(te.tables.map((t) => t.label)).toEqual(["B1", "B2"]);
  });
});
