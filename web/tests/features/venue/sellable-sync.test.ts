import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventTables, tableSeatSlots } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { closeRealtime } from "@/features/realtime/listener";
import { saveLayout, type EventTableRow } from "@/features/venue/service";
import type { TableInput } from "@/features/venue/schemas";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { openOnline } from "../../helpers/seating";
import { watchEvents } from "../realtime/emitted";

const decor = { width: 1600, height: 900, elements: [] };

function toInput(t: EventTableRow, patch: Partial<TableInput> = {}): TableInput {
  return {
    id: t.id,
    label: t.label,
    capacity: t.capacity,
    tableTypeId: t.tableTypeId,
    x: t.x,
    y: t.y,
    rotation: t.rotation,
    isLoca: t.isLoca,
    isVip: t.isVip,
    isPinned: t.isPinned,
    size: t.size,
    floor: t.floor,
    sortNumber: t.sortNumber,
    ...patch,
  };
}

async function seatNos(tableId: string): Promise<number[]> {
  const rows = await db
    .select({ n: tableSeatSlots.seatNo })
    .from(tableSeatSlots)
    .where(eq(tableSeatSlots.tableId, tableId))
    .orderBy(asc(tableSeatSlots.seatNo));
  return rows.map((r) => r.n);
}

async function reload(id: string) {
  const [row] = await db.select().from(eventTables).where(eq(eventTables.id, id));
  if (!row) throw new Error("masa yok");
  return row;
}

describe("yerleşim kaydı: satılabilir sayı ve yuva eşitleme", () => {
  let actor: Actor;

  beforeEach(async () => {
    await truncateAll();
    actor = await persistActor(db, managerActor("fnb"));
  });
  afterAll(async () => {
    await closeRealtime();
  });

  async function online(capacity: number, sellableSeats: number | null) {
    const event = await f.createEvent(db, { organizerId: actor.id });
    const table = await f.createTable(db, event.id, { label: "A1", capacity, sellableSeats, allocation: "pending" });
    await db.transaction((tx) => openOnline(tx, event.id, [table.id]));
    return { event, table };
  }

  it("kapasite satılabilirin altına inince satılabilir kapasiteye çekilir ve yuvalar eşitlenir", async () => {
    const { event, table } = await online(8, 6);
    expect(await seatNos(table.id)).toHaveLength(6);

    await saveLayout(db, actor, { eventId: event.id, tables: [toInput(table, { capacity: 4 })], decor });

    expect((await reload(table.id)).sellableSeats).toBe(4);
    expect(await seatNos(table.id)).toEqual([1, 2, 3, 4]);
  });

  it("satılabilir null ise kapasite değişince null kalır; yuvalar yeni kapasiteyi izler", async () => {
    const { event, table } = await online(8, null);

    await saveLayout(db, actor, { eventId: event.id, tables: [toInput(table, { capacity: 6 })], decor });
    expect((await reload(table.id)).sellableSeats).toBeNull();
    expect(await seatNos(table.id)).toHaveLength(6);

    await saveLayout(db, actor, { eventId: event.id, tables: [toInput(table, { capacity: 10 })], decor });
    expect((await reload(table.id)).sellableSeats).toBeNull();
    expect(await seatNos(table.id)).toHaveLength(10);
  });

  it("kapasite artınca kayıtlı satılabilir sayı değişmez", async () => {
    const { event, table } = await online(8, 6);

    await saveLayout(db, actor, { eventId: event.id, tables: [toInput(table, { capacity: 10 })], decor });

    expect((await reload(table.id)).sellableSeats).toBe(6);
    expect(await seatNos(table.id)).toHaveLength(6);
  });

  it("online olmayan masada kapasite düşünce de satılabilir çekilir, yuva oluşmaz", async () => {
    const event = await f.createEvent(db, { organizerId: actor.id });
    const table = await f.createTable(db, event.id, { label: "A1", capacity: 8, sellableSeats: 6, allocation: "pending" });

    await saveLayout(db, actor, { eventId: event.id, tables: [toInput(table, { capacity: 4 })], decor });

    expect((await reload(table.id)).sellableSeats).toBe(4);
    expect(await seatNos(table.id)).toEqual([]);
  });

  it("online masa yerleşimden silinince yuvaları da silinir", async () => {
    const { event, table } = await online(8, null);
    const other = await f.createTable(db, event.id, { label: "B1", capacity: 4, allocation: "pending" });

    await saveLayout(db, actor, { eventId: event.id, tables: [toInput(other)], decor });

    expect(await seatNos(table.id)).toEqual([]);
    expect(await db.select().from(eventTables).where(eq(eventTables.id, table.id))).toHaveLength(0);
  });

  it("saveLayout seats.changed yayar", async () => {
    const { event, table } = await online(8, null);
    const watch = await watchEvents(event.id);
    try {
      await watch.discardSetup();
      await saveLayout(db, actor, { eventId: event.id, tables: [toInput(table, { capacity: 6 })], decor });
      const types = await watch.settled();
      expect(types).toContain("table.updated");
      expect(types).toContain("seats.changed");
    } finally {
      watch.stop();
    }
  });
});
