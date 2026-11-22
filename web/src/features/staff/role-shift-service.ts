import { and, count, eq, isNull } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventStaffAssignments, staffRoles, teamMembers, workShifts } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { ensureStaffAccess, mapDbConflicts } from "./pg-errors";
import type { IdInput, ShiftInput, StaffRoleInput, UpdateShiftInput, UpdateStaffRoleInput } from "./schemas";

const M = {
  roleDup: "Bu anahtarla bir rol zaten var",
  roleUsed: "Bu rol atamalarda kullanılıyor, silinemez",
  roleMissing: "Rol bulunamadı",
  shiftDup: "Bu isimde bir vardiya zaten var",
  shiftUsed: "Bu vardiya atamalarda kullanılıyor, silinemez",
  shiftMissing: "Vardiya bulunamadı",
} as const;

// ---- Personel rolleri (etiket + renk) ----

export async function createStaffRole(db: Db | Tx, actor: Actor, input: StaffRoleInput): Promise<{ id: string }> {
  ensureStaffAccess(actor, "create");
  return mapDbConflicts(
    async () => {
      const [row] = await db.insert(staffRoles).values(input).returning({ id: staffRoles.id });
      if (!row) throw new Error("rol eklenemedi");
      return row;
    },
    { unique: M.roleDup },
  );
}

/** Anahtar, atamalardaki `role` metniyle eşleştiği için güncellemede değiştirilmez. */
export async function updateStaffRole(db: Db | Tx, actor: Actor, input: UpdateStaffRoleInput): Promise<{ id: string }> {
  ensureStaffAccess(actor, "edit");
  const { id, ...values } = input;
  const [row] = await db.update(staffRoles).set(values).where(eq(staffRoles.id, id)).returning({ id: staffRoles.id });
  if (!row) throw new DomainError("not_found", M.roleMissing);
  return row;
}

/** Atama veya ekip üyeliğinde kullanılan rol silinemez; pasifleştirilebilir. */
export async function deleteStaffRole(db: Db | Tx, actor: Actor, input: IdInput): Promise<void> {
  ensureStaffAccess(actor, "delete");
  const [role] = await db.select({ key: staffRoles.key }).from(staffRoles).where(eq(staffRoles.id, input.id));
  if (!role) throw new DomainError("not_found", M.roleMissing);

  const [inAssignments] = await db
    .select({ total: count() })
    .from(eventStaffAssignments)
    .where(eq(eventStaffAssignments.role, role.key));
  const [inTeams] = await db.select({ total: count() }).from(teamMembers).where(eq(teamMembers.role, role.key));
  if ((inAssignments?.total ?? 0) + (inTeams?.total ?? 0) > 0) throw new DomainError("conflict", M.roleUsed);

  await db.delete(staffRoles).where(eq(staffRoles.id, input.id));
}

// ---- Vardiya şablonları (genel: event_id NULL) ----

export async function createShift(db: Db | Tx, actor: Actor, input: ShiftInput): Promise<{ id: string }> {
  ensureStaffAccess(actor, "create");
  return mapDbConflicts(
    async () => {
      const [row] = await db
        .insert(workShifts)
        .values({ ...input, eventId: null })
        .returning({ id: workShifts.id });
      if (!row) throw new Error("vardiya eklenemedi");
      return row;
    },
    { unique: M.shiftDup },
  );
}

export async function updateShift(db: Db | Tx, actor: Actor, input: UpdateShiftInput): Promise<{ id: string }> {
  ensureStaffAccess(actor, "edit");
  const { id, ...values } = input;
  const row = await mapDbConflicts(
    async () =>
      (
        await db
          .update(workShifts)
          .set(values)
          .where(and(eq(workShifts.id, id), isNull(workShifts.eventId)))
          .returning({ id: workShifts.id })
      )[0],
    { unique: M.shiftDup },
  );
  if (!row) throw new DomainError("not_found", M.shiftMissing);
  return row;
}

export async function deleteShift(db: Db | Tx, actor: Actor, input: IdInput): Promise<void> {
  ensureStaffAccess(actor, "delete");
  const rows = await mapDbConflicts(
    () =>
      db
        .delete(workShifts)
        .where(and(eq(workShifts.id, input.id), isNull(workShifts.eventId)))
        .returning({ id: workShifts.id }),
    { foreignKey: M.shiftUsed },
  );
  if (rows.length === 0) throw new DomainError("not_found", M.shiftMissing);
}
