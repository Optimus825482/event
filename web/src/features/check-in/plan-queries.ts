import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { reservations } from "@/db/schema";
import { requirePolicyActor } from "@/features/auth/permissions";
import { authorize } from "@/features/auth/policy";
import type { PlanStatus } from "@/features/venue/plan-status";
import { statusByTable } from "@/features/venue/plan-status";
import { getFloorPlan } from "@/features/venue/plan-service";
import type { PlanTable } from "@/features/venue/plan-types";
import { DomainError } from "@/lib/action";
import { isUuid } from "@/lib/identifiers";
import { findPlanTable } from "./plan-focus";
import { searchGuests, type GuestRow } from "./read-service";

export type PlanFocus = { table: PlanTable; guests: GuestRow[] };

/**
 * `/check-in/[eventId]/plan`: kapı görevlisi için salt okunur kat planı. Check-in görüntüleme izni
 * ve etkinliğe erişim (`getFloorPlan`) gerekir; masa renkleri aktif rezervasyon durumundan türetilir.
 * `masa` (kimlik ya da etiket) verilirse o masa ve masadaki misafirler de döner.
 */
export async function loadCheckInPlan(eventId: string, masa?: string) {
  const actor = await requirePolicyActor();
  authorize(actor, "check_in", "view");
  if (!isUuid(eventId)) notFound();
  try {
    const plan = await getFloorPlan(db, actor, eventId);
    const rows = await db
      .select({ tableId: reservations.tableId, status: reservations.status })
      .from(reservations)
      .where(eq(reservations.eventId, eventId));
    const statuses: Record<string, PlanStatus> = statusByTable(rows);
    const table = findPlanTable(plan.tables, masa);
    let focus: PlanFocus | null = null;
    if (table) {
      const found = await searchGuests(db, actor, { eventId, q: table.label });
      focus = { table, guests: found.filter((g) => g.tableId === table.id) };
    }
    return { plan, statuses, focus };
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}
