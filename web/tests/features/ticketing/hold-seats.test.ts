import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { orders, tableSeatSlots, tickets } from "@/db/schema";
import { createHold, type HoldItem } from "@/features/ticketing/orders-service";
import { truncateAll } from "../../helpers/db";
import { caughtSales, saleEvent } from "./fixtures";

const hold = (eventId: string, items: HoldItem[]) => createHold(db, { eventId, items, clientKey: randomUUID() });
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

async function rowCounts() {
  return { orders: (await db.select().from(orders)).length, tickets: (await db.select().from(tickets)).length };
}

/** Masanın etkin biletlerinin sandalye numaraları (artan): tickets ⨝ table_seat_slots. */
async function heldSeatNos(tableId: string): Promise<number[]> {
  const rows = await db
    .select({ seatNo: tableSeatSlots.seatNo })
    .from(tickets)
    .innerJoin(tableSeatSlots, eq(tickets.seatSlotId, tableSeatSlots.id))
    .where(and(eq(tickets.tableId, tableId), inArray(tickets.status, ["held", "issued"])))
    .orderBy(asc(tableSeatSlots.seatNo));
  return rows.map((r) => r.seatNo);
}

describe("numaralı sandalye tutma", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("seatNos verilen tutma tam o sandalyeleri alır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    await hold(event.id, [{ tableId: a1!.id, quantity: 2, seatNos: [4, 7] }]);
    expect(await heldSeatNos(a1!.id)).toEqual([4, 7]);
  });

  it("seatNos yoksa en küçük numaralı boş yuvalar seçilir", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    await hold(event.id, [{ tableId: a1!.id, quantity: 2, seatNos: [1, 3] }]);
    await hold(event.id, [{ tableId: a1!.id, quantity: 2 }]);
    expect(await heldSeatNos(a1!.id)).toEqual([1, 2, 3, 4]);
  });

  it("alınmış sandalye istenirse seats_unavailable; mesaj ve ayrıntı doğru, hiçbir satır yazılmaz", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    await hold(event.id, [{ tableId: a1!.id, quantity: 2, seatNos: [1, 2] }]);
    const before = await rowCounts();
    const err = await caughtSales(hold(event.id, [{ tableId: a1!.id, quantity: 2, seatNos: [2, 3] }]));
    expect(err.salesCode).toBe("seats_unavailable");
    expect(err.message).toBe("Seçtiğiniz sandalyelerden biri az önce alındı");
    expect(err.details).toEqual({ tableId: a1!.id, free: 6 });
    expect(await rowCounts()).toEqual(before);
  });

  it("yuva numaralarında boşluk: olmayan numara seats_unavailable, var olanlar alınır", async () => {
    const {
      event,
      tables: [t],
    } = await saleEvent({ tables: [{ capacity: 4 }], settings: { blockSingleLeftover: false } });
    await db
      .delete(tableSeatSlots)
      .where(and(eq(tableSeatSlots.tableId, t!.id), eq(tableSeatSlots.seatNo, 2)));
    const err = await caughtSales(hold(event.id, [{ tableId: t!.id, quantity: 2, seatNos: [2, 3] }]));
    expect(err.salesCode).toBe("seats_unavailable");
    expect(err.details).toEqual({ tableId: t!.id, free: 3 });
    await hold(event.id, [{ tableId: t!.id, quantity: 2, seatNos: [3, 4] }]);
    await hold(event.id, [{ tableId: t!.id, quantity: 1 }]);
    expect(await heldSeatNos(t!.id)).toEqual([1, 3, 4]);
  });

  it.each([
    ["masa bazlı kip", { settings: { saleMode: "table" } }, 8],
    ["loca", { tables: [{ isLoca: true, capacity: 6 }], settings: { locaOnline: true } }, 6],
    ["eski satır: seat + paylaşımsız", { settings: { saleMode: "seat", sharedTables: false } }, 8],
  ] as const)("%s: bütün satılan masada seatNos invalid ve hiçbir satır yazılmaz", async (_n, o, seats) => {
    const {
      event,
      tables: [t],
    } = await saleEvent({ ...o } as Parameters<typeof saleEvent>[0]);
    const err = await caughtSales(hold(event.id, [{ tableId: t!.id, quantity: seats, seatNos: range(seats) }]));
    expect(err.salesCode).toBe("invalid");
    expect(await rowCounts()).toEqual({ orders: 0, tickets: 0 });
  });

  it("masa bazlı kipte masa bütün satılır (shared_tables açık olsa da)", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ settings: { saleMode: "table", sharedTables: true } });
    const err = await caughtSales(hold(event.id, [{ tableId: a1!.id, quantity: 3 }]));
    expect(err.salesCode).toBe("whole_table_required");
    expect(err.details).toEqual({ tableId: a1!.id, seats: 8 });
    await hold(event.id, [{ tableId: a1!.id, quantity: 8 }]);
    expect(await heldSeatNos(a1!.id)).toEqual(range(8));
  });

  it("tek kalan sandalye kuralı seçimle de uygulanır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const err = await caughtSales(hold(event.id, [{ tableId: a1!.id, quantity: 7, seatNos: range(7) }]));
    expect(err.salesCode).toBe("leaves_single_seat");
    expect(err.details).toEqual({ tableId: a1!.id });
  });

  it("aynı masanın kalemleri birleşir; karışık, yinelenen ya da adetle uyuşmayan seçim invalid", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    await hold(event.id, [
      { tableId: a1!.id, quantity: 1, seatNos: [3] },
      { tableId: a1!.id, quantity: 1, seatNos: [5] },
    ]);
    expect(await heldSeatNos(a1!.id)).toEqual([3, 5]);
    for (const items of [
      [
        { tableId: a1!.id, quantity: 1, seatNos: [6] },
        { tableId: a1!.id, quantity: 1 },
      ],
      [
        { tableId: a1!.id, quantity: 1, seatNos: [6] },
        { tableId: a1!.id, quantity: 1, seatNos: [6] },
      ],
      [{ tableId: a1!.id, quantity: 2, seatNos: [6] }],
    ]) {
      expect((await caughtSales(hold(event.id, items))).salesCode).toBe("invalid");
    }
    expect(await heldSeatNos(a1!.id)).toEqual([3, 5]);
  });

  it("çok kalemli siparişte bir kalem reddedilirse hiçbir kalem yazılmaz", async () => {
    const {
      event,
      tables: [a, b],
    } = await saleEvent({ tables: [{ label: "A1" }, { label: "B1" }], settings: { blockSingleLeftover: false } });
    await hold(event.id, [{ tableId: b!.id, quantity: 1, seatNos: [1] }]);
    const err = await caughtSales(
      hold(event.id, [
        { tableId: a!.id, quantity: 2, seatNos: [1, 2] },
        { tableId: b!.id, quantity: 1, seatNos: [1] },
      ]),
    );
    expect(err.details).toEqual({ tableId: b!.id, free: 7 });
    expect(await heldSeatNos(a!.id)).toEqual([]);
  });

  it("aynı clientKey yinelemesi, sandalyeler artık dolu olsa da aynı siparişi döndürür", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const input = {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 2, seatNos: [3, 4] }],
      clientKey: randomUUID(),
    };
    const first = await createHold(db, input);
    expect((await createHold(db, input)).orderId).toBe(first.orderId);
    expect(await heldSeatNos(a1!.id)).toEqual([3, 4]);
  });
});
