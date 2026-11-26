import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db, Tx } from "@/db/client";
import { eventSectionHeads, staff } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { getReadableEvent, withEventWrite } from "./access";

export type SectionHead = { staffId: string; fullName: string; sicilNo: string };

const INACTIVE_STAFF = "Personel bulunamadı ya da aktif değil";
const DUPLICATE_STAFF = "Aynı personel iki kez seçilemez";

export const setSectionHeadsSchema = z.object({
  eventId: z.uuid("Geçersiz etkinlik"),
  staffIds: z
    .array(z.uuid("Geçersiz personel"))
    .max(10, "En fazla 10 kısım sorumlusu atanabilir")
    .refine((ids) => new Set(ids).size === ids.length, DUPLICATE_STAFF),
});

export type SetSectionHeadsInput = z.infer<typeof setSectionHeadsSchema>;

/** Etkinliğin kısım sorumlularını ada göre okur. Yetki denetimi çağıranındır. */
async function readSectionHeads(ex: Db | Tx, eventId: string): Promise<SectionHead[]> {
  return ex
    .select({ staffId: staff.id, fullName: staff.fullName, sicilNo: staff.sicilNo })
    .from(eventSectionHeads)
    .innerJoin(staff, eq(staff.id, eventSectionHeads.staffId))
    .where(eq(eventSectionHeads.eventId, eventId))
    .orderBy(asc(staff.fullName), asc(staff.id));
}

/** Etkinliğin kısım sorumluları (`staff:view`). Etkinlik yoksa `not_found`, diğer okumalarla aynı biçimde. */
export async function listSectionHeads(ex: Db | Tx, actor: Actor, eventId: string): Promise<SectionHead[]> {
  await getReadableEvent(ex, actor, eventId);
  return readSectionHeads(ex, eventId);
}

/**
 * Kısım sorumlularını verilen kümeye getirir (`staff:edit`, tek transaction). Kümede olmayan kayıtlar
 * silinir, yeni personel eklenir; aktif olmayan ya da var olmayan personel bütün işlemi reddeder.
 */
export async function setSectionHeads(db: Db | Tx, actor: Actor, input: SetSectionHeadsInput): Promise<SectionHead[]> {
  return withEventWrite(db, actor, input.eventId, async (tx) => {
    const wanted = [...new Set(input.staffIds)];
    if (wanted.length !== input.staffIds.length) throw new DomainError("invalid", DUPLICATE_STAFF);

    if (wanted.length > 0) {
      const active = await tx
        .select({ id: staff.id })
        .from(staff)
        .where(and(inArray(staff.id, wanted), eq(staff.status, "active")));
      if (active.length !== wanted.length) throw new DomainError("invalid", INACTIVE_STAFF);
    }

    const existing = await tx
      .select({ id: eventSectionHeads.id, staffId: eventSectionHeads.staffId })
      .from(eventSectionHeads)
      .where(eq(eventSectionHeads.eventId, input.eventId));
    const keep = new Set(wanted);
    const removeIds = existing.filter((row) => !keep.has(row.staffId)).map((row) => row.id);
    if (removeIds.length > 0) await tx.delete(eventSectionHeads).where(inArray(eventSectionHeads.id, removeIds));

    const current = new Set(existing.map((row) => row.staffId));
    const addIds = wanted.filter((staffId) => !current.has(staffId));
    if (addIds.length > 0) {
      await tx
        .insert(eventSectionHeads)
        .values(addIds.map((staffId) => ({ eventId: input.eventId, staffId, createdById: actor.id })));
    }

    return readSectionHeads(tx, input.eventId);
  });
}
