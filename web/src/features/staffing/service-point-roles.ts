/**
 * Servis noktası rolleri ve kişiye özel saatler için saf yardımcılar (sunucu ve istemci ortak).
 *
 * Eski sistem: `service_points.allowedRoles` (rol anahtarları, ör. "barman") ve toplam
 * `requiredStaffCount`; servis noktası atamasında `role` ile `shiftStart`/`shiftEnd` (vardiya yoksa
 * ya da "Özel" seçildiyse elle girilen saat). Yeni sistem rol başına sayıyı da tutar.
 */

export type RoleRequirement = { role: string; requiredCount: number };

/** Eski `SERVICE_POINT_ROLES` listesi (değer → etiket); serbest metin rol de kabul edilir. */
export const SERVICE_POINT_ROLE_OPTIONS = [
  { value: "barman", label: "Barmen" },
  { value: "captain", label: "Bar / Restoran Kaptanı" },
  { value: "waiter", label: "Waiter / Waitress" },
  { value: "comis", label: "Komi" },
  { value: "hostes", label: "Hostes" },
  { value: "garson", label: "Garson" },
  { value: "barboy", label: "Barboy" },
  { value: "security", label: "Güvenlik" },
  { value: "runner", label: "Runner" },
  { value: "supervisor", label: "Süpervizör" },
] as const;

export const MAX_ROLES_PER_POINT = 30;
export const MAX_ROLE_COUNT = 500;

/** Karşılaştırma biçimi: kırpılmış, Türkçe küçük harf; boşsa `null`. */
export function normalizeRole(role: string | null | undefined): string | null {
  if (typeof role !== "string") return null;
  const r = role.trim().toLocaleLowerCase("tr");
  return r === "" ? null : r;
}

export function roleLabel(role: string): string {
  const key = normalizeRole(role);
  return SERVICE_POINT_ROLE_OPTIONS.find((o) => o.value === key)?.label ?? role;
}

/**
 * Noktanın rol listesi: izin verilen roller (`allowed_roles` sırası) + sayı tablosundaki fazlalar.
 * Sayısı olmayan izinli rolün sayısı 0'dır ("sayı belirtilmemiş").
 */
export function mergeRoleRequirements(
  allowedRoles: readonly string[],
  counts: ReadonlyArray<{ role: string; requiredCount: number }>,
): RoleRequirement[] {
  const out: RoleRequirement[] = [];
  const seen = new Set<string>();
  const countOf = new Map(counts.map((c) => [normalizeRole(c.role), c.requiredCount]));
  for (const raw of [...allowedRoles, ...counts.map((c) => c.role)]) {
    const role = normalizeRole(raw);
    if (role === null || seen.has(role)) continue;
    seen.add(role);
    out.push({ role, requiredCount: countOf.get(role) ?? 0 });
  }
  return out;
}

/** Rol tanımlı değilse her rol (boş dahil) serbesttir; tanımlıysa rol listede olmalıdır. */
export function isRoleAllowed(roles: readonly RoleRequirement[], role: string | null | undefined): boolean {
  if (roles.length === 0) return true;
  const r = normalizeRole(role);
  return r !== null && roles.some((x) => x.role === r);
}

export type RoleCoverage = { role: string; label: string; required: number; assigned: number };

/** Rol başına atanan / gereken; listede olmayan roller `other` sayısına girer. */
export function roleCoverage(
  roles: readonly RoleRequirement[],
  assignments: ReadonlyArray<{ role: string | null }>,
): { rows: RoleCoverage[]; other: number } {
  const assignedOf = new Map<string, number>();
  let other = 0;
  for (const a of assignments) {
    const r = normalizeRole(a.role);
    if (r !== null && roles.some((x) => x.role === r)) assignedOf.set(r, (assignedOf.get(r) ?? 0) + 1);
    else other += 1;
  }
  return {
    rows: roles.map((x) => ({ role: x.role, label: roleLabel(x.role), required: x.requiredCount, assigned: assignedOf.get(x.role) ?? 0 })),
    other,
  };
}

// ---- Kişiye özel saat ("Özel saat") ----

/** "18:00" ve "18:00:00" aynı saattir. */
export function sameTime(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const full = (t: string) => (t.length === 5 ? `${t}:00` : t);
  return full(a) === full(b);
}

/** Özel saat kuralı: ikisi birlikte girilir ve eşit olamaz; gece yarısını geçen aralık serbesttir. */
export function overrideTimesError(start: string | null | undefined, end: string | null | undefined): string | null {
  const hasStart = Boolean(start);
  const hasEnd = Boolean(end);
  if (hasStart !== hasEnd) return "Özel saatte başlangıç ve bitiş birlikte girilmeli";
  if (hasStart && sameTime(start, end)) return "Özel saatte başlangıç ve bitiş aynı olamaz";
  return null;
}

type ShiftTimes = { startTime: string; endTime: string } | null | undefined;

/** Atamanın saati vardiyanınkinden farklıysa (ya da vardiyasız atamada saat girildiyse) özeldir. */
export function hasCustomTimes(a: { shiftStart: string | null; shiftEnd: string | null }, shift: ShiftTimes): boolean {
  if (!a.shiftStart || !a.shiftEnd) return false;
  if (!shift) return true;
  return !(sameTime(a.shiftStart, shift.startTime) && sameTime(a.shiftEnd, shift.endTime));
}

/** Kaydedilecek özel saat: vardiyanın saatiyle aynıysa saklanmaz (iki alan da `null`). */
export function storedOverride(
  start: string | null | undefined,
  end: string | null | undefined,
  shift: ShiftTimes,
): { shiftStart: string | null; shiftEnd: string | null } {
  if (!start || !end) return { shiftStart: null, shiftEnd: null };
  if (shift && sameTime(start, shift.startTime) && sameTime(end, shift.endTime)) return { shiftStart: null, shiftEnd: null };
  return { shiftStart: start, shiftEnd: end };
}
