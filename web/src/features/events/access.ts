import type { Actor } from "@/features/auth/session";
import type { EventRow } from "./service";
import { seesOnlyOwnEvents } from "@/features/auth/scope";

/** Organizatör yalnızca kendi etkinliğine erişir; başkasınınki "yok" gibi görünür. Diğer roller kısıtsızdır. */
export function canAccessEvent(actor: Pick<Actor, "id" | "role">, event: Pick<EventRow, "organizerId">): boolean {
  return !seesOnlyOwnEvents(actor) || event.organizerId === actor.id;
}
