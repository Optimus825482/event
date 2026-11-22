/**
 * Grup personeli ve servis noktası personeli pencereleri için saf kurallar.
 *
 * Yeni veri anlamı yoktur: "grubun personeli", masaları grubun masalarıyla kesişen masa ataması;
 * "servis noktası personeli", o noktaya bağlı servis noktası atamasıdır. Sunucunun kuralları
 * (aynı personel aynı vardiyada tek atama, bir masa tek ekip) burada önceden uygulanır ki
 * pencere kaydı engelleyecek bir taslak üretmesin.
 */
type AssignmentType = "table" | "special_task" | "service_point";

export type AssignmentLike = {
  id: string;
  staffId: string;
  shiftId: string | null;
  teamId: string | null;
  assignmentType: AssignmentType;
  servicePointId: string | null;
  role: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  tableIds: string[];
};

export type GroupRef = { id: string; teamId: string | null; tableIds: readonly string[] };

export type StaffPick = {
  staffId: string;
  shiftId: string | null;
  role: string | null;
  shiftStart?: string | null;
  shiftEnd?: string | null;
};

export type Availability = { ok: true; existingId: string | null } | { ok: false; reason: string };

const sameShift = (a: { shiftId: string | null }, shiftId: string | null) => (a.shiftId ?? null) === (shiftId ?? null);

function findSlot<A extends AssignmentLike>(assignments: readonly A[], staffId: string, shiftId: string | null) {
  return assignments.find((a) => a.staffId === staffId && sameShift(a, shiftId));
}

/** Masaları grubun masalarıyla kesişen masa atamaları. */
export function groupStaffAssignments<A extends AssignmentLike>(assignments: readonly A[], group: GroupRef): A[] {
  const tables = new Set(group.tableIds);
  return assignments.filter((a) => a.assignmentType === "table" && a.tableIds.some((t) => tables.has(t)));
}

/** Personel bu vardiyada gruba eklenebilir mi; eklenebilirse birleşeceği mevcut masa ataması. */
export function groupStaffAvailability(
  assignments: readonly AssignmentLike[],
  pick: Pick<StaffPick, "staffId" | "shiftId">,
  group: GroupRef,
): Availability {
  if (group.tableIds.length === 0) return { ok: false, reason: "Grupta masa yok" };
  const slot = findSlot(assignments, pick.staffId, pick.shiftId);
  if (!slot) return { ok: true, existingId: null };
  if (slot.assignmentType !== "table") return { ok: false, reason: "Bu vardiyada başka bir görevi var" };
  if (group.tableIds.every((t) => slot.tableIds.includes(t))) return { ok: false, reason: "Zaten bu grupta" };
  if (slot.teamId && group.teamId && slot.teamId !== group.teamId) {
    return { ok: false, reason: "Bu vardiyada başka ekibin masalarında" };
  }
  return { ok: true, existingId: slot.id };
}

/**
 * Personeli gruba ekler: bu vardiyadaki masa ataması varsa grubun masaları ona eklenir,
 * yoksa grubun masalarını ve ekibini taşıyan yeni bir masa ataması oluşturulur.
 * Eklenemiyorsa liste aynen döner.
 */
export function addGroupStaff<A extends AssignmentLike>(
  assignments: readonly A[],
  pick: StaffPick,
  group: GroupRef,
  create: (pick: StaffPick) => A,
): A[] {
  const availability = groupStaffAvailability(assignments, pick, group);
  if (!availability.ok) return [...assignments];
  const { existingId } = availability;
  if (existingId) {
    return assignments.map((a) =>
      a.id === existingId
        ? { ...a, tableIds: [...a.tableIds, ...group.tableIds.filter((t) => !a.tableIds.includes(t))], role: a.role ?? pick.role }
        : a,
    );
  }
  return [...assignments, { ...create(pick), assignmentType: "table", teamId: group.teamId, tableIds: [...group.tableIds] }];
}

/** Grubun masalarını atamadan çıkarır; başka masası kalmayan atama silinir. */
export function removeGroupStaff<A extends AssignmentLike>(assignments: readonly A[], assignmentId: string, group: GroupRef): A[] {
  const tables = new Set(group.tableIds);
  return assignments.flatMap((a) => {
    if (a.id !== assignmentId) return [a];
    const rest = a.tableIds.filter((t) => !tables.has(t));
    return rest.length === 0 ? [] : [{ ...a, tableIds: rest }];
  });
}

/** Servis noktasına bağlı atamalar. */
export function servicePointAssignments<A extends AssignmentLike>(assignments: readonly A[], servicePointId: string): A[] {
  return assignments.filter((a) => a.assignmentType === "service_point" && a.servicePointId === servicePointId);
}

export function servicePointAvailability(
  assignments: readonly AssignmentLike[],
  pick: Pick<StaffPick, "staffId" | "shiftId">,
  servicePointId: string,
): Availability {
  const slot = findSlot(assignments, pick.staffId, pick.shiftId);
  if (!slot) return { ok: true, existingId: null };
  if (slot.assignmentType === "service_point" && slot.servicePointId === servicePointId) {
    return { ok: false, reason: "Zaten bu noktada" };
  }
  return { ok: false, reason: "Bu vardiyada başka bir görevi var" };
}

/** Personeli servis noktasına yeni bir servis noktası atamasıyla ekler (eklenemiyorsa liste aynen döner). */
export function addServicePointStaff<A extends AssignmentLike>(
  assignments: readonly A[],
  pick: StaffPick,
  servicePointId: string,
  create: (pick: StaffPick) => A,
): A[] {
  if (!servicePointAvailability(assignments, pick, servicePointId).ok) return [...assignments];
  return [...assignments, { ...create(pick), assignmentType: "service_point", servicePointId, tableIds: [] }];
}

/** "2 / 3" gibi doluluk; gerekli sayı yoksa yalnızca atanan sayı. */
export function staffingLabel(assigned: number, required: number | null | undefined): string {
  return required && required > 0 ? `${assigned} / ${required}` : `${assigned}`;
}

const POINT_TYPE_LABELS: Record<string, string> = {
  bar: "Bar",
  lounge: "VIP Lounge",
  reception: "Karşılama",
  vip_area: "VIP Alan",
  backstage: "Backstage",
  other: "Diğer",
};

/** Servis noktası türünün Türkçe adı (eski sistemdeki liste); bilinmeyen tür olduğu gibi gösterilir. */
export function servicePointTypeLabel(type: string): string {
  return POINT_TYPE_LABELS[type] ?? type;
}
