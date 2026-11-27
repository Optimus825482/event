import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { artists, eventTables, events, systemSettings } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { DEMO_ASSET_DIR } from "@/features/demo/concerts";
import {
  deleteDemoData,
  getDemoStatus,
  resetDemoData,
  setSalesDemoEnabled,
} from "@/features/demo/service";
import { adminActor, managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createEvent } from "../../helpers/factories";
import { createPaidOrder } from "../../helpers/ticketing";
import { filesUnder, oneConcert, tmpUploadRoot } from "./fixtures";

describe("demo servisi", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("ilk açılış tohumlar ve anahtarı açar", async () => {
    const admin = await persistActor(db, adminActor());
    const ctx = { uploadRoot: await tmpUploadRoot(), concerts: oneConcert() };

    const status = await setSalesDemoEnabled(db, admin, { enabled: true }, ctx);
    expect(status).toEqual({ enabled: true, eventCount: 1, orderCount: 0 });

    const [row] = await db.select().from(systemSettings);
    expect(row?.salesDemoEnabled).toBe(true);
  });

  it("kapatmak hiçbir şeyi silmez; yeniden açmak yeniden tohumlamaz", async () => {
    const admin = await persistActor(db, adminActor());
    const ctx = { uploadRoot: await tmpUploadRoot(), concerts: oneConcert() };

    await setSalesDemoEnabled(db, admin, { enabled: true }, ctx);
    const [firstEv] = await db.select().from(events).where(eq(events.isDemo, true));
    const filesAfterOpen = await filesUnder(ctx.uploadRoot);

    const closed = await setSalesDemoEnabled(db, admin, { enabled: false }, ctx);
    expect(closed).toEqual({ enabled: false, eventCount: 1, orderCount: 0 });
    expect(await filesUnder(ctx.uploadRoot)).toEqual(filesAfterOpen);

    const reopened = await setSalesDemoEnabled(db, admin, { enabled: true }, ctx);
    expect(reopened).toEqual({ enabled: true, eventCount: 1, orderCount: 0 });
    const demoEvents = await db.select().from(events).where(eq(events.isDemo, true));
    expect(demoEvents).toHaveLength(1);
    expect(demoEvents[0]!.id).toBe(firstEv!.id);
  });

  it("eşzamanlı iki açma tek tohum üretir", async () => {
    const admin = await persistActor(db, adminActor());
    const uploadRoot = await tmpUploadRoot();

    const [a, b] = await Promise.all([
      setSalesDemoEnabled(db, admin, { enabled: true }, { uploadRoot }),
      setSalesDemoEnabled(db, admin, { enabled: true }, { uploadRoot }),
    ]);

    expect(a).toEqual({ enabled: true, eventCount: 5, orderCount: 0 });
    expect(b).toEqual({ enabled: true, eventCount: 5, orderCount: 0 });

    const [demoEvRow] = await db.select({ value: count() }).from(events).where(eq(events.isDemo, true));
    const [tblRow] = await db.select({ value: count() }).from(eventTables);
    const [artRow] = await db.select({ value: count() }).from(artists);
    expect(Number(demoEvRow?.value ?? 0)).toBe(5);
    expect(Number(tblRow?.value ?? 0)).toBe(865);
    expect(Number(artRow?.value ?? 0)).toBe(5);
    expect(await filesUnder(uploadRoot)).toHaveLength(15);
  });

  it("tohumlama yarıda kesilirse hiçbir şey kalmaz", async () => {
    const admin = await persistActor(db, adminActor());
    const uploadRoot = await tmpUploadRoot();
    const brokenAssetRoot = await mkdir(path.join(os.tmpdir(), `ef-broken-assets-${Date.now()}`), {
      recursive: true,
    }).then(async () => {
      const dir = path.join(os.tmpdir(), `ef-broken-assets-${Date.now()}`);
      await mkdir(dir, { recursive: true });
      const srcDir = path.resolve(process.cwd(), DEMO_ASSET_DIR);
      await writeFile(path.join(dir, "levent-poster.webp"), await readFile(path.join(srcDir, "levent-poster.webp")));
      await writeFile(path.join(dir, "levent-artist.jpg"), await readFile(path.join(srcDir, "levent-artist.jpg")));
      return dir;
    });

    await expect(
      setSalesDemoEnabled(db, admin, { enabled: true }, {
        uploadRoot,
        assetRoot: brokenAssetRoot,
        concerts: oneConcert(),
      }),
    ).rejects.toThrow();

    const [demoEvRow] = await db.select({ value: count() }).from(events).where(eq(events.isDemo, true));
    const [artRow] = await db.select({ value: count() }).from(artists);
    const [settings] = await db.select().from(systemSettings);
    expect(Number(demoEvRow?.value ?? 0)).toBe(0);
    expect(Number(artRow?.value ?? 0)).toBe(0);
    expect(settings?.salesDemoEnabled ?? false).toBe(false);
    expect(await filesUnder(uploadRoot)).toEqual([]);
  });

  it("sıfırlama siler ve yeniden tohumlar; anahtar değişmez", async () => {
    const admin = await persistActor(db, adminActor());
    const ctx = { uploadRoot: await tmpUploadRoot(), concerts: oneConcert() };

    await setSalesDemoEnabled(db, admin, { enabled: true }, ctx);
    const [oldEv] = await db.select().from(events).where(eq(events.isDemo, true));
    const [oldTable] = await db.select().from(eventTables).where(eq(eventTables.eventId, oldEv!.id));
    await createPaidOrder(db, { eventId: oldEv!.id, items: [{ tableId: oldTable!.id, quantity: 2 }] });
    const oldFiles = await filesUnder(ctx.uploadRoot);
    expect(oldFiles).toHaveLength(3);

    const status = await resetDemoData(db, admin, ctx);
    expect(status).toEqual({ enabled: true, eventCount: 1, orderCount: 0 });

    const [newEv] = await db.select().from(events).where(eq(events.isDemo, true));
    expect(newEv!.id).not.toBe(oldEv!.id);

    const newFiles = await filesUnder(ctx.uploadRoot);
    expect(newFiles).toHaveLength(3);
    for (const f of oldFiles) {
      expect(newFiles).not.toContain(f);
    }
  });

  it("sıfırlama anahtar kapalıyken de çalışır ve kapalı bırakır", async () => {
    const admin = await persistActor(db, adminActor());
    const ctx = { uploadRoot: await tmpUploadRoot(), concerts: oneConcert() };

    const status = await resetDemoData(db, admin, ctx);
    expect(status).toEqual({ enabled: false, eventCount: 1, orderCount: 0 });
  });

  it("silme her şeyi kaldırır, dosyaları siler ve anahtarı kapatır", async () => {
    const admin = await persistActor(db, adminActor());
    const ctx = { uploadRoot: await tmpUploadRoot(), concerts: oneConcert() };

    await setSalesDemoEnabled(db, admin, { enabled: true }, ctx);
    expect(await filesUnder(ctx.uploadRoot)).toHaveLength(3);

    const status = await deleteDemoData(db, admin, ctx);
    expect(status).toEqual({ enabled: false, eventCount: 0, orderCount: 0 });
    expect(await filesUnder(ctx.uploadRoot)).toEqual([]);
  });

  it("silme gerçek sanatçının görsel dosyasını bırakır", async () => {
    const admin = await persistActor(db, adminActor());
    const ctx = { uploadRoot: await tmpUploadRoot(), concerts: oneConcert() };

    await setSalesDemoEnabled(db, admin, { enabled: true }, ctx);
    const [demoEv] = await db.select().from(events).where(eq(events.isDemo, true));
    const [demoArt] = await db.select().from(artists).where(eq(artists.id, demoEv!.artistId!));
    await createEvent(db, { artistId: demoArt!.id, artistName: demoArt!.name });

    await deleteDemoData(db, admin, ctx);
    const files = await filesUnder(ctx.uploadRoot);
    expect(files).toEqual([demoArt!.image!]);
  });

  it("yönetici olmayan hiçbirini çağıramaz", async () => {
    const manager = await persistActor(db, managerActor("entertainment"));
    const ctx = { uploadRoot: await tmpUploadRoot(), concerts: oneConcert() };

    await expect(getDemoStatus(db, manager)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setSalesDemoEnabled(db, manager, { enabled: true }, ctx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(resetDemoData(db, manager, ctx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteDemoData(db, manager, ctx)).rejects.toBeInstanceOf(ForbiddenError);

    const [evRow] = await db.select({ value: count() }).from(events);
    expect(Number(evRow?.value ?? 0)).toBe(0);
  });
});
