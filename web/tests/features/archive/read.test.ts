import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { type ArchiveDetails, eventFinanceItems, eventTables, events } from "@/db/schema";
import { archiveEvent } from "@/features/archive/snapshot";
import { getArchiveView, listArchives, toArchiveSummary } from "@/features/archive/read";
import { ForbiddenError } from "@/features/auth/errors";
import { adminActor, managerActor, memberActor, noAccessActor } from "../../helpers/actors";
import { insertArchive, seedScenario } from "../../helpers/archive";
import { truncateAll } from "../../helpers/db";

beforeEach(truncateAll);

const actor = managerActor("entertainment");

describe("arşiv okuma", () => {
  it("toArchiveSummary: net demo içermez ve negatif olabilir", async () => {
    const row = await insertArchive(db, {
      startsAt: new Date("2027-01-10T18:00:00Z"),
      ticketRevenue: "550.50",
      demoTicketRevenue: "501.00",
      actualOtherIncome: "250.25",
      actualExpense: "1680.00",
      demoTicketsSold: 2,
    });
    expect(toArchiveSummary(row)).toMatchObject({ netActual: "-879.25", hasDemo: true });
  });

  it("toArchiveSummary: veritabanı varsayılanı '{}' olan details boş dizilerle tamamlanır", async () => {
    const row = await insertArchive(db, { startsAt: new Date(), details: {} as ArchiveDetails });
    expect(toArchiveSummary(row).details).toEqual({ categories: [], financeItems: [], gates: [] });
    const partial = await insertArchive(db, {
      startsAt: new Date(),
      details: { gates: [{ gate: 1, tickets: 2, reservations: 0 }] } as unknown as ArchiveDetails,
    });
    expect(toArchiveSummary(partial).details).toEqual({
      categories: [],
      financeItems: [],
      gates: [{ gate: 1, tickets: 2, reservations: 0 }],
    });
  });

  it("getArchiveView kaynak tablolar silinse/değişse de aynı görünümü döner", async () => {
    const s = await seedScenario(db);
    await db.transaction((tx) => archiveEvent(tx, s.event.id, null));
    const before = await getArchiveView(db, actor, s.event.id);
    await db
      .update(eventTables)
      .set({ label: sql`'X-' || ${eventTables.label}`, capacity: 99 })
      .where(eq(eventTables.eventId, s.event.id));
    await db.delete(eventFinanceItems).where(eq(eventFinanceItems.eventId, s.event.id));
    await db.update(events).set({ name: "Yeni Ad" }).where(eq(events.id, s.event.id));
    expect(await getArchiveView(db, actor, s.event.id)).toEqual(before);
    expect(before).toMatchObject({
      eventName: "Gala",
      netActual: "-879.25",
      rates: { occupancy: 42.9, attendance: 50, noShow: 50 },
    });
    expect(before.details.financeItems).toHaveLength(3);
  });

  it("listArchives: en yeni etkinlik önce, sayfalı, etkinlik ve sanatçı adında arar", async () => {
    await insertArchive(db, { startsAt: new Date("2027-01-01T18:00:00Z"), eventName: "Eski Gece" });
    await insertArchive(db, { startsAt: new Date("2027-03-01T18:00:00Z"), eventName: "Yeni Gece", artistName: "Tarkan" });
    await insertArchive(db, { startsAt: new Date("2027-02-01T18:00:00Z"), eventName: "Orta Gece" });
    const all = await listArchives(db, actor);
    expect(all.items.map((i) => i.eventName)).toEqual(["Yeni Gece", "Orta Gece", "Eski Gece"]);
    expect(all).toMatchObject({ total: 3, page: 1, pageSize: 20 });
    expect((await listArchives(db, actor, { search: "tark" })).items.map((i) => i.eventName)).toEqual(["Yeni Gece"]);
    expect((await listArchives(db, actor, { search: "orta" })).total).toBe(1);
    expect((await listArchives(db, actor, { search: "%" })).total).toBe(0);
    expect((await listArchives(db, actor, { page: 2 })).items).toEqual([]);
  });

  it("21 kayıtta ikinci sayfa kalan kaydı verir", async () => {
    for (let i = 0; i < 21; i++) {
      await insertArchive(db, { startsAt: new Date(Date.UTC(2027, 0, 1 + i, 18)), eventName: `G${i}` });
    }
    const p2 = await listArchives(db, actor, { page: 2 });
    expect(p2).toMatchObject({ total: 21, page: 2 });
    expect(p2.items.map((i) => i.eventName)).toEqual(["G0"]);
  });

  it("arşiv izni olmayanlar göremez", async () => {
    const id = (await insertArchive(db, { startsAt: new Date() })).eventId;
    for (const a of [managerActor("fnb"), managerActor("casino"), noAccessActor()]) {
      await expect(listArchives(db, a)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getArchiveView(db, a, id)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("yalnızca görüntüleme izni olan Entertainment kullanıcısı görür", async () => {
    const row = await insertArchive(db, { startsAt: new Date() });
    const viewer = memberActor("entertainment", { archive: "v---" });
    expect((await listArchives(db, viewer)).total).toBe(1);
    expect((await getArchiveView(db, viewer, row.eventId)).eventId).toBe(row.eventId);
    expect((await listArchives(db, adminActor())).total).toBe(1);
  });

  it("olmayan ya da geçersiz kimlik → not_found", async () => {
    for (const id of [randomUUID(), "abc"]) {
      await expect(getArchiveView(db, actor, id)).rejects.toMatchObject({ code: "not_found", message: "Arşiv kaydı bulunamadı" });
    }
  });
});
