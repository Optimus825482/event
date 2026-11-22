import { desc, eq } from "drizzle-orm";
import { customers, reservations } from "@/db/schema";
import type { ReservationStatus } from "@/domain/reservation-status";
import type { ActorWithPermissions } from "@/features/auth/permissions";
import { authorize, can } from "@/features/auth/policy";
import { getFloorPlan } from "@/features/venue/plan-service";
import { statusByTable, type PlanStatus } from "@/features/venue/plan-status";
import type { FloorPlanData } from "@/features/venue/plan-types";
import type { Executor } from "./internal";

export type PlanReservation = {
  id: string;
  tableId: string;
  status: ReservationStatus;
  guestCount: number;
  guestName: string | null;
  /** Yalnızca `customers:view` olanlara dolu gelir. */
  customerName: string | null;
};

export type ReservationPlan = {
  eventName: string;
  plan: FloorPlanData;
  reservations: PlanReservation[];
  /** Masa kimliği -> boş/beklemede/onaylı/giriş yaptı (iptal ve gelmedi masayı boş bırakır). */
  statuses: Record<string, PlanStatus>;
};

/**
 * Etkinliğin yerleşimi + rezervasyonları (harita ve plandan masa seçimi için). `reservations:view`
 * gerekir; organizatör yalnızca kendi etkinliğini görür (yoksa `not_found`).
 */
export async function getReservationPlan(db: Executor, actor: ActorWithPermissions, eventId: string): Promise<ReservationPlan> {
  authorize(actor, "reservations", "view");
  const { eventName, ...plan } = await getFloorPlan(db, actor, eventId);
  const seeCustomers = can(actor, "customers", "view");
  const rows = await db
    .select({
      id: reservations.id,
      tableId: reservations.tableId,
      status: reservations.status,
      guestCount: reservations.guestCount,
      guestName: reservations.guestName,
      customerName: customers.fullName,
    })
    .from(reservations)
    .innerJoin(customers, eq(customers.id, reservations.customerId))
    .where(eq(reservations.eventId, eventId))
    .orderBy(desc(reservations.createdAt), desc(reservations.id));
  const list = rows.map((row) => ({ ...row, customerName: seeCustomers ? row.customerName : null }));
  return { eventName, plan, reservations: list, statuses: statusByTable(list) };
}
