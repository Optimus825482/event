import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { departments, positions, workLocations } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { ensureStaffAccess, mapDbConflicts } from "./pg-errors";
import type {
  DepartmentInput,
  IdInput,
  PositionInput,
  UpdateDepartmentInput,
  UpdatePositionInput,
  UpdateWorkLocationInput,
  WorkLocationInput,
} from "./schemas";

// Bölüm, unvan ve görev yeri kataloğu. Ad tekildir; personele bağlı kayıt silinemez
// (yabancı anahtar `restrict`). Eski sistem de aynı kuralları uyguluyordu.

const M = {
  department: { dup: "Bu bölüm zaten mevcut", used: "Bu bölüme bağlı personel var, silinemez", missing: "Bölüm bulunamadı" },
  position: { dup: "Bu unvan zaten mevcut", used: "Bu unvana bağlı personel var, silinemez", missing: "Unvan bulunamadı" },
  location: {
    dup: "Bu görev yeri zaten mevcut",
    used: "Bu görev yerine bağlı personel var, silinemez",
    missing: "Görev yeri bulunamadı",
  },
} as const;

// ---- Bölüm ----

export async function createDepartment(db: Db | Tx, actor: Actor, input: DepartmentInput): Promise<{ id: string }> {
  ensureStaffAccess(actor, "create");
  return mapDbConflicts(
    async () => {
      const [row] = await db.insert(departments).values(input).returning({ id: departments.id });
      if (!row) throw new Error("bölüm eklenemedi");
      return row;
    },
    { unique: M.department.dup },
  );
}

export async function updateDepartment(db: Db | Tx, actor: Actor, input: UpdateDepartmentInput): Promise<{ id: string }> {
  ensureStaffAccess(actor, "edit");
  const { id, ...values } = input;
  const row = await mapDbConflicts(
    async () => (await db.update(departments).set(values).where(eq(departments.id, id)).returning({ id: departments.id }))[0],
    { unique: M.department.dup },
  );
  if (!row) throw new DomainError("not_found", M.department.missing);
  return row;
}

export async function deleteDepartment(db: Db | Tx, actor: Actor, input: IdInput): Promise<void> {
  ensureStaffAccess(actor, "delete");
  const rows = await mapDbConflicts(
    () => db.delete(departments).where(eq(departments.id, input.id)).returning({ id: departments.id }),
    { foreignKey: M.department.used },
  );
  if (rows.length === 0) throw new DomainError("not_found", M.department.missing);
}

// ---- Unvan ----

export async function createPosition(db: Db | Tx, actor: Actor, input: PositionInput): Promise<{ id: string }> {
  ensureStaffAccess(actor, "create");
  return mapDbConflicts(
    async () => {
      const [row] = await db.insert(positions).values(input).returning({ id: positions.id });
      if (!row) throw new Error("unvan eklenemedi");
      return row;
    },
    { unique: M.position.dup },
  );
}

export async function updatePosition(db: Db | Tx, actor: Actor, input: UpdatePositionInput): Promise<{ id: string }> {
  ensureStaffAccess(actor, "edit");
  const { id, ...values } = input;
  const row = await mapDbConflicts(
    async () => (await db.update(positions).set(values).where(eq(positions.id, id)).returning({ id: positions.id }))[0],
    { unique: M.position.dup },
  );
  if (!row) throw new DomainError("not_found", M.position.missing);
  return row;
}

export async function deletePosition(db: Db | Tx, actor: Actor, input: IdInput): Promise<void> {
  ensureStaffAccess(actor, "delete");
  const rows = await mapDbConflicts(
    () => db.delete(positions).where(eq(positions.id, input.id)).returning({ id: positions.id }),
    { foreignKey: M.position.used },
  );
  if (rows.length === 0) throw new DomainError("not_found", M.position.missing);
}

// ---- Görev yeri ----

export async function createWorkLocation(db: Db | Tx, actor: Actor, input: WorkLocationInput): Promise<{ id: string }> {
  ensureStaffAccess(actor, "create");
  return mapDbConflicts(
    async () => {
      const [row] = await db.insert(workLocations).values(input).returning({ id: workLocations.id });
      if (!row) throw new Error("görev yeri eklenemedi");
      return row;
    },
    { unique: M.location.dup },
  );
}

export async function updateWorkLocation(
  db: Db | Tx,
  actor: Actor,
  input: UpdateWorkLocationInput,
): Promise<{ id: string }> {
  ensureStaffAccess(actor, "edit");
  const { id, ...values } = input;
  const row = await mapDbConflicts(
    async () =>
      (await db.update(workLocations).set(values).where(eq(workLocations.id, id)).returning({ id: workLocations.id }))[0],
    { unique: M.location.dup },
  );
  if (!row) throw new DomainError("not_found", M.location.missing);
  return row;
}

export async function deleteWorkLocation(db: Db | Tx, actor: Actor, input: IdInput): Promise<void> {
  ensureStaffAccess(actor, "delete");
  const rows = await mapDbConflicts(
    () => db.delete(workLocations).where(eq(workLocations.id, input.id)).returning({ id: workLocations.id }),
    { foreignKey: M.location.used },
  );
  if (rows.length === 0) throw new DomainError("not_found", M.location.missing);
}
