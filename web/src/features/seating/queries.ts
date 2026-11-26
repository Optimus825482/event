import { and, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db as defaultDb, type Db, type Tx } from "@/db/client";
import { reservations } from "@/db/schema";
import type { PlanningStage } from "@/domain/planning-stage";
import { effectiveSellable, type SaleCategory, type TableAllocation } from "@/domain/seating";
import { ForbiddenError } from "@/features/auth/errors";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { getEventOrThrow, listEventTables } from "@/features/events/service";
import { ACTIVE_STATUSES } from "@/features/reservations/internal";
import { getFloorPlan } from "@/features/venue/plan-service";
import type { FloorPlanData } from "@/features/venue/plan-types";
import { DomainError } from "@/lib/action";
import { isUuid } from "@/lib/identifiers";
import { getSaleSettings, type SaleSettings } from "./settings-service";

export type SeatingTable = {
  id: string;
  label: string;
  capacity: number;
  sellableSeats: number | null;
  effectiveSellable: number;
  category: SaleCategory;
  allocation: TableAllocation;
  isLoca: boolean;
  hasActiveReservation: boolean;
};

export type SeatingOverview = {
  eventName: string;
  stage: PlanningStage;
  settings: SaleSettings;
  tables: SeatingTable[];
  plan: FloorPlanData;
};

/**
 * Masa sınıflandırma ve tahsis ekranlarının ortak okuma modeli. İki ekran kullandığı için yetki
 * `ticketing:view` ya da `reservations:view`dir. Masalar etikete göre doğal sırada (A2, A10) gelir.
 */
export async function getSeatingOverview(ex: Db | Tx, actor: Actor, eventId: string): Promise<SeatingOverview> {
  if (!can(actor, "ticketing", "view") && !can(actor, "reservations", "view")) throw new ForbiddenError();
  const event = await getEventOrThrow(ex, eventId);
  const [rows, settings, floor, active] = await Promise.all([
    listEventTables(ex, eventId),
    getSaleSettings(ex, eventId),
    getFloorPlan(ex, actor, eventId),
    ex
      .selectDistinct({ tableId: reservations.tableId })
      .from(reservations)
      .where(and(eq(reservations.eventId, eventId), inArray(reservations.status, [...ACTIVE_STATUSES]))),
  ]);
  const reserved = new Set(active.map((r) => r.tableId));
  const tables = rows
    .map(
      (row): SeatingTable => ({
        id: row.id,
        label: row.label,
        capacity: row.capacity,
        sellableSeats: row.sellableSeats,
        effectiveSellable: effectiveSellable(row),
        category: row.saleCategory,
        allocation: row.allocation,
        isLoca: row.isLoca,
        hasActiveReservation: reserved.has(row.id),
      }),
    )
    .sort((a, b) => a.label.localeCompare(b.label, "tr", { numeric: true }));
  const { eventName, ...plan } = floor;
  return { eventName, stage: event.planningStage, settings, tables, plan };
}

/** Sunucu Bileşenleri için: oturumdaki kullanıcıyla okur; geçersiz kimlik ya da olmayan etkinlik `notFound()`. */
export async function loadSeatingOverview(eventId: string): Promise<{ actor: Actor } & SeatingOverview> {
  const actor = await requirePolicyActor();
  if (!isUuid(eventId)) notFound();
  try {
    return { actor, ...(await getSeatingOverview(defaultDb, actor, eventId)) };
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}
