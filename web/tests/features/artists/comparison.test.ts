import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { artists, events } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { getArtistHistory, listArtistComparison } from "@/features/artists/comparison";
import { managerActor } from "../../helpers/actors";
import { insertArchive } from "../../helpers/archive";
import { truncateAll } from "../../helpers/db";

beforeEach(truncateAll);

const actor = managerActor("entertainment");

async function makeArtist(name: string, key: string) {
  const [row] = await db.insert(artists).values({ name, nameKey: key }).returning();
  if (!row) throw new Error("sanatçı eklenemedi");
  return row;
}

describe("sanatçı karşılaştırması", () => {
  it("listArtistComparison: her kayıtlı sanatçı bir satır; arşivsiz sanatçı sıfırlarla", async () => {
    const sezen = await makeArtist("Sezen Aksu", "SEZEN AKSU");
    await makeArtist("Tarkan", "TARKAN");
    await insertArchive(db, { artistId: sezen.id, startsAt: new Date("2027-01-10T18:00:00Z") });
    await insertArchive(db, { artistId: sezen.id, startsAt: new Date("2027-03-10T18:00:00Z") });
    const rows = await listArtistComparison(db, actor);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ artist: { name: "Sezen Aksu" }, eventCount: 2, lastEventAt: new Date("2027-03-10T18:00:00Z") });
    expect(rows[0]!.totals[0]).toMatchObject({ currency: "TRY", eventCount: 2 });
    expect(rows[1]).toMatchObject({ artist: { name: "Tarkan" }, eventCount: 0, lastEventAt: null, totals: [] });
  });

  it("serbest metin sanatçılı arşiv hiçbir sanatçıya yazılmaz", async () => {
    await makeArtist("Sezen Aksu", "SEZEN AKSU");
    await insertArchive(db, { artistId: null, artistName: "Sezen Aksu", startsAt: new Date("2027-01-10T18:00:00Z") });
    const [row] = await listArtistComparison(db, actor);
    expect(row).toMatchObject({ eventCount: 0, lastEventAt: null, totals: [] });
  });

  it("arama ve pasif sanatçı süzgeci listArtists ile aynı", async () => {
    await makeArtist("Sezen Aksu", "SEZEN AKSU");
    await db.insert(artists).values({ name: "Eski", nameKey: "ESKI", isActive: false });
    expect((await listArtistComparison(db, actor)).map((r) => r.artist.name)).toEqual(["Sezen Aksu"]);
    expect((await listArtistComparison(db, actor, { includeInactive: true })).map((r) => r.artist.name)).toEqual([
      "Eski",
      "Sezen Aksu",
    ]);
    expect((await listArtistComparison(db, actor, { search: "sezen" })).map((r) => r.artist.name)).toEqual(["Sezen Aksu"]);
  });

  it("getArtistHistory: etkinlikler en yeni önce, toplamlar para birimi başına", async () => {
    const sezen = await makeArtist("Sezen Aksu", "SEZEN AKSU");
    await insertArchive(db, { artistId: sezen.id, eventName: "E1", startsAt: new Date("2027-01-10T18:00:00Z") });
    await insertArchive(db, { artistId: sezen.id, eventName: "E2", startsAt: new Date("2027-02-10T18:00:00Z"), currency: "EUR" });
    await insertArchive(db, { artistId: sezen.id, eventName: "E3", startsAt: new Date("2027-03-10T18:00:00Z") });
    const history = await getArtistHistory(db, actor, sezen.id);
    expect(history.artist.id).toBe(sezen.id);
    expect(history.events.map((e) => e.eventName)).toEqual(["E3", "E2", "E1"]);
    expect(history.totals.map((t) => t.currency)).toEqual(["EUR", "TRY"]);
    expect(history.totals[1]).toMatchObject({ eventCount: 2 });
  });

  it("getArtistHistory: olmayan sanatçı → not_found; izinsiz → ForbiddenError", async () => {
    for (const id of [randomUUID(), "abc"]) {
      await expect(getArtistHistory(db, actor, id)).rejects.toMatchObject({ code: "not_found", message: "Sanatçı bulunamadı" });
    }
    const sezen = await makeArtist("Sezen Aksu", "SEZEN AKSU");
    await expect(getArtistHistory(db, managerActor("fnb"), sezen.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listArtistComparison(db, managerActor("fnb"))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("sanatçı karşılaştırması ve geçmişi demo arşivini saymaz", async () => {
    const sezen = await makeArtist("Sezen Aksu", "SEZEN AKSU");
    const real = await insertArchive(db, { artistId: sezen.id, eventName: "Gerçek", startsAt: new Date("2027-01-10T18:00:00Z") });
    const demo = await insertArchive(db, { artistId: sezen.id, eventName: "Demo", startsAt: new Date("2027-02-10T18:00:00Z") });
    await db.update(events).set({ isDemo: true }).where(eq(events.id, demo.eventId));

    const rows = await listArtistComparison(db, actor);
    expect(rows[0]).toMatchObject({ eventCount: 1 });

    const history = await getArtistHistory(db, actor, sezen.id);
    expect(history.events.map((e) => e.eventId)).toEqual([real.eventId]);
  });
});
