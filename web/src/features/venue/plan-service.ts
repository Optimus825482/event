import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { canAccessEvent } from "@/features/events/access";
import { listEventTables } from "@/features/events/service";
import { DomainError } from "@/lib/action";
import type { FloorPlanData, PlanTable } from "./plan-types";
import { parseDecor, type TableShape } from "./schemas";
import { listTableTypes } from "./table-types-service";

const EVENT_NOT_FOUND = "Etkinlik bulunamadı";

function shapeOf(value: string | undefined): TableShape {
  return value === "rectangle" || value === "square" ? value : "round";
}

/**
 * Etkinliğin salt okunur yerleşimi (kat planı çizimi için). Organizatör yalnızca kendi etkinliğini görür;
 * yoksa ya da erişilemiyorsa `not_found`. Rol/izin denetimi çağıranın işidir.
 */
export async function getFloorPlan(db: Db | Tx, actor: Actor, eventId: string): Promise<{ eventName: string } & FloorPlanData> {
  const [event] = await db
    .select({ name: events.name, organizerId: events.organizerId, layoutDecor: events.layoutDecor })
    .from(events)
    .where(eq(events.id, eventId));
  if (!event || !canAccessEvent(actor, event)) throw new DomainError("not_found", EVENT_NOT_FOUND);
  const [rows, types] = await Promise.all([listEventTables(db, eventId), listTableTypes(db)]);
  const typeById = new Map(types.map((t) => [t.id, t]));
  const decor = parseDecor(event.layoutDecor);
  const tables: PlanTable[] = rows.map((row) => {
    const type = row.tableTypeId ? typeById.get(row.tableTypeId) : undefined;
    return {
      id: row.id,
      label: row.label,
      capacity: row.capacity,
      x: row.x,
      y: row.y,
      rotation: row.rotation,
      isLoca: row.isLoca,
      shape: shapeOf(type?.shape),
      color: type?.color ?? null,
    };
  });
  return { eventName: event.name, canvas: { width: decor.width, height: decor.height }, tables, decor: decor.elements };
}
