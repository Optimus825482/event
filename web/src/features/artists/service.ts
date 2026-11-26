import { and, asc, eq, like } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { artists, eventArchives } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { escapeLike } from "@/lib/identifiers";
import { pgCodeOf, pgConstraintOf } from "@/lib/pg-error";
import { artistNameKey } from "./name-key";
import type { CreateArtistInput, DeleteArtistInput, UpdateArtistInput } from "./schemas";

export type ArtistRow = typeof artists.$inferSelect;

const NAME_TAKEN = "Bu adla bir sanatçı zaten kayıtlı";
const NOT_FOUND = "Sanatçı bulunamadı";
const IN_USE = "Arşivde etkinliği olan sanatçı silinemez; pasife alın";

/** `23505` + ad anahtarı kısıtı iş hatasına çevrilir (işlem dışında çağrılır). */
function mapNameConflict(error: unknown): never {
  if (pgCodeOf(error) === "23505" && pgConstraintOf(error) === "artists_name_key_uq") {
    throw new DomainError("conflict", NAME_TAKEN);
  }
  throw error;
}

export async function getArtistOrThrow(ex: Db | Tx, id: string): Promise<ArtistRow> {
  const [row] = await ex.select().from(artists).where(eq(artists.id, id));
  if (!row) throw new DomainError("not_found", NOT_FOUND);
  return row;
}

export async function createArtist(db: Db, actor: Actor, input: CreateArtistInput): Promise<ArtistRow> {
  authorize(actor, "archive", "create");
  try {
    const [row] = await db
      .insert(artists)
      .values({
        name: input.name,
        nameKey: artistNameKey(input.name),
        genre: input.genre ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    if (!row) throw new Error("sanatçı eklenemedi");
    return row;
  } catch (error) {
    return mapNameConflict(error);
  }
}

/** Form tam gönderilir: boş tür/not temizlenir; `isActive` verilmezse korunur. */
export async function updateArtist(db: Db, actor: Actor, input: UpdateArtistInput): Promise<ArtistRow> {
  authorize(actor, "archive", "edit");
  await getArtistOrThrow(db, input.id);
  try {
    const [row] = await db
      .update(artists)
      .set({
        name: input.name,
        nameKey: artistNameKey(input.name),
        genre: input.genre ?? null,
        notes: input.notes ?? null,
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        updatedAt: new Date(),
      })
      .where(eq(artists.id, input.id))
      .returning();
    if (!row) throw new DomainError("not_found", NOT_FOUND);
    return row;
  } catch (error) {
    return mapNameConflict(error);
  }
}

export async function deleteArtist(db: Db, actor: Actor, input: DeleteArtistInput): Promise<{ id: string }> {
  authorize(actor, "archive", "delete");
  return db.transaction(async (tx) => {
    // Sanatçı satırı kilidi: silme ile arşive bağlama yarışmasın.
    const [row] = await tx.select({ id: artists.id }).from(artists).where(eq(artists.id, input.id)).for("update");
    if (!row) throw new DomainError("not_found", NOT_FOUND);
    const [used] = await tx
      .select({ eventId: eventArchives.eventId })
      .from(eventArchives)
      .where(eq(eventArchives.artistId, input.id))
      .limit(1);
    if (used) throw new DomainError("conflict", IN_USE);
    await tx.delete(artists).where(eq(artists.id, input.id));
    return { id: input.id };
  });
}

export async function listArtists(
  ex: Db | Tx,
  actor: Actor,
  filter: { search?: string; includeInactive?: boolean } = {},
): Promise<ArtistRow[]> {
  authorize(actor, "archive", "view");
  const key = filter.search ? artistNameKey(filter.search) : "";
  const conditions = [
    filter.includeInactive ? undefined : eq(artists.isActive, true),
    key ? like(artists.nameKey, `%${escapeLike(key)}%`) : undefined,
  ];
  return ex
    .select()
    .from(artists)
    .where(and(...conditions))
    .orderBy(asc(artists.nameKey), asc(artists.id));
}
