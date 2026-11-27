import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { artists, eventSiteContent } from "@/db/schema";
import type { SaleMode } from "@/domain/seating";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { getEventOrThrow } from "@/features/events/service";
import { SIGHTLINE_SETS, type SaleState, type SightlineSet } from "@/features/sales-api/contract";
import { getSaleSettings } from "@/features/seating/settings-service";
import { saleStateOf } from "@/features/ticketing/sale-state";
import { DomainError } from "@/lib/action";
import { imageStatusOf, validImagePath, type ImageStatus } from "./image-status";
import type { SaveSiteContentInput } from "./schemas";

export type SiteContentView = {
  eventId: string;
  eventName: string;
  startsAt: string;
  isDemo: boolean;
  siteState: SaleState | null;
  saleMode: SaleMode;
  coverImage: string | null;
  heroImage: string | null;
  artist: { id: string; name: string; image: string | null } | null;
  summary: string | null;
  doorsOpenAt: string | null;
  ageLimit: string | null;
  dressCode: string | null;
  sightlineSet: SightlineSet | null;
  images: ImageStatus;
};

/** Etkinliğin satış sitesi içeriğini ve görsel durumunu okur.
 * `providerActive` gerçek etkinliklerin genel sağlayıcısıdır; demo etkinlik `providerForEvent` gereği
 * her zaman demo sağlayıcıyla satılır.
 */
export async function getSiteContentView(
  ex: Db | Tx,
  actor: Actor,
  eventId: string,
  ctx: { now: Date; providerActive: boolean },
): Promise<SiteContentView> {
  authorize(actor, "events", "view");
  const event = await getEventOrThrow(ex, eventId);

  const [settings, siteRows, artistRows] = await Promise.all([
    getSaleSettings(ex, eventId),
    ex.select().from(eventSiteContent).where(eq(eventSiteContent.eventId, eventId)),
    event.artistId
      ? ex
          .select({ id: artists.id, name: artists.name, image: artists.image })
          .from(artists)
          .where(eq(artists.id, event.artistId))
      : Promise.resolve([]),
  ]);

  const siteRow = siteRows[0];
  const artistRow = artistRows[0];
  const siteState = saleStateOf({
    planningStage: event.planningStage,
    status: event.status,
    saleStartsAt: settings.saleStartsAt,
    saleEndsAt: settings.saleEndsAt,
    providerActive: ctx.providerActive || event.isDemo,
    now: ctx.now,
  });

  const coverImage = validImagePath(event.coverImage);
  const heroImage = validImagePath(siteRow?.heroImage ?? null);
  const artist = artistRow
    ? { id: artistRow.id, name: artistRow.name, image: validImagePath(artistRow.image) }
    : null;

  const sightlineSet =
    siteRow?.sightlineSet && (SIGHTLINE_SETS as readonly string[]).includes(siteRow.sightlineSet)
      ? (siteRow.sightlineSet as SightlineSet)
      : null;

  return {
    eventId: event.id,
    eventName: event.name,
    startsAt: event.startsAt.toISOString(),
    isDemo: event.isDemo,
    siteState,
    saleMode: settings.saleMode,
    coverImage,
    heroImage,
    artist,
    summary: siteRow?.summary ?? null,
    doorsOpenAt: siteRow?.doorsOpenAt ? siteRow.doorsOpenAt.toISOString() : null,
    ageLimit: siteRow?.ageLimit ?? null,
    dressCode: siteRow?.dressCode ?? null,
    sightlineSet,
    images: imageStatusOf({
      coverImage,
      heroImage,
      artistId: event.artistId,
      artistImage: artist?.image ?? null,
    }),
  };
}

/** Etkinliğin satış sitesi metin/saat alanlarını kaydeder; `heroImage` sütununa dokunmaz. */
export async function saveSiteContent(
  db: Db,
  actor: Actor,
  input: SaveSiteContentInput,
): Promise<{ eventId: string }> {
  authorize(actor, "events", "edit");
  const event = await getEventOrThrow(db, input.eventId);

  if (input.doorsOpenAt && input.doorsOpenAt.getTime() > event.startsAt.getTime()) {
    throw new DomainError("invalid", "Kapı saati etkinlik başlangıcından sonra olamaz");
  }

  await db
    .insert(eventSiteContent)
    .values({
      eventId: input.eventId,
      summary: input.summary,
      doorsOpenAt: input.doorsOpenAt,
      ageLimit: input.ageLimit,
      dressCode: input.dressCode,
      sightlineSet: input.sightlineSet,
    })
    .onConflictDoUpdate({
      target: eventSiteContent.eventId,
      set: {
        summary: input.summary,
        doorsOpenAt: input.doorsOpenAt,
        ageLimit: input.ageLimit,
        dressCode: input.dressCode,
        sightlineSet: input.sightlineSet,
        updatedAt: new Date(),
      },
    });

  return { eventId: input.eventId };
}
