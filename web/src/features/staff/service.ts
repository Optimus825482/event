import { and, asc, count, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventStaffAssignments, staff } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { ensureStaffAccess, mapDbConflicts } from "./pg-errors";
import type { IdInput, SetStaffStatusInput, StaffFilter, StaffInput, UpdateStaffInput } from "./schemas";

// Eski sistemdeki varsayılan personel renkleri (backend staff-crud.service.ts).
const DEFAULT_STAFF_COLORS = [
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#8b5cf6",
  "#f97316",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
] as const;

const MESSAGES = {
  notFound: "Personel bulunamadı",
  duplicateSicil: "Bu sicil numarası zaten kullanılıyor",
  badReference: "Seçilen bölüm, unvan veya görev yeri bulunamadı",
  hasAssignments: "Etkinlik ataması olan personel silinemez; pasifleştirin",
} as const;

export type StaffRow = typeof staff.$inferSelect;

/** LIKE joker karakterlerini kaçırır; arama metni düz metin olarak eşleşir. */
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

/** Süzgeç koşulları; `listActiveStaff` ve yönetim listesi aynı mantığı kullanır. */
export function staffConditions(filter: StaffFilter): SQL[] {
  const conditions: SQL[] = [];
  if (filter.status) conditions.push(eq(staff.status, filter.status));
  if (filter.departmentId) conditions.push(eq(staff.departmentId, filter.departmentId));
  if (filter.positionId) conditions.push(eq(staff.positionId, filter.positionId));
  if (filter.workLocationId) conditions.push(eq(staff.workLocationId, filter.workLocationId));
  const search = filter.search?.trim();
  if (search) {
    const pattern = likePattern(search);
    const match = or(ilike(staff.fullName, pattern), ilike(staff.sicilNo, pattern));
    if (match) conditions.push(match);
  }
  return conditions;
}

/**
 * Çalışan (`status = 'active'`) personeli ada göre sıralı döner. Yetki denetimi çağıranındır
 * (etkinlik atama ekranı gibi iç tüketiciler); `status` süzgeci yok sayılır.
 */
export async function listActiveStaff(db: Db | Tx, filter: Omit<StaffFilter, "status">): Promise<StaffRow[]> {
  const conditions = [...staffConditions({ ...filter, status: "active" })];
  return db
    .select()
    .from(staff)
    .where(and(...conditions))
    .orderBy(asc(staff.fullName), asc(staff.sicilNo));
}

export async function getStaffById(db: Db | Tx, actor: Actor, id: string): Promise<StaffRow> {
  ensureStaffAccess(actor, "view");
  const [row] = await db.select().from(staff).where(eq(staff.id, id));
  if (!row) throw new DomainError("not_found", MESSAGES.notFound);
  return row;
}

async function nextDefaultColor(db: Db | Tx): Promise<string> {
  const [row] = await db.select({ total: count() }).from(staff);
  return DEFAULT_STAFF_COLORS[(row?.total ?? 0) % DEFAULT_STAFF_COLORS.length] ?? DEFAULT_STAFF_COLORS[0];
}

export async function createStaff(db: Db | Tx, actor: Actor, input: StaffInput): Promise<{ id: string }> {
  ensureStaffAccess(actor, "create");
  const color = input.color ?? (await nextDefaultColor(db));
  return mapDbConflicts(
    async () => {
      const [row] = await db
        .insert(staff)
        .values({ ...input, color })
        .returning({ id: staff.id });
      if (!row) throw new Error("personel eklenemedi");
      return row;
    },
    { unique: MESSAGES.duplicateSicil, foreignKey: MESSAGES.badReference },
  );
}

/** Tam değiştirme: formdaki tüm alanlar yazılır (boş alan `null` olur). Durum alanına dokunmaz. */
export async function updateStaff(db: Db | Tx, actor: Actor, input: UpdateStaffInput): Promise<{ id: string }> {
  ensureStaffAccess(actor, "edit");
  const { id, ...values } = input;
  const row = await mapDbConflicts(
    async () => {
      const [updated] = await db
        .update(staff)
        .set({ ...values, color: values.color ?? sql`${staff.color}` })
        .where(eq(staff.id, id))
        .returning({ id: staff.id });
      return updated;
    },
    { unique: MESSAGES.duplicateSicil, foreignKey: MESSAGES.badReference },
  );
  if (!row) throw new DomainError("not_found", MESSAGES.notFound);
  return row;
}

/** Pasifleştirme / ayrılma / yeniden etkinleştirme. Ataması olan personel de pasifleştirilebilir. */
export async function setStaffStatus(db: Db | Tx, actor: Actor, input: SetStaffStatusInput): Promise<{ id: string }> {
  ensureStaffAccess(actor, "edit");
  const terminated = input.status === "terminated";
  const [row] = await db
    .update(staff)
    .set({
      status: input.status,
      terminationDate: terminated ? input.terminationDate : null,
      terminationReason: terminated ? input.terminationReason : null,
    })
    .where(eq(staff.id, input.id))
    .returning({ id: staff.id });
  if (!row) throw new DomainError("not_found", MESSAGES.notFound);
  return row;
}

/** Kalıcı silme: etkinlik ataması olan personel silinmez (yabancı anahtar `restrict` ikinci savunmadır). */
export async function deleteStaff(db: Db | Tx, actor: Actor, input: IdInput): Promise<void> {
  ensureStaffAccess(actor, "delete");
  const [existing] = await db.select({ id: staff.id }).from(staff).where(eq(staff.id, input.id));
  if (!existing) throw new DomainError("not_found", MESSAGES.notFound);

  const [assigned] = await db
    .select({ total: count() })
    .from(eventStaffAssignments)
    .where(eq(eventStaffAssignments.staffId, input.id));
  if ((assigned?.total ?? 0) > 0) throw new DomainError("conflict", MESSAGES.hasAssignments);

  await mapDbConflicts(() => db.delete(staff).where(eq(staff.id, input.id)), {
    foreignKey: MESSAGES.hasAssignments,
  });
}
