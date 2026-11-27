import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import type { Tx } from "@/db/client";
import {
  artists,
  eventSaleSettings,
  eventSeatPrices,
  eventSiteContent,
  eventTables,
  events,
} from "@/db/schema";
import { SALE_CATEGORIES, type SaleCategory } from "@/domain/seating";
import { artistNameKey } from "@/features/artists/name-key";
import type { Actor } from "@/features/auth/session";
import { syncSeatSlots } from "@/features/seating/slots";
import { saveImage } from "@/features/uploads/images";
import { UPLOAD_ROOT } from "@/features/uploads/root";
import { writeLayout } from "@/features/venue/layout-core";
import {
  DEMO_ASSET_DIR,
  DEMO_CONCERTS,
  DEMO_DESCRIPTION,
  concertTimes,
  demoPrices,
  type DemoConcert,
} from "./concerts";
import { diamondLayout, diamondUnits } from "./diamond-plan";

export type SeedContext = {
  now: Date;
  uploadRoot: string;
  assetRoot: string;
  concerts: readonly DemoConcert[];
  written: string[];
};

export function defaultSeedContext(o?: Partial<SeedContext>): SeedContext {
  return {
    now: o?.now ?? new Date(),
    uploadRoot: o?.uploadRoot ?? UPLOAD_ROOT,
    assetRoot: o?.assetRoot ?? path.join(process.cwd(), DEMO_ASSET_DIR),
    concerts: o?.concerts ?? DEMO_CONCERTS,
    written: o?.written ?? [],
  };
}

async function saveAsset(
  ctx: SeedContext,
  fileName: string,
  kind: "event" | "artist",
): Promise<string> {
  const bytes = await readFile(path.join(ctx.assetRoot, fileName));
  const { path: saved } = await saveImage(new File([bytes], fileName), kind, ctx.uploadRoot);
  ctx.written.push(saved);
  return saved;
}

/**
 * Demo konserlerini ve Diamond salon planını çekirdeğe gerçek etkinlik satırları olarak tohumlar.
 * Çağıran danışma kilidini almış ve yetkiyi denetlemiş olmalıdır.
 */
export async function seedDemoData(
  tx: Tx,
  actor: Actor,
  ctx: SeedContext,
): Promise<{ seeded: boolean; eventIds: string[] }> {
  const [existingDemo] = await tx
    .select({ id: events.id })
    .from(events)
    .where(eq(events.isDemo, true))
    .limit(1);
  if (existingDemo) {
    return { seeded: false, eventIds: [] };
  }

  const { tables, decor } = diamondLayout();
  const units = diamondUnits();
  const labelsByCategory: Record<SaleCategory, string[]> = {
    standard: [],
    premium: [],
    vip: [],
  };
  for (const unit of units) {
    labelsByCategory[unit.category].push(unit.label);
  }

  const eventIds: string[] = [];

  for (const concert of ctx.concerts) {
    const nameKey = artistNameKey(concert.artistName);
    let [artist] = await tx
      .select({ id: artists.id, image: artists.image })
      .from(artists)
      .where(eq(artists.nameKey, nameKey))
      .limit(1);

    if (!artist) {
      const artistImg = await saveAsset(ctx, concert.artistImage, "artist");
      const [inserted] = await tx
        .insert(artists)
        .values({
          name: concert.artistName,
          nameKey,
          image: artistImg,
          isDemo: true,
        })
        .returning({ id: artists.id, image: artists.image });
      artist = inserted!;
    } else if (!artist.image) {
      const artistImg = await saveAsset(ctx, concert.artistImage, "artist");
      await tx.update(artists).set({ image: artistImg }).where(eq(artists.id, artist.id));
    }

    const posterPath = await saveAsset(ctx, concert.poster, "event");
    const heroPath = await saveAsset(ctx, concert.hero, "event");
    const { startsAt, endsAt, doorsOpenAt } = concertTimes(ctx.now, concert);

    const [createdEvent] = await tx
      .insert(events)
      .values({
        name: concert.name,
        description: DEMO_DESCRIPTION,
        startsAt,
        endsAt,
        status: "published",
        planningStage: "on_sale",
        stageChangedAt: ctx.now,
        eventType: "Konser",
        coverImage: posterPath,
        organizerId: actor.id,
        reservationEnabled: false,
        artistName: concert.artistName,
        artistId: artist.id,
        isDemo: true,
      })
      .returning({ id: events.id });
    const eventId = createdEvent!.id;

    await writeLayout(tx, eventId, tables, decor);

    for (const category of SALE_CATEGORIES) {
      const labels = labelsByCategory[category];
      if (labels.length === 0) continue;
      await tx
        .update(eventTables)
        .set({ saleCategory: category, allocation: "online" })
        .where(and(eq(eventTables.eventId, eventId), inArray(eventTables.label, labels)));
    }

    await syncSeatSlots(tx, eventId);

    const prices = demoPrices(concert.basePrice);
    await tx.insert(eventSeatPrices).values(
      SALE_CATEGORIES.map((category) => ({
        eventId,
        category,
        finalPrice: prices[category],
        finalSetBy: actor.id,
        finalSetAt: ctx.now,
      })),
    );

    await tx.insert(eventSaleSettings).values({
      eventId,
      saleMode: "seat",
      sharedTables: true,
      locaOnline: true,
      blockSingleLeftover: true,
      holdMinutes: 10,
      maxSeatsPerOrder: 12,
      currency: "TRY",
      saleStartsAt: null,
      updatedBy: actor.id,
    });

    await tx.insert(eventSiteContent).values({
      eventId,
      heroImage: heroPath,
      summary: concert.summary,
      doorsOpenAt,
      ageLimit: "18+",
      dressCode: "Şık",
      sightlineSet: "diamond",
    });

    eventIds.push(eventId);
  }

  return { seeded: true, eventIds };
}
