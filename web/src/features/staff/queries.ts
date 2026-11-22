import { and, asc, count, eq, isNull } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  departments,
  eventStaffAssignments,
  positions,
  staff,
  staffRoles,
  workLocations,
  workShifts,
} from "@/db/schema";
import { authorize, type PolicyActor } from "@/features/auth/policy";
import { staffConditions } from "./service";
import type { StaffFilter } from "./schemas";

// Sunucu Bileşenlerinin okuma yolu: her sorgu önce `authorize` çağırır.

export type StaffListItem = {
  id: string;
  sicilNo: string;
  fullName: string;
  phone: string | null;
  color: string | null;
  status: "active" | "inactive" | "terminated";
  departmentName: string | null;
  positionName: string | null;
  workLocationName: string | null;
};

export async function listStaff(db: Db | Tx, actor: PolicyActor, filter: StaffFilter): Promise<StaffListItem[]> {
  authorize(actor, "staff", "view");
  return db
    .select({
      id: staff.id,
      sicilNo: staff.sicilNo,
      fullName: staff.fullName,
      phone: staff.phone,
      color: staff.color,
      status: staff.status,
      departmentName: departments.name,
      positionName: positions.name,
      workLocationName: workLocations.name,
    })
    .from(staff)
    .leftJoin(departments, eq(departments.id, staff.departmentId))
    .leftJoin(positions, eq(positions.id, staff.positionId))
    .leftJoin(workLocations, eq(workLocations.id, staff.workLocationId))
    .where(and(...staffConditions(filter)))
    .orderBy(asc(staff.fullName), asc(staff.sicilNo));
}

export type StaffDetail = typeof staff.$inferSelect & { assignmentCount: number };

export async function getStaffDetail(db: Db | Tx, actor: PolicyActor, id: string): Promise<StaffDetail | null> {
  authorize(actor, "staff", "view");
  const [row] = await db.select().from(staff).where(eq(staff.id, id));
  if (!row) return null;
  const [assigned] = await db
    .select({ total: count() })
    .from(eventStaffAssignments)
    .where(eq(eventStaffAssignments.staffId, id));
  return { ...row, assignmentCount: assigned?.total ?? 0 };
}

export type CatalogOption = { id: string; name: string };

/** Personel formu ve süzgeç seçimleri: yalnızca etkin katalog kayıtları. */
export async function getStaffFormOptions(
  db: Db | Tx,
  actor: PolicyActor,
): Promise<{ departments: CatalogOption[]; positions: CatalogOption[]; workLocations: CatalogOption[] }> {
  authorize(actor, "staff", "view");
  const [deps, poss, locs] = await Promise.all([
    db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(eq(departments.isActive, true))
      .orderBy(asc(departments.sortOrder), asc(departments.name)),
    db
      .select({ id: positions.id, name: positions.name })
      .from(positions)
      .where(eq(positions.isActive, true))
      .orderBy(asc(positions.sortOrder), asc(positions.name)),
    db
      .select({ id: workLocations.id, name: workLocations.name })
      .from(workLocations)
      .where(eq(workLocations.isActive, true))
      .orderBy(asc(workLocations.sortOrder), asc(workLocations.name)),
  ]);
  return { departments: deps, positions: poss, workLocations: locs };
}

/** Kuruluş ekranı: pasifler dahil tüm katalog satırları. */
export async function getOrganizationCatalogs(db: Db | Tx, actor: PolicyActor) {
  authorize(actor, "staff", "view");
  const [deps, poss, locs, roles, shifts] = await Promise.all([
    db.select().from(departments).orderBy(asc(departments.sortOrder), asc(departments.name)),
    db.select().from(positions).orderBy(asc(positions.sortOrder), asc(positions.name)),
    db.select().from(workLocations).orderBy(asc(workLocations.sortOrder), asc(workLocations.name)),
    db.select().from(staffRoles).orderBy(asc(staffRoles.sortOrder), asc(staffRoles.label)),
    db
      .select()
      .from(workShifts)
      .where(isNull(workShifts.eventId))
      .orderBy(asc(workShifts.sortOrder), asc(workShifts.name)),
  ]);
  return { departments: deps, positions: poss, workLocations: locs, staffRoles: roles, shifts };
}

export type OrganizationCatalogs = Awaited<ReturnType<typeof getOrganizationCatalogs>>;
