import { z } from "zod";
import { db } from "@/db/client";
import { can } from "@/features/auth/policy";
import { getActorFromHeaders, type Actor } from "@/features/auth/session";
import { getEventOrThrow } from "@/features/events/service";
import { DomainError } from "@/lib/action";

export type StreamAccess =
  | { ok: true; actor: Actor }
  | { ok: false; status: 401 | 403 | 404; message: string };

/**
 * Akışa bağlanma yetkisi (yalnızca bağlantı anında değerlendirilir):
 * oturum yoksa 401; `check_in:view`, `reservations:view`, `ticketing:view` ve `venues:view` yoksa 403;
 * etkinlik yoksa 404.
 */
export async function authorizeStream(requestHeaders: Headers, eventId: string): Promise<StreamAccess> {
  const actor = await getActorFromHeaders(requestHeaders);
  if (!actor) return { ok: false, status: 401, message: "Oturum gerekli" };

  if (
    !can(actor, "check_in", "view") &&
    !can(actor, "reservations", "view") &&
    !can(actor, "ticketing", "view") &&
    !can(actor, "venues", "view")
  ) {
    return { ok: false, status: 403, message: "Bu işlem için yetkiniz yok" };
  }

  const notFound = { ok: false, status: 404, message: "Etkinlik bulunamadı" } as const;
  if (!z.uuid().safeParse(eventId).success) return notFound;
  try {
    await getEventOrThrow(db, eventId);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") return notFound;
    throw error;
  }
  return { ok: true, actor };
}
