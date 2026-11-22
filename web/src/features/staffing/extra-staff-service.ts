import { and, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventExtraStaff, eventExtraStaffGroups, eventExtraStaffTables } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { withEventWrite } from "./access";
import { diffLinks, splitKept } from "./diff";
import type { ExtraStaffInput, SaveExtraStaffInput } from "./schemas";

export type SavedExtraStaff = { id: string; fullName: string };

function values(eventId: string, item: ExtraStaffInput, index: number) {
  return {
    eventId,
    fullName: item.fullName,
    position: item.position ?? null,
    role: item.role ?? null,
    shiftStart: item.shiftStart ?? null,
    shiftEnd: item.shiftEnd ?? null,
    color: item.color ?? null,
    notes: item.notes ?? null,
    sortOrder: item.sortOrder ?? index,
    isActive: item.isActive ?? true,
  };
}

/** Kadro dışı personeli, masa ve grup bağlarıyla birlikte istenen duruma getirir (transaction içinde). */
export async function applyExtraStaff(tx: Tx, eventId: string, input: ExtraStaffInput[]): Promise<SavedExtraStaff[]> {
  const existing = await tx
    .select({ id: eventExtraStaff.id })
    .from(eventExtraStaff)
    .where(eq(eventExtraStaff.eventId, eventId));
  const { keep, deleteIds } = splitKept(input, existing);
  if (deleteIds.length > 0) await tx.delete(eventExtraStaff).where(inArray(eventExtraStaff.id, deleteIds));

  const saved: SavedExtraStaff[] = [];
  const tableLinks = new Map<string, string[]>();
  const groupLinks = new Map<string, string[]>();
  for (const [index, item] of input.entries()) {
    let id: string;
    if (item.id && keep.has(item.id)) {
      await tx
        .update(eventExtraStaff)
        .set({ ...values(eventId, item, index), updatedAt: new Date() })
        .where(eq(eventExtraStaff.id, item.id));
      id = item.id;
    } else {
      const [row] = await tx
        .insert(eventExtraStaff)
        .values({ ...(item.id ? { id: item.id } : {}), ...values(eventId, item, index) })
        .returning({ id: eventExtraStaff.id });
      if (!row) throw new Error("ekstra personel eklenemedi");
      id = row.id;
    }
    tableLinks.set(id, item.tableIds);
    groupLinks.set(id, item.groupIds);
    saved.push({ id, fullName: item.fullName });
  }

  const owners = saved.map((s) => s.id);
  if (owners.length === 0) return saved;

  const existingTables = await tx
    .select({ id: eventExtraStaffTables.id, owner: eventExtraStaffTables.extraStaffId, value: eventExtraStaffTables.tableId })
    .from(eventExtraStaffTables)
    .where(and(eq(eventExtraStaffTables.eventId, eventId), inArray(eventExtraStaffTables.extraStaffId, owners)));
  const tableDiff = diffLinks(existingTables, tableLinks);
  if (tableDiff.deleteIds.length > 0) {
    await tx.delete(eventExtraStaffTables).where(inArray(eventExtraStaffTables.id, tableDiff.deleteIds));
  }
  if (tableDiff.inserts.length > 0) {
    await tx
      .insert(eventExtraStaffTables)
      .values(tableDiff.inserts.map((l) => ({ eventId, extraStaffId: l.owner, tableId: l.value })));
  }

  const existingGroups = await tx
    .select({ id: eventExtraStaffGroups.id, owner: eventExtraStaffGroups.extraStaffId, value: eventExtraStaffGroups.tableGroupId })
    .from(eventExtraStaffGroups)
    .where(and(eq(eventExtraStaffGroups.eventId, eventId), inArray(eventExtraStaffGroups.extraStaffId, owners)));
  const groupDiff = diffLinks(existingGroups, groupLinks);
  if (groupDiff.deleteIds.length > 0) {
    await tx.delete(eventExtraStaffGroups).where(inArray(eventExtraStaffGroups.id, groupDiff.deleteIds));
  }
  if (groupDiff.inserts.length > 0) {
    await tx
      .insert(eventExtraStaffGroups)
      .values(groupDiff.inserts.map((l) => ({ eventId, extraStaffId: l.owner, tableGroupId: l.value })));
  }
  return saved;
}

export async function saveExtraStaff(
  db: Db | Tx,
  actor: Actor,
  input: SaveExtraStaffInput,
): Promise<{ extraStaff: SavedExtraStaff[] }> {
  return withEventWrite(db, actor, input.eventId, async (tx) => ({
    extraStaff: await applyExtraStaff(tx, input.eventId, input.extraStaff),
  }));
}
