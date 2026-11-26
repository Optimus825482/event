import { asc, desc, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventArchives } from "@/db/schema";
import { type ArchiveSummary, toArchiveSummary } from "@/features/archive/read";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { isUuid } from "@/lib/identifiers";
import { type CurrencyTotals, totalsByCurrency } from "@/features/reports/totals";
import { type ArtistRow, getArtistOrThrow, listArtists } from "./service";

// Karşılaştırma yalnızca kayıtlı sanatçılar içindir (`artist_id`); serbest metin ada göre gruplanmaz (Karar 18).

export type ArtistComparisonRow = {
  artist: ArtistRow;
  eventCount: number;
  lastEventAt: Date | null;
  totals: CurrencyTotals[];
};

export async function listArtistComparison(
  ex: Db | Tx,
  actor: Actor,
  filter: { search?: string; includeInactive?: boolean } = {},
): Promise<ArtistComparisonRow[]> {
  authorize(actor, "archive", "view");
  const artistRows = await listArtists(ex, actor, filter);
  if (artistRows.length === 0) return [];
  // Aynı istemcide sıralı beklenir.
  const archives = await ex
    .select()
    .from(eventArchives)
    .where(
      inArray(
        eventArchives.artistId,
        artistRows.map((a) => a.id),
      ),
    )
    .orderBy(asc(eventArchives.startsAt), asc(eventArchives.eventId));
  const byArtist = new Map<string, ArchiveSummary[]>();
  for (const row of archives) {
    if (!row.artistId) continue;
    const list = byArtist.get(row.artistId) ?? [];
    list.push(toArchiveSummary(row));
    byArtist.set(row.artistId, list);
  }
  return artistRows.map((artist) => {
    const events = byArtist.get(artist.id) ?? [];
    return {
      artist,
      eventCount: events.length,
      lastEventAt: events.length > 0 ? events[events.length - 1]!.startsAt : null,
      totals: totalsByCurrency(events),
    };
  });
}

export async function getArtistHistory(
  ex: Db | Tx,
  actor: Actor,
  artistId: string,
): Promise<{ artist: ArtistRow; events: ArchiveSummary[]; totals: CurrencyTotals[] }> {
  authorize(actor, "archive", "view");
  if (!isUuid(artistId)) throw new DomainError("not_found", "Sanatçı bulunamadı");
  const artist = await getArtistOrThrow(ex, artistId);
  const events = (
    await ex
      .select()
      .from(eventArchives)
      .where(eq(eventArchives.artistId, artistId))
      .orderBy(desc(eventArchives.startsAt), desc(eventArchives.eventId))
  ).map(toArchiveSummary);
  return { artist, events, totals: totalsByCurrency(events) };
}
