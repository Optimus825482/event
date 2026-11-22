import type { Actor } from "@/features/auth/session";
import type { EventRow } from "./service";

/** Organizatör yalnızca kendi etkinliğine erişir; başkasınınki "yok" gibi görünür. Diğer roller kısıtsızdır. */
export function canAccessEvent(actor: Pick<Actor, "id" | "role">, event: Pick<EventRow, "organizerId">): boolean {
  return actor.role !== "organizer" || event.organizerId === actor.id;
}
