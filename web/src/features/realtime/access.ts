import { z } from "zod";
import { db } from "@/db/client";
import { withPermissions } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { getActorFromHeaders, type Actor } from "@/features/auth/session";
import { canAccessEvent } from "@/features/events/access";
import { getEventOrThrow } from "@/features/events/service";
import { DomainError } from "@/lib/action";

export type StreamAccess =
  | { ok: true; actor: Actor }
  | { ok: false; status: 401 | 403 | 404; message: string };

/**
 * Akışa bağlanma yetkisi (yalnızca bağlantı anında değerlendirilir):
 * oturum yoksa 401; `check_in:view` veya `reservations:view` yoksa 403;
 * etkinlik yoksa ya da organizatörün kendi etkinliği değilse 404.
 */
export async function authorizeStream(requestHeaders: Headers, eventId: string): Promise<StreamAccess> {
  const actor = await getActorFromHeaders(requestHeaders);
  if (!actor) return { ok: false, status: 401, message: "Oturum gerekli" };

  const policyActor = await withPermissions(actor);
  if (!can(policyActor, "check_in", "view") && !can(policyActor, "reservations", "view")) {
    return { ok: false, status: 403, message: "Bu işlem için yetkiniz yok" };
  }

  const notFound = { ok: false, status: 404, message: "Etkinlik bulunamadı" } as const;
  if (!z.uuid().safeParse(eventId).success) return notFound;
  try {
    const event = await getEventOrThrow(db, eventId);
    if (!canAccessEvent(actor, event)) return notFound;
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") return notFound;
    throw error;
  }
  return { ok: true, actor };
}
