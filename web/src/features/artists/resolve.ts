import { and, asc, eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { artists } from "@/db/schema";
import { artistNameKey } from "./name-key";

export type ArtistLink = { artistId: string | null; artistName: string | null };

/**
 * Etkinlik formundaki sanatçı metnini kayda bağlar: etkin kayıtlı sanatçıyla ad anahtarı eşleşirse
 * `artistId` bağlanır ve ad kaydın yazımıyla dolar; eşleşmezse metin serbest kalır.
 */
export async function resolveArtist(ex: Db | Tx, artistName: string | null | undefined): Promise<ArtistLink> {
  const text = artistName?.trim();
  if (!text) return { artistId: null, artistName: null };
  const key = artistNameKey(text);
  if (!key) return { artistId: null, artistName: null };
  const [match] = await ex
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(and(eq(artists.nameKey, key), eq(artists.isActive, true)));
  return match ? { artistId: match.id, artistName: match.name } : { artistId: null, artistName: text };
}

/** Etkinlik formunun öneri listesi: etkin sanatçılar, ad sırasıyla. */
export async function listArtistOptions(ex: Db | Tx): Promise<{ id: string; name: string }[]> {
  return ex
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(eq(artists.isActive, true))
    .orderBy(asc(artists.name));
}
