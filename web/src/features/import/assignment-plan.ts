import { and, eq, isNull, or } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  assignmentTables,
  eventStaffAssignments,
  eventTables,
  staff,
  tableGroupTables,
  tableGroups,
  workShifts,
} from "@/db/schema";
import { assignmentInputSchema, type AssignmentInput } from "@/features/staffing/schemas";
import type { ParsedAssignmentRow } from "./assignment-rows";
import { normalizeKey } from "./headers";
import type { PreviewRow } from "./types";

type Executor = Db | Tx;

type Lookups = {
  staffBySicil: Map<string, typeof staff.$inferSelect>;
  staffByName: Map<string, (typeof staff.$inferSelect)[]>;
  tableByLabel: Map<string, string | null>;
  groupTables: Map<string, string[]>;
  shiftByName: Map<string, string>;
};

async function loadLookups(ex: Executor, eventId: string): Promise<Lookups> {
  const [people, tables, groups, links, shifts] = await Promise.all([
    ex.select().from(staff),
    ex.select({ id: eventTables.id, label: eventTables.label }).from(eventTables).where(eq(eventTables.eventId, eventId)),
    ex.select({ id: tableGroups.id, name: tableGroups.name }).from(tableGroups).where(eq(tableGroups.eventId, eventId)),
    ex
      .select({ groupId: tableGroupTables.tableGroupId, tableId: tableGroupTables.tableId })
      .from(tableGroupTables)
      .where(eq(tableGroupTables.eventId, eventId)),
    ex
      .select({ id: workShifts.id, name: workShifts.name, eventId: workShifts.eventId })
      .from(workShifts)
      .where(and(eq(workShifts.isActive, true), or(isNull(workShifts.eventId), eq(workShifts.eventId, eventId)))),
  ]);

  const staffBySicil = new Map<string, typeof staff.$inferSelect>();
  const staffByName = new Map<string, (typeof staff.$inferSelect)[]>();
  for (const person of people) {
    staffBySicil.set(normalizeKey(person.sicilNo), person);
    const key = normalizeKey(person.fullName);
    staffByName.set(key, [...(staffByName.get(key) ?? []), person]);
  }
  const tableByLabel = new Map<string, string | null>();
  for (const table of tables) {
    const key = normalizeKey(table.label);
    tableByLabel.set(key, tableByLabel.has(key) ? null : table.id);
  }
  const groupTablesById = new Map<string, string[]>();
  for (const link of links) groupTablesById.set(link.groupId, [...(groupTablesById.get(link.groupId) ?? []), link.tableId]);
  const groupTablesByName = new Map<string, string[]>();
  for (const group of groups) groupTablesByName.set(normalizeKey(group.name), groupTablesById.get(group.id) ?? []);
  // Etkinliğe özel vardiya aynı adlı genel vardiyaya göre önceliklidir.
  const shiftByName = new Map<string, string>();
  for (const shift of [...shifts].sort((a, b) => Number(a.eventId !== null) - Number(b.eventId !== null))) {
    shiftByName.set(normalizeKey(shift.name), shift.id);
  }
  return { staffBySicil, staffByName, tableByLabel, groupTables: groupTablesByName, shiftByName };
}

type Resolved = { staffId: string } | { error: string };

function resolveStaff(lookups: Lookups, row: ParsedAssignmentRow): Resolved {
  if (row.sicilNo !== "") {
    // Sicil no verilmişse bulunamayan sicil ada düşmez: yanlış kişiye atama riski.
    const person = lookups.staffBySicil.get(normalizeKey(row.sicilNo));
    if (!person) return { error: `Sicil no bulunamadı: "${row.sicilNo}"` };
    return person.status === "active" ? { staffId: person.id } : { error: "Personel aktif değil" };
  }
  if (row.staffName === "") return { error: "Sicil no ya da personel adı gerekli" };
  const matches = lookups.staffByName.get(normalizeKey(row.staffName)) ?? [];
  const active = matches.filter((p) => p.status === "active");
  if (active.length > 1) {
    return { error: `Bu adla birden fazla personel var; sicil no kullanın: "${row.staffName}"` };
  }
  const only = active[0];
  if (only) return { staffId: only.id };
  return { error: matches.length > 0 ? "Personel aktif değil" : `Personel bulunamadı: "${row.staffName}"` };
}

function resolveTables(lookups: Lookups, row: ParsedAssignmentRow): { tableIds: string[] } | { error: string } {
  const ids = new Set<string>();
  const unknown: string[] = [];
  for (const label of row.tableLabels) {
    const id = lookups.tableByLabel.get(normalizeKey(label));
    if (id) ids.add(id);
    else unknown.push(label);
  }
  if (unknown.length > 0) {
    return { error: `Masa bulunamadı: ${unknown.map((l) => `"${l}"`).join(", ")}` };
  }
  if (row.group !== "") {
    const group = lookups.groupTables.get(normalizeKey(row.group));
    if (!group) return { error: `Grup bulunamadı: "${row.group}"` };
    for (const id of group) ids.add(id);
  }
  if (ids.size === 0) return { error: "Masa etiketi ya da grup gerekli (ya da grup boş)" };
  return { tableIds: [...ids] };
}

export type PlanRow = PreviewRow & { error: boolean };

export type AssignmentPlan = {
  rows: PlanRow[];
  /** Yazılacak TÜM masa atamaları: mevcutlar + içe aktarılanlar (kimlikler korunur). */
  items: AssignmentInput[];
  hasErrors: boolean;
  importedCount: number;
};

async function loadExisting(ex: Executor, eventId: string): Promise<AssignmentInput[]> {
  const rows = await ex
    .select()
    .from(eventStaffAssignments)
    .where(and(eq(eventStaffAssignments.eventId, eventId), eq(eventStaffAssignments.assignmentType, "table")));
  const links = await ex.select().from(assignmentTables).where(eq(assignmentTables.eventId, eventId));
  return rows.map((r) => ({
    id: r.id,
    staffId: r.staffId,
    shiftId: r.shiftId,
    teamId: r.teamId,
    assignmentType: "table",
    servicePointId: null,
    role: r.role,
    shiftStart: r.shiftStart,
    shiftEnd: r.shiftEnd,
    color: r.color,
    notes: r.notes,
    sortOrder: r.sortOrder,
    tableIds: links.filter((l) => l.assignmentId === r.id).map((l) => l.tableId),
  }));
}

const keyOf = (staffId: string, shiftId: string | null | undefined) => `${staffId}|${shiftId ?? ""}`;

/**
 * Dosya satırlarını çözer (personel, masa, grup, vardiya) ve yazılacak atama listesini kurar.
 * Aynı personel + vardiya satırları birleşir. Mevcut masa atamaları listeye olduğu gibi katılır
 * (`saveAssignments` `table` türünde eksik olanı silerdi); dosyadaki personelin masaları dosyadakiyle
 * DEĞİŞTİRİLİR, dosyada olmayan personele dokunulmaz. Hiçbir şey yazmaz.
 */
export async function buildAssignmentPlan(
  ex: Executor,
  eventId: string,
  parsed: readonly ParsedAssignmentRow[],
): Promise<AssignmentPlan> {
  const lookups = await loadLookups(ex, eventId);
  const existing = await loadExisting(ex, eventId);
  const items = [...existing];
  const rows: PlanRow[] = [];
  const touched = new Map<string, number>();
  const imported = new Set<string>();

  for (const row of parsed) {
    const summary = [row.sicilNo || row.staffName, row.tableLabels.join(", ") || row.group].filter(Boolean).join(" · ");
    const fail = (message: string) => rows.push({ row: row.row, status: "error", error: true, message, summary });

    const person = resolveStaff(lookups, row);
    if ("error" in person) {
      fail(person.error);
      continue;
    }
    const tableResult = resolveTables(lookups, row);
    if ("error" in tableResult) {
      fail(tableResult.error);
      continue;
    }
    let shiftId: string | null = null;
    if (row.shift !== "") {
      shiftId = lookups.shiftByName.get(normalizeKey(row.shift)) ?? null;
      if (shiftId === null) {
        fail(`Vardiya bulunamadı: "${row.shift}"`);
        continue;
      }
    }
    const candidate = assignmentInputSchema.safeParse({
      staffId: person.staffId,
      shiftId,
      assignmentType: "table",
      role: row.role,
      tableIds: tableResult.tableIds,
    });
    if (!candidate.success) {
      fail([...new Set(candidate.error.issues.map((i) => i.message))].join("; "));
      continue;
    }

    const key = keyOf(person.staffId, shiftId);
    const at = items.findIndex((i) => keyOf(i.staffId, i.shiftId) === key);
    const current = at >= 0 ? items[at] : undefined;
    let note: string;
    if (current && imported.has(key)) {
      const merged = [...new Set([...current.tableIds, ...candidate.data.tableIds])];
      items[at] = { ...current, tableIds: merged, role: current.role ?? candidate.data.role };
      note = `Aynı personelin önceki satırıyla birleştirildi (satır ${touched.get(key)})`;
    } else if (current) {
      items[at] = { ...current, tableIds: candidate.data.tableIds, role: candidate.data.role ?? current.role };
      note = "Mevcut atamanın masaları dosyadakiyle değiştirilecek";
    } else {
      items.push(candidate.data);
      note = `Yeni atama (${candidate.data.tableIds.length} masa)`;
    }
    if (!imported.has(key)) touched.set(key, row.row);
    imported.add(key);
    rows.push({ row: row.row, status: "ok", error: false, message: note, summary });
  }
  return { rows, items, hasErrors: rows.some((r) => r.error), importedCount: imported.size };
}
