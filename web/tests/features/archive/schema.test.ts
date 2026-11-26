import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { artists, eventArchives, events, orders } from "@/db/schema";
import { getArchiveRow, insertArchive, seedScenario } from "../../helpers/archive";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { pgErrorCode } from "../../helpers/factories";

beforeEach(truncateAll);

function caught(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => null,
    (e: unknown) => e,
  );
}

describe("arşiv şeması", () => {
  it("sanatçı ad anahtarı tekildir", async () => {
    await db.insert(artists).values({ name: "Sezen Aksu", nameKey: "SEZEN AKSU" });
    const err = await caught(db.insert(artists).values({ name: "sezen aksu", nameKey: "SEZEN AKSU" }));
    expect(pgErrorCode(err)).toBe("23505");
  });

  it("arşiv varsayılanları: sayılar 0, paralar '0.00', details {}, revision 1", async () => {
    const event = await f.createEvent(db, { status: "completed" });
    const [row] = await db
      .insert(eventArchives)
      .values({ eventId: event.id, archivedAt: new Date(), eventName: event.name, startsAt: event.startsAt })
      .returning();
    expect(row).toMatchObject({
      revision: 1,
      currency: "TRY",
      ticketsSold: 0,
      demoTicketsSold: 0,
      fnbStaffCount: 0,
      ticketRevenue: "0.00",
      demoTicketRevenue: "0.00",
      actualExpense: "0.00",
      artistFee: null,
      details: {},
    });
  });

  it("etkinlik başına tek arşiv satırı", async () => {
    const archived = await insertArchive(db, { startsAt: new Date() });
    const err = await caught(
      db.insert(eventArchives).values({
        eventId: archived.eventId,
        archivedAt: new Date(),
        eventName: "İkinci",
        startsAt: new Date(),
      }),
    );
    expect(pgErrorCode(err)).toBe("23505");
  });

  it("arşivi olan etkinlik silinemez", async () => {
    const archived = await insertArchive(db, { startsAt: new Date() });
    const err = await caught(db.delete(events).where(eq(events.id, archived.eventId)));
    expect(pgErrorCode(err)).toBe("23503");
  });

  it("sanatçı silinince etkinlikte ve arşivde kimlik boşalır, ad kalır", async () => {
    const [artist] = await db.insert(artists).values({ name: "Tarkan", nameKey: "TARKAN" }).returning();
    const event = await f.createEvent(db, { artistId: artist!.id, artistName: "Tarkan" });
    const archived = await insertArchive(db, { startsAt: new Date(), artistId: artist!.id, artistName: "Tarkan" });
    await db.delete(artists).where(eq(artists.id, artist!.id));
    expect((await db.select().from(events).where(eq(events.id, event.id)))[0]).toMatchObject({
      artistId: null,
      artistName: "Tarkan",
    });
    expect(await getArchiveRow(db, archived.eventId)).toMatchObject({ artistId: null, artistName: "Tarkan" });
  });

  it("seedScenario sözleşmedeki satırları kurar", async () => {
    const s = await seedScenario(db);
    expect(Object.keys(s.tables).sort()).toEqual(["C1", "C2", "O1", "O2", "P1"]);
    expect(s.orders.realO1.tickets).toHaveLength(3);
    expect(
      (await db.select().from(orders).where(eq(orders.eventId, s.event.id))).map((o) => o.isDemo).sort(),
    ).toEqual([false, false, true]);
    expect(await db.select().from(eventArchives)).toHaveLength(0);
  });
});
