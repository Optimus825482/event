import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { assignmentTables, eventStaffAssignments, eventTables, staff, workShifts } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { withEventWrite } from "./access";
import { planAutoAssign, type AutoAssignPlan } from "./auto-assign";
import { STAFFING_MESSAGES } from "./db-errors";
import { diffLinks, unique } from "./diff";
import { assertTeamsInEvent } from "./groups-service";
import {
  ASSIGNMENT_TYPES,
  type AssignmentInput,
  type AssignmentType,
  type AutoAssignInput,
  type SaveAssignmentsInput,
} from "./schemas";

export type SavedAssignment = { id: string; staffId: string; shiftId: string | null; assignmentType: AssignmentType };

type ExistingRow = typeof eventStaffAssignments.$inferSelect;

const shiftKey = (staffId: string, shiftId: string | null | undefined) => `${staffId}|${shiftId ?? ""}`;

/** Vardiya genel (event_id NULL) ya da bu etkinliğe ait olmalı. */
export async function assertShiftsUsable(tx: Tx, eventId: string, shiftIds: Array<string | null | undefined>) {
  const ids = unique(shiftIds.filter((id): id is string => typeof id === "string"));
  if (ids.length === 0) return;
  const rows = await tx
    .select({ id: workShifts.id })
    .from(workShifts)
    .where(and(inArray(workShifts.id, ids), or(isNull(workShifts.eventId), eq(workShifts.eventId, eventId))));
  if (rows.length !== ids.length) throw new DomainError("conflict", STAFFING_MESSAGES.shiftNotInEvent);
}

function validateItems(items: AssignmentInput[], types: ReadonlySet<AssignmentType>): void {
  const keys = new Set<string>();
  for (const item of items) {
    if (!types.has(item.assignmentType)) {
      throw new DomainError("conflict", "Bu kayıtta yönetilmeyen bir atama türü gönderildi");
    }
    if (item.assignmentType !== "table" && item.tableIds.length > 0) {
      throw new DomainError("conflict", STAFFING_MESSAGES.tablesOnlyForTable);
    }
    if (item.assignmentType === "service_point" && !item.servicePointId) {
      throw new DomainError("conflict", STAFFING_MESSAGES.servicePointRequired);
    }
    const key = shiftKey(item.staffId, item.shiftId);
    if (keys.has(key)) throw new DomainError("conflict", STAFFING_MESSAGES.duplicateShift);
    keys.add(key);
  }
}

function rowValues(eventId: string, item: AssignmentInput, index: number) {
  return {
    eventId,
    staffId: item.staffId,
    shiftId: item.shiftId ?? null,
    teamId: item.teamId ?? null,
    assignmentType: item.assignmentType,
    servicePointId: item.assignmentType === "service_point" ? (item.servicePointId ?? null) : null,
    role: item.role ?? null,
    shiftStart: item.shiftStart ?? null,
    shiftEnd: item.shiftEnd ?? null,
    specialTaskLocation: item.specialTaskLocation ?? null,
    specialTaskStartTime: item.specialTaskStartTime ?? null,
    specialTaskEndTime: item.specialTaskEndTime ?? null,
    color: item.color ?? null,
    notes: item.notes ?? null,
    sortOrder: item.sortOrder ?? index,
    isActive: true,
  };
}

/** Atamaların masa bağlantılarını istenen duruma getirir (yalnızca `desired` içindeki atamalar). */
export async function syncAssignmentTables(tx: Tx, eventId: string, desired: ReadonlyMap<string, readonly string[]>) {
  const owners = [...desired.keys()];
  if (owners.length === 0) return;
  const links = await tx
    .select({ id: assignmentTables.id, owner: assignmentTables.assignmentId, value: assignmentTables.tableId })
    .from(assignmentTables)
    .where(and(eq(assignmentTables.eventId, eventId), inArray(assignmentTables.assignmentId, owners)));
  const { deleteIds, inserts } = diffLinks(links, desired);
  if (deleteIds.length > 0) await tx.delete(assignmentTables).where(inArray(assignmentTables.id, deleteIds));
  if (inserts.length > 0) {
    await tx
      .insert(assignmentTables)
      .values(inserts.map((l) => ({ eventId, assignmentId: l.owner, tableId: l.value })));
  }
}

/**
 * Etkinliğin atamalarını istenen duruma getirir (transaction içinde çağrılır).
 * `types` dışındaki türlerin satırlarına dokunulmaz: yalnızca masa atamaları kaydedilirken
 * özel görev ve servis noktası atamaları kaybolmaz. Kimliği olan satır güncellenir; personel
 * ya da vardiyası değişen satır aynı kimlikle yeniden yazılır (geçici tekillik çakışması olmasın).
 */
export async function applyAssignments(
  tx: Tx,
  eventId: string,
  items: AssignmentInput[],
  typesInput: readonly AssignmentType[] = ASSIGNMENT_TYPES,
): Promise<SavedAssignment[]> {
  const types = new Set(typesInput);
  validateItems(items, types);
  await assertShiftsUsable(
    tx,
    eventId,
    items.map((i) => i.shiftId),
  );
  await assertTeamsInEvent(
    tx,
    eventId,
    items.map((i) => i.teamId),
  );

  const existing = await tx.select().from(eventStaffAssignments).where(eq(eventStaffAssignments.eventId, eventId));
  const byId = new Map<string, ExistingRow>(existing.map((r) => [r.id, r]));
  const keep = new Set(items.flatMap((i) => (i.id && byId.has(i.id) ? [i.id] : [])));
  const rekeyed = new Set(
    [...keep].filter((id) => {
      const row = byId.get(id);
      const item = items.find((i) => i.id === id);
      return row && item && shiftKey(row.staffId, row.shiftId) !== shiftKey(item.staffId, item.shiftId);
    }),
  );
  const deleteIds = existing
    .filter((r) => (types.has(r.assignmentType) && !keep.has(r.id)) || rekeyed.has(r.id))
    .map((r) => r.id);
  if (deleteIds.length > 0) await tx.delete(eventStaffAssignments).where(inArray(eventStaffAssignments.id, deleteIds));

  const saved: SavedAssignment[] = [];
  const desired = new Map<string, string[]>();
  for (const [index, item] of items.entries()) {
    const values = rowValues(eventId, item, index);
    let id: string;
    if (item.id && keep.has(item.id) && !rekeyed.has(item.id)) {
      await tx
        .update(eventStaffAssignments)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(eventStaffAssignments.id, item.id));
      id = item.id;
    } else {
      const createdAt = item.id ? byId.get(item.id)?.createdAt : undefined;
      const [row] = await tx
        .insert(eventStaffAssignments)
        .values({ ...(item.id ? { id: item.id } : {}), ...(createdAt ? { createdAt } : {}), ...values })
        .returning({ id: eventStaffAssignments.id });
      if (!row) throw new Error("atama eklenemedi");
      id = row.id;
    }
    desired.set(id, item.tableIds);
    saved.push({ id, staffId: item.staffId, shiftId: item.shiftId ?? null, assignmentType: item.assignmentType });
  }
  await syncAssignmentTables(tx, eventId, desired);
  return saved;
}

export async function saveAssignments(
  db: Db | Tx,
  actor: Actor,
  input: SaveAssignmentsInput,
): Promise<{ assignments: SavedAssignment[] }> {
  return withEventWrite(db, actor, input.eventId, async (tx) => ({
    assignments: await applyAssignments(tx, input.eventId, input.assignments, input.types),
  }));
}

/**
 * Seçilen personele masaları stratejiye göre dağıtır ve tek transaction'da yazar (localar hariç).
 * Personelin bu vardiyadaki masa ataması varsa kimliği korunur, masaları planla değişir;
 * aynı vardiyada masa dışı ataması olan personel varsa hiçbir şey yazılmaz (`conflict`).
 * Diğer personelin atamalarına ve özel görevlere dokunulmaz.
 */
export async function autoAssign(
  db: Db | Tx,
  actor: Actor,
  input: AutoAssignInput,
): Promise<{ plan: AutoAssignPlan; assignments: SavedAssignment[] }> {
  return withEventWrite(db, actor, input.eventId, async (tx) => {
    const shiftId = input.shiftId ?? null;
    const active = await tx
      .select({ id: staff.id })
      .from(staff)
      .where(and(inArray(staff.id, input.staffIds), eq(staff.status, "active")));
    if (active.length !== input.staffIds.length) {
      throw new DomainError("conflict", "Yalnızca aktif personel atanabilir");
    }
    await assertShiftsUsable(tx, input.eventId, [shiftId]);

    const tables = await tx
      .select({ id: eventTables.id, label: eventTables.label, x: eventTables.x, y: eventTables.y, isLoca: eventTables.isLoca })
      .from(eventTables)
      .where(eq(eventTables.eventId, input.eventId));
    const plan = planAutoAssign(tables, input.staffIds, input.strategy, input.seed);

    const current = await tx
      .select()
      .from(eventStaffAssignments)
      .where(
        and(
          eq(eventStaffAssignments.eventId, input.eventId),
          inArray(eventStaffAssignments.staffId, input.staffIds),
          shiftId === null ? isNull(eventStaffAssignments.shiftId) : eq(eventStaffAssignments.shiftId, shiftId),
        ),
      );
    if (current.some((r) => r.assignmentType !== "table")) {
      throw new DomainError("conflict", STAFFING_MESSAGES.duplicateShift);
    }

    const saved: SavedAssignment[] = [];
    const desired = new Map<string, string[]>();
    for (const [index, entry] of plan.entries()) {
      let id = current.find((r) => r.staffId === entry.staffId)?.id;
      if (!id) {
        const [row] = await tx
          .insert(eventStaffAssignments)
          .values({ eventId: input.eventId, staffId: entry.staffId, shiftId, assignmentType: "table", sortOrder: index })
          .returning({ id: eventStaffAssignments.id });
        if (!row) throw new Error("atama eklenemedi");
        id = row.id;
      }
      desired.set(id, entry.tableIds);
      saved.push({ id, staffId: entry.staffId, shiftId, assignmentType: "table" });
    }
    await syncAssignmentTables(tx, input.eventId, desired);
    return { plan, assignments: saved };
  });
}
