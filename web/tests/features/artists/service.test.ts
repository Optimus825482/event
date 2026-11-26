import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { artists, events } from "@/db/schema";
import { createArtistSchema } from "@/features/artists/schemas";
import { createArtist, deleteArtist, listArtists, updateArtist } from "@/features/artists/service";
import { ForbiddenError } from "@/features/auth/errors";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { managerActor } from "../../helpers/actors";
import { insertArchive } from "../../helpers/archive";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

async function expectDomain(promise: Promise<unknown>, code: string, message: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DomainError);
  expect(error).toMatchObject({ code, message });
}

describe("sanatçı servisi", () => {
  let actor: Actor;
  beforeEach(async () => {
    await truncateAll();
    actor = managerActor("entertainment");
  });

  it("sanatçı oluşturur; ad kırpılır, anahtar yazılır", async () => {
    const row = await createArtist(
      db,
      actor,
      createArtistSchema.parse({ name: "  Sezen  Aksu ", genre: "Pop", notes: "" }),
    );
    expect(row).toMatchObject({ name: "Sezen  Aksu", nameKey: "SEZEN AKSU", genre: "Pop", notes: null, isActive: true });
  });

  it("yalnızca yazımı farklı ikinci kayıt reddedilir", async () => {
    await createArtist(db, actor, { name: "Sezen Aksu" });
    await expectDomain(createArtist(db, actor, { name: "sezen  aksu" }), "conflict", "Bu adla bir sanatçı zaten kayıtlı");
    expect(await db.select().from(artists)).toHaveLength(1);
  });

  it("ad değişince anahtar da değişir; başka sanatçının adına çakışma reddedilir", async () => {
    const a = await createArtist(db, actor, { name: "Sezen Aksu" });
    await createArtist(db, actor, { name: "Tarkan" });
    const row = await updateArtist(db, actor, { id: a.id, name: "Mor ve Ötesi" });
    expect(row.nameKey).toBe("MOR VE ÖTESİ");
    await expectDomain(
      updateArtist(db, actor, { id: a.id, name: "tarkan" }),
      "conflict",
      "Bu adla bir sanatçı zaten kayıtlı",
    );
  });

  it("isActive verilmezse korunur, false ile pasife alınır; boş tür/not temizlenir", async () => {
    const a = await createArtist(db, actor, { name: "Tarkan", genre: "Pop", notes: "not" });
    const same = await updateArtist(db, actor, { id: a.id, name: "Tarkan" });
    expect(same).toMatchObject({ isActive: true, genre: null, notes: null });
    const off = await updateArtist(db, actor, { id: a.id, name: "Tarkan", isActive: false });
    expect(off.isActive).toBe(false);
    const kept = await updateArtist(db, actor, { id: a.id, name: "Tarkan" });
    expect(kept.isActive).toBe(false);
  });

  it("olmayan sanatçı → not_found", async () => {
    const id = randomUUID();
    await expectDomain(updateArtist(db, actor, { id, name: "X" }), "not_found", "Sanatçı bulunamadı");
    await expectDomain(deleteArtist(db, actor, { id }), "not_found", "Sanatçı bulunamadı");
  });

  it("arşivde etkinliği olan sanatçı silinemez", async () => {
    const a = await createArtist(db, actor, { name: "Tarkan" });
    await insertArchive(db, { startsAt: new Date(), artistId: a.id, artistName: "Tarkan" });
    await expectDomain(
      deleteArtist(db, actor, { id: a.id }),
      "conflict",
      "Arşivde etkinliği olan sanatçı silinemez; pasife alın",
    );
    expect(await db.select().from(artists)).toHaveLength(1);
  });

  it("arşivi olmayan sanatçı silinir; bağlı etkinlikte kimlik boşalır, ad kalır", async () => {
    const a = await createArtist(db, actor, { name: "Tarkan" });
    const event = await f.createEvent(db);
    await db.update(events).set({ artistId: a.id, artistName: "Tarkan" }).where(eq(events.id, event.id));
    expect(await deleteArtist(db, actor, { id: a.id })).toEqual({ id: a.id });
    expect(await db.select().from(artists)).toHaveLength(0);
    const [after] = await db.select().from(events).where(eq(events.id, event.id));
    expect(after).toMatchObject({ artistId: null, artistName: "Tarkan" });
  });

  it("listArtists: ad sırasıyla, pasifler varsayılan olarak gizli, arama büyük/küçük harf duyarsız", async () => {
    await createArtist(db, actor, { name: "Tarkan" });
    const sezen = await createArtist(db, actor, { name: "Sezen Aksu" });
    const old = await createArtist(db, actor, { name: "Ajda Pekkan" });
    await updateArtist(db, actor, { id: old.id, name: "Ajda Pekkan", isActive: false });

    expect((await listArtists(db, actor)).map((r) => r.name)).toEqual(["Sezen Aksu", "Tarkan"]);
    expect((await listArtists(db, actor, { includeInactive: true })).map((r) => r.name)).toEqual([
      "Ajda Pekkan",
      "Sezen Aksu",
      "Tarkan",
    ]);
    expect((await listArtists(db, actor, { search: "sezen" })).map((r) => r.id)).toEqual([sezen.id]);
    expect(await listArtists(db, actor, { search: "100%" })).toHaveLength(0);
    await expect(listArtists(db, managerActor("fnb"))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("aramada %, _ joker değil, düz metindir", async () => {
    await createArtist(db, actor, { name: "A_B" });
    await createArtist(db, actor, { name: "AXB" });
    const names = async (search: string) => (await listArtists(db, actor, { search })).map((r) => r.name);
    expect(await names("a_b")).toEqual(["A_B"]);
    expect(await names("_")).toEqual(["A_B"]);
    expect(await names("%")).toEqual([]);
  });

  it("eşzamanlı aynı ad: biri conflict", async () => {
    const results = await Promise.allSettled([
      createArtist(db, actor, { name: "Tarkan" }),
      createArtist(db, actor, { name: "tarkan" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected).toMatchObject({ reason: { code: "conflict", message: "Bu adla bir sanatçı zaten kayıtlı" } });
    expect(await db.select().from(artists)).toHaveLength(1);
  });
});
