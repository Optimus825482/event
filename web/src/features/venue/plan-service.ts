import { asc, eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events, tableGroups, tableGroupTables } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { listEventTables } from "@/features/events/service";
import { DomainError } from "@/lib/action";
import type { FloorPlanData, PlanTable } from "./plan-types";
import { groupsByTable, type TableGroupInfo } from "./editor/groups";
import { parseDecor, type TableShape } from "./schemas";
import { listTableTypes } from "./table-types-service";

const EVENT_NOT_FOUND = "Etkinlik bulunamadı";

function shapeOf(value: string | undefined): TableShape {
  return value === "rectangle" || value === "square" ? value : "round";
}

/** Etkinliğin ekip masa grupları: her satır bir masa-grup üyeliği (grup sırasına göre). */
export async function listTableGroupMembers(db: Db | Tx, eventId: string): Promise<TableGroupInfo[]> {
  return db
    .select({ tableId: tableGroupTables.tableId, name: tableGroups.name, color: tableGroups.color })
    .from(tableGroupTables)
    .innerJoin(tableGroups, eq(tableGroups.id, tableGroupTables.tableGroupId))
    .where(eq(tableGroupTables.eventId, eventId))
    .orderBy(asc(tableGroups.sortOrder), asc(tableGroups.name));
}

/**
 * Etkinliğin salt okunur yerleşimi (alan planı çizimi için). Etkinlik yoksa `not_found`. Rol/izin denetimi çağıranın işidir.
 */
export async function getFloorPlan(db: Db | Tx, actor: Actor, eventId: string): Promise<{ eventName: string } & FloorPlanData> {
  const [event] = await db
    .select({ name: events.name, layoutDecor: events.layoutDecor })
    .from(events)
    .where(eq(events.id, eventId));
  if (!event) throw new DomainError("not_found", EVENT_NOT_FOUND);
  const [rows, types, memberships] = await Promise.all([
    listEventTables(db, eventId),
    listTableTypes(db),
    listTableGroupMembers(db, eventId),
  ]);
  const groupOf = groupsByTable(memberships);
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
      group: groupOf.get(row.id) ?? null,
      category: row.saleCategory,
      allocation: row.allocation,
    };
  });
  return { eventName: event.name, canvas: { width: decor.width, height: decor.height }, tables, decor: decor.elements, lines: decor.lines ?? [] };
}
