import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { servicePointRoleRequirements, servicePoints } from "@/db/schema";
import { DomainError } from "@/lib/action";
import { STAFFING_MESSAGES } from "./db-errors";
import { unique } from "./diff";
import type { AssignmentInput, ServicePointRolesInput } from "./schemas";
import { isRoleAllowed, mergeRoleRequirements, normalizeRole, roleLabel, type RoleRequirement } from "./service-point-roles";

type PointRoles = { id: string; name: string; roles: RoleRequirement[] };

/** Etkinliğin (ya da verilen) servis noktalarının rol listeleri (izinli roller + rol başına sayı). */
export async function loadServicePointRoles(
  db: Db | Tx,
  eventId: string,
  pointIds?: readonly string[],
): Promise<Map<string, PointRoles>> {
  if (pointIds && pointIds.length === 0) return new Map();
  const where = pointIds
    ? and(eq(servicePoints.eventId, eventId), inArray(servicePoints.id, [...pointIds]))
    : eq(servicePoints.eventId, eventId);
  const reqWhere = pointIds
    ? and(eq(servicePointRoleRequirements.eventId, eventId), inArray(servicePointRoleRequirements.servicePointId, [...pointIds]))
    : eq(servicePointRoleRequirements.eventId, eventId);
  const [points, counts] = await Promise.all([
    db.select({ id: servicePoints.id, name: servicePoints.name, allowedRoles: servicePoints.allowedRoles }).from(servicePoints).where(where),
    db
      .select({
        servicePointId: servicePointRoleRequirements.servicePointId,
        role: servicePointRoleRequirements.role,
        requiredCount: servicePointRoleRequirements.requiredCount,
      })
      .from(servicePointRoleRequirements)
      .where(reqWhere)
      .orderBy(asc(servicePointRoleRequirements.sortOrder)),
  ]);
  return new Map(
    points.map((p) => [
      p.id,
      { id: p.id, name: p.name, roles: mergeRoleRequirements(p.allowedRoles, counts.filter((c) => c.servicePointId === p.id)) },
    ]),
  );
}

const sameRoles = (a: readonly RoleRequirement[], b: readonly RoleRequirement[]) =>
  a.length === b.length && a.every((x, i) => x.role === b[i]?.role && x.requiredCount === b[i]?.requiredCount);

/**
 * Gönderilen servis noktalarının rollerini yazar (transaction içinde): `allowed_roles` rol listesi olur,
 * sayısı > 0 olan roller `service_point_role_requirements`e yazılır. Değişmeyen noktaya yazılmaz.
 * Nokta bu etkinliğin olmalıdır.
 */
export async function applyServicePointRoles(tx: Tx, eventId: string, items: readonly ServicePointRolesInput[]): Promise<void> {
  if (items.length === 0) return;
  const current = await loadServicePointRoles(
    tx,
    eventId,
    items.map((i) => i.servicePointId),
  );
  if (current.size !== items.length) throw new DomainError("conflict", STAFFING_MESSAGES.servicePointNotInEvent);
  for (const item of items) {
    const desired: RoleRequirement[] = [];
    for (const r of item.roles) {
      const role = normalizeRole(r.role);
      if (role === null) throw new DomainError("conflict", "Rol gerekli");
      if (desired.some((d) => d.role === role)) throw new DomainError("conflict", "Aynı rol iki kez eklenmiş");
      if (!Number.isInteger(r.requiredCount) || r.requiredCount < 0) throw new DomainError("conflict", "Rol sayısı negatif olamaz");
      desired.push({ role, requiredCount: r.requiredCount });
    }
    if (sameRoles(current.get(item.servicePointId)?.roles ?? [], desired)) continue;
    await tx
      .update(servicePoints)
      .set({ allowedRoles: desired.map((d) => d.role), updatedAt: new Date() })
      .where(and(eq(servicePoints.eventId, eventId), eq(servicePoints.id, item.servicePointId)));
    await tx
      .delete(servicePointRoleRequirements)
      .where(
        and(eq(servicePointRoleRequirements.eventId, eventId), eq(servicePointRoleRequirements.servicePointId, item.servicePointId)),
      );
    const rows = desired.flatMap((d, i) =>
      d.requiredCount > 0 ? [{ eventId, servicePointId: item.servicePointId, role: d.role, requiredCount: d.requiredCount, sortOrder: i }] : [],
    );
    if (rows.length > 0) await tx.insert(servicePointRoleRequirements).values(rows);
  }
}

/** Rol tanımlı servis noktasına yalnızca izinli roldeki personel atanır. */
export function roleNotAllowedMessage(point: PointRoles, role: string | null | undefined): string {
  const allowed = point.roles.map((r) => roleLabel(r.role)).join(", ");
  const who = normalizeRole(role) === null ? "Görevi boş personel" : `"${role}" görevi`;
  return `${who} "${point.name}" servis noktasında çalışamaz (izinli: ${allowed})`;
}

export async function assertServicePointRoles(tx: Tx, eventId: string, items: readonly AssignmentInput[]): Promise<void> {
  const spItems = items.filter((i) => i.assignmentType === "service_point" && i.servicePointId);
  const ids = unique(spItems.map((i) => i.servicePointId)).filter((id): id is string => typeof id === "string");
  if (ids.length === 0) return;
  const points = await loadServicePointRoles(tx, eventId, ids);
  for (const item of spItems) {
    const point = item.servicePointId ? points.get(item.servicePointId) : undefined;
    // Başka etkinliğin noktası: bileşik yabancı anahtar reddeder (Türkçe mesaj db-errors'ta).
    if (!point) continue;
    if (!isRoleAllowed(point.roles, item.role)) throw new DomainError("conflict", roleNotAllowedMessage(point, item.role));
  }
}
