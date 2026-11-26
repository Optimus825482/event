import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventTables, tableSeatSlots, tickets } from "@/db/schema";
import { setSaleAllocation } from "@/features/seating/allocation-service";
import { syncSeatSlots } from "@/features/seating/slots";
import { releaseHold } from "@/features/ticketing/orders-service";
import { DomainError } from "@/lib/action";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createPaidOrder, createPendingHold, expireOrder } from "../../helpers/ticketing";
import { activeTickets, saleEvent } from "./fixtures";

async function slotsOf(tableId: string) {
  return db
    .select({ id: tableSeatSlots.id, seatNo: tableSeatSlots.seatNo })
    .from(tableSeatSlots)
    .where(eq(tableSeatSlots.tableId, tableId))
    .orderBy(asc(tableSeatSlots.seatNo));
}

async function setSellable(tableId: string, sellableSeats: number): Promise<void> {
  await db.update(eventTables).set({ sellableSeats }).where(eq(eventTables.id, tableId));
}

const ticketSnapshot = async (tableId: string) =>
  (await activeTickets(tableId))
    .map((t) => ({ id: t.id, status: t.status, seatSlotId: t.seatSlotId }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));

describe("yuva azaltma satılanı korur", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("satılabilir sayı düşürülünce yalnızca boş yuvalar silinir; biletler yerinde kalır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const holds = [];
    for (let i = 0; i < 3; i += 1) {
      holds.push(
        await createPendingHold(db, {
          eventId: event.id,
          items: [{ tableId: a1!.id, quantity: 1 }],
        }),
      );
    }
    await releaseHold(db, holds[1]!.orderId);
    const before = await ticketSnapshot(a1!.id);
    expect(before).toHaveLength(2);
    const slots = await slotsOf(a1!.id);
    const seatNoOf = new Map(slots.map((s) => [s.id, s.seatNo]));
    expect(before.map((t) => seatNoOf.get(t.seatSlotId!)).sort()).toEqual([1, 3]);

    await setSellable(a1!.id, 2);
    await db.transaction((tx) => syncSeatSlots(tx, event.id, [a1!.id]));

    const after = await slotsOf(a1!.id);
    expect(after).toHaveLength(2);
    expect(after.map((s) => s.id).sort()).toEqual(before.map((t) => t.seatSlotId!).sort());
    expect(after.map((s) => s.seatNo)).toEqual([1, 3]);
    expect(await ticketSnapshot(a1!.id)).toEqual(before);
  });

  it("satılabilir sayı etkin bilet sayısının altına inemez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    await createPaidOrder(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 3 }],
    });
    await createPendingHold(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 2 }],
    });
    const before = await ticketSnapshot(a1!.id);
    expect(before).toHaveLength(5);

    await setSellable(a1!.id, 4);
    const err = await db
      .transaction((tx) => syncSeatSlots(tx, event.id, [a1!.id]))
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe("conflict");
    expect((err as DomainError).message).toBe("Satılmış ya da tutulan sandalye sayısının altına inilemez: A1");
    expect(await slotsOf(a1!.id)).toHaveLength(8);
    expect(await ticketSnapshot(a1!.id)).toEqual(before);
  });

  it("süresi dolmuş tutma yuva azaltmayı engellemez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 8 }],
    });
    await expireOrder(db, hold.orderId);

    await setSellable(a1!.id, 2);
    await db.transaction((tx) => syncSeatSlots(tx, event.id, [a1!.id]));

    expect(await slotsOf(a1!.id)).toHaveLength(2);
    const old = await db.select().from(tickets).where(eq(tickets.orderId, hold.orderId));
    expect(old).toHaveLength(8);
    expect(old.every((t) => t.status === "expired" && t.seatSlotId === null)).toBe(true);
  });

  it("bileti olan masa satıştan çekilemez; satırlar değişmez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    await createPaidOrder(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 2 }],
    });
    const before = await ticketSnapshot(a1!.id);
    const actor = await persistActor(db, managerActor("entertainment"));

    await expect(
      setSaleAllocation(db, actor, {
        eventId: event.id,
        tableIds: [a1!.id],
        allocation: "closed",
      }),
    ).rejects.toThrow();

    const [row] = await db.select().from(eventTables).where(eq(eventTables.id, a1!.id));
    expect(row?.allocation).toBe("online");
    expect(await slotsOf(a1!.id)).toHaveLength(8);
    expect(await ticketSnapshot(a1!.id)).toEqual(before);
  });
});
