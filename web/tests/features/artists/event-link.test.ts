import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { artists } from "@/db/schema";
import { eq } from "drizzle-orm";
import { artistActionDefs } from "@/features/artists/action-defs";
import { createArtist, updateArtist } from "@/features/artists/service";
import type { Actor } from "@/features/auth/session";
import { createEventSchema, updateEventSchema } from "@/features/events/schemas";
import { createEvent, updateEvent } from "@/features/events/service";
import { createAction } from "@/lib/action";
import { managerActor, noAccessActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

type Result = { ok: boolean; code?: string; data?: unknown };

function runOptions(actor: Actor | null) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return defineAction(artistActionDefs.options as never) as (raw: unknown) => Promise<Result>;
}

describe("etkinliğe sanatçı kaydı bağlama", () => {
  let actor: Actor;
  const mk = (artistName: string | undefined) =>
    createEvent(db, actor, createEventSchema.parse({ name: "Konser", startsAt: inDays(5), artistName }));

  beforeEach(async () => {
    await truncateAll();
    actor = await persistActor(db, managerActor("entertainment"));
  });

  it("kayıtlı sanatçının adı yazılınca etkinlik kayda bağlanır ve ad kaydın yazımıyla dolar", async () => {
    const artist = await createArtist(db, actor, { name: "Sezen Aksu" });
    const ev = await mk("  sezen   aksu ");
    expect(ev).toMatchObject({ artistId: artist.id, artistName: "Sezen Aksu" });
  });

  it("kayıtta olmayan ad serbest metin olarak kalır", async () => {
    const ev = await mk("Yerel Grup");
    expect(ev).toMatchObject({ artistId: null, artistName: "Yerel Grup" });
  });

  it("pasif sanatçıya bağlanmaz", async () => {
    const artist = await createArtist(db, actor, { name: "Sezen Aksu" });
    await db.update(artists).set({ isActive: false }).where(eq(artists.id, artist.id));
    const ev = await mk("sezen aksu");
    expect(ev).toMatchObject({ artistId: null, artistName: "sezen aksu" });
  });

  it("boş sanatçı adı bağı ve adı temizler", async () => {
    await createArtist(db, actor, { name: "Sezen Aksu" });
    const ev = await mk("Sezen Aksu");
    expect(ev.artistId).not.toBeNull();
    const saved = await updateEvent(
      db,
      actor,
      updateEventSchema.parse({ id: ev.id, name: "Konser", startsAt: ev.startsAt, artistName: "" }),
    );
    expect(saved).toMatchObject({ artistId: null, artistName: null });
  });

  it("güncellemede alan verilmezse bağ ve ad korunur", async () => {
    const artist = await createArtist(db, actor, { name: "Sezen Aksu" });
    const ev = await mk("Sezen Aksu");
    const saved = await updateEvent(
      db,
      actor,
      updateEventSchema.parse({ id: ev.id, name: "Konser 2", startsAt: ev.startsAt }),
    );
    expect(saved).toMatchObject({ artistId: artist.id, artistName: "Sezen Aksu" });
  });

  it("ad değişmeden kaydedilen etkinlik, sanatçı sonradan yeniden adlandırılmış olsa da bağını korur", async () => {
    const artist = await createArtist(db, actor, { name: "Sezen Aksu" });
    const ev = await mk("Sezen Aksu");
    await updateArtist(db, actor, { id: artist.id, name: "Sezen Aksu & Orkestra" });
    const saved = await updateEvent(
      db,
      actor,
      updateEventSchema.parse({ id: ev.id, name: "Konser 2", startsAt: ev.startsAt, artistName: "Sezen Aksu" }),
    );
    expect(saved).toMatchObject({ artistId: artist.id, artistName: "Sezen Aksu" });
  });

  it("bağsız serbest metin, sanatçı sonradan kaydedilince aynı metinle kaydedildiğinde bağlanır", async () => {
    const ev = await mk("Yerel Grup");
    const artist = await createArtist(db, actor, { name: "Yerel Grup" });
    const saved = await updateEvent(
      db,
      actor,
      updateEventSchema.parse({ id: ev.id, name: "Konser", startsAt: ev.startsAt, artistName: "Yerel Grup" }),
    );
    expect(saved).toMatchObject({ artistId: artist.id, artistName: "Yerel Grup" });
  });

  it("ad başka bir kayıtlı sanatçıya değişince bağ o sanatçıya geçer; kayıtsız ada değişince bağ kalkar", async () => {
    const a = await createArtist(db, actor, { name: "Sezen Aksu" });
    const b = await createArtist(db, actor, { name: "Tarkan" });
    const ev = await mk("Sezen Aksu");
    expect(ev.artistId).toBe(a.id);
    const toB = await updateEvent(
      db,
      actor,
      updateEventSchema.parse({ id: ev.id, name: "Konser", startsAt: ev.startsAt, artistName: "tarkan" }),
    );
    expect(toB).toMatchObject({ artistId: b.id, artistName: "Tarkan" });
    const free = await updateEvent(
      db,
      actor,
      updateEventSchema.parse({ id: ev.id, name: "Konser", startsAt: ev.startsAt, artistName: "Bilinmeyen" }),
    );
    expect(free).toMatchObject({ artistId: null, artistName: "Bilinmeyen" });
  });

  it("öneri eylemi yalnızca etkin sanatçıların kimlik ve adını döner", async () => {
    const suffix = randomUUID().slice(0, 8);
    const b = await createArtist(db, actor, { name: `Bora ${suffix}`, genre: "Pop", notes: "gizli" });
    const a = await createArtist(db, actor, { name: `Ahmet ${suffix}` });
    const off = await createArtist(db, actor, { name: `Pasif ${suffix}` });
    await db.update(artists).set({ isActive: false }).where(eq(artists.id, off.id));

    const viewer = await persistActor(db, managerActor("casino"));
    const result = await runOptions(viewer)({});
    expect(result.ok).toBe(true);
    expect(result.data).toEqual([
      { id: a.id, name: `Ahmet ${suffix}` },
      { id: b.id, name: `Bora ${suffix}` },
    ]);

    const none = await persistActor(db, noAccessActor());
    expect(await runOptions(none)({})).toMatchObject({ ok: false, code: "forbidden" });
  });
});
