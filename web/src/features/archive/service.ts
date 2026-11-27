import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { eventArchives, events } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import type { RebuildArchiveInput } from "./schemas";
import { mapArchiveWriteError } from "./errors";
import { archiveEvent } from "./snapshot";

/** Tamamlanmış etkinliğin arşivini güncel veriden yeniden yazar (yoksa oluşturur). */
export async function rebuildArchive(
  db: Db,
  actor: Actor,
  input: RebuildArchiveInput,
): Promise<{ eventId: string; revision: number }> {
  authorize(actor, "archive", "edit");
  try {
    return await rebuildArchiveTx(db, actor, input);
  } catch (error) {
    return mapArchiveWriteError(error);
  }
}

async function rebuildArchiveTx(
  db: Db,
  actor: Actor,
  input: RebuildArchiveInput,
): Promise<{ eventId: string; revision: number }> {
  // Anlık görüntü tek tutarlı zamanda okunsun diye repeatable read.
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(events).where(eq(events.id, input.eventId)).for("update");
    if (!locked) throw new DomainError("not_found", "Etkinlik bulunamadı");
    if (locked.status !== "completed") {
      throw new DomainError("conflict", "Yalnızca tamamlanmış etkinliğin arşivi oluşturulabilir");
    }
    await archiveEvent(tx, input.eventId, actor.id);
    const [row] = await tx
      .select({ revision: eventArchives.revision })
      .from(eventArchives)
      .where(eq(eventArchives.eventId, input.eventId));
    if (!row) throw new DomainError("not_found", "Arşiv kaydı bulunamadı");
    return { eventId: input.eventId, revision: row.revision };
  }, { isolationLevel: "repeatable read" });
}
