import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db, type Tx } from "@/db/client";
import { eventTables, orders, tableSeatSlots } from "@/db/schema";
import { removeSeatSlots, syncSeatSlots } from "@/features/seating/slots";
import { inRollback } from "../../db/isolation";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { openOnline, setAllocation } from "../../helpers/seating";
import { createPendingHold, expireOrder } from "../../helpers/ticketing";
import { saleEvent } from "../ticketing/fixtures";

async function seatNos(ex: Pick<Tx, "select">, tableId: string): Promise<number[]> {
  const rows = await ex
    .select({ n: tableSeatSlots.seatNo })
    .from(tableSeatSlots)
    .where(eq(tableSeatSlots.tableId, tableId))
    .orderBy(tableSeatSlots.seatNo);
  return rows.map((r) => r.n);
}
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("sandalye yuvaları", () => {
  it("online masada effectiveSellable kadar yuva oluşur", () =>
    inRollback(async (tx) => {
      const e = await f.createEvent(tx);
      const a = await f.createTable(tx, e.id, { label: "A1", capacity: 8, allocation: "pending" });
      const b = await f.createTable(tx, e.id, { label: "A2", capacity: 8, sellableSeats: 5, allocation: "pending" });
      await openOnline(tx, e.id, [a.id, b.id]);
      expect(await seatNos(tx, a.id)).toEqual(range(8));
      expect(await seatNos(tx, b.id)).toEqual(range(5));
    }));

  it("azaltınca en yüksek numaralar silinir, artırınca devamı eklenir", () =>
    inRollback(async (tx) => {
      const e = await f.createEvent(tx);
      const t = await f.createTable(tx, e.id, { label: "A1", capacity: 8, allocation: "pending" });
      await openOnline(tx, e.id, [t.id]);
      await tx.update(eventTables).set({ sellableSeats: 5 }).where(eq(eventTables.id, t.id));
      await syncSeatSlots(tx, e.id);
      expect(await seatNos(tx, t.id)).toEqual(range(5));
      await tx.update(eventTables).set({ sellableSeats: 7 }).where(eq(eventTables.id, t.id));
      await syncSeatSlots(tx, e.id);
      expect(await seatNos(tx, t.id)).toEqual(range(7));
    }));

  it("yeniden çağırmak yuva kimliklerini değiştirmez", () =>
    inRollback(async (tx) => {
      const e = await f.createEvent(tx);
      const t = await f.createTable(tx, e.id, { label: "A1", capacity: 8, allocation: "pending" });
      await openOnline(tx, e.id, [t.id]);
      const ids = async () =>
        (await tx.select({ id: tableSeatSlots.id }).from(tableSeatSlots).where(eq(tableSeatSlots.tableId, t.id)))
          .map((r) => r.id)
          .sort();
      const before = await ids();
      await syncSeatSlots(tx, e.id);
      expect(await ids()).toEqual(before);
    }));

  it("online olmayan masaya dokunmaz", () =>
    inRollback(async (tx) => {
      const e = await f.createEvent(tx);
      const tables = [];
      for (const [i, allocation] of (["casino", "pending", "closed"] as const).entries()) {
        tables.push(await f.createTable(tx, e.id, { label: `T${i}`, allocation }));
      }
      await syncSeatSlots(tx, e.id);
      for (const t of tables) expect(await seatNos(tx, t.id)).toEqual([]);
    }));

  it("tableIds verilirse yalnızca o masalar eşitlenir", () =>
    inRollback(async (tx) => {
      const e = await f.createEvent(tx);
      const a1 = await f.createTable(tx, e.id, { label: "A1", capacity: 8 });
      const a2 = await f.createTable(tx, e.id, { label: "A2", capacity: 8 });
      await setAllocation(tx, [a1.id, a2.id], "online");
      await syncSeatSlots(tx, e.id, [a1.id]);
      expect(await seatNos(tx, a1.id)).toHaveLength(8);
      expect(await seatNos(tx, a2.id)).toHaveLength(0);
    }));

  it("removeSeatSlots masanın tüm yuvalarını siler", () =>
    inRollback(async (tx) => {
      const e = await f.createEvent(tx);
      const a1 = await f.createTable(tx, e.id, { label: "A1", capacity: 8 });
      const a2 = await f.createTable(tx, e.id, { label: "A2", capacity: 8 });
      await openOnline(tx, e.id, [a1.id, a2.id]);
      await removeSeatSlots(tx, e.id, [a1.id]);
      expect(await seatNos(tx, a1.id)).toEqual([]);
      expect(await seatNos(tx, a2.id)).toEqual(range(8));
    }));

  it("silinemeyen yuva conflict hatasına çevrilir", () =>
    inRollback(async (tx) => {
      const e = await f.createEvent(tx);
      const t = await f.createTable(tx, e.id, { label: "A1", capacity: 8 });
      await openOnline(tx, e.id, [t.id]);
      await tx.execute(sql`create table slot_ref_test (
        table_id uuid not null, slot_id uuid not null,
        foreign key (table_id, slot_id) references table_seat_slots (table_id, id)
      )`);
      await tx.execute(sql`insert into slot_ref_test select table_id, id from table_seat_slots
        where table_id = ${t.id} and seat_no = 8`);
      await tx.update(eventTables).set({ sellableSeats: 5 }).where(eq(eventTables.id, t.id));
      const msg = "Satılmış ya da tutulan sandalye sayısının altına inilemez: A1";
      await expect(syncSeatSlots(tx, e.id)).rejects.toMatchObject({ code: "conflict", message: msg });
      await expect(removeSeatSlots(tx, e.id, [t.id])).rejects.toMatchObject({ code: "conflict", message: msg });
      // Hata sonrası işlem kullanılabilir kalır (kayıt noktası geri alındı).
      expect(await seatNos(tx, t.id)).toEqual(range(8));
    }));
});

describe("sandalye yuvaları: eşzamanlılık", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("eşzamanlı iki eşitleme yuva sayısını bozmaz", async () => {
    const e = await f.createEvent(db);
    const t = await f.createTable(db, e.id, { label: "A1", capacity: 8 });
    await setAllocation(db, [t.id], "online");
    const run = () => db.transaction((tx) => syncSeatSlots(tx, e.id, [t.id]));
    const results = await Promise.allSettled([run(), run()]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
    const nos = await seatNos(db, t.id);
    expect(nos).toEqual(range(8));
    expect(new Set(nos).size).toBe(8);
  });
});

describe("removeSeatSlots: süresi dolmuş tutmalar", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("süresi dolmuş ama süpürülmemiş tutma yuva silmeyi engellemez; canlı tutma engeller", async () => {
    const {
      event,
      tables: [a1, a2],
    } = await saleEvent({ tables: [{ label: "A1" }, { label: "A2" }], settings: { blockSingleLeftover: false } });
    const stale = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    await expireOrder(db, stale.orderId);
    await createPendingHold(db, { eventId: event.id, items: [{ tableId: a2!.id, quantity: 2 }] });

    await db.transaction((tx) => removeSeatSlots(tx, event.id, [a1!.id]));
    expect(await seatNos(db, a1!.id)).toEqual([]);
    const [row] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, stale.orderId));
    expect(row?.status).toBe("expired");

    await expect(db.transaction((tx) => removeSeatSlots(tx, event.id, [a2!.id]))).rejects.toMatchObject({
      code: "conflict",
    });
    expect(await seatNos(db, a2!.id)).toEqual(range(8));
  });
});
