import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { eventStaffAssignments, servicePoints } from "@/db/schema";
import { DomainError } from "@/lib/action";
import type { Decor, DecorElement } from "./schemas";

const DEFAULT_BAR_NAME = "Bar";
const DEFAULT_BAR_COLOR = "#b45309";

type Bar = { elementId: string; name: string; x: number; y: number; color: string };

/** Plandaki barın servis noktası karşılığı: ad etiketten, konum öğenin merkezinden gelir. */
export function barServicePoint(e: DecorElement): Bar {
  return {
    elementId: e.id,
    name: e.label.trim() || DEFAULT_BAR_NAME,
    x: Math.round((e.x + e.width / 2) * 100) / 100,
    y: Math.round((e.y + e.height / 2) * 100) / 100,
    color: e.color ?? DEFAULT_BAR_COLOR,
  };
}

/**
 * Yerleşimdeki barları personel atamasının servis noktalarıyla eşitler (çağıran etkinliği kilitlemiş olmalı):
 * yeni bar yeni servis noktası olur, var olanın adı/konumu/rengi güncellenir, plandan silinen barın noktası silinir.
 * Plandan yönetilmeyen (`layout_element_id` boş) servis noktalarına dokunulmaz.
 * Personel atanmış bir bar silinmek istenirse hiçbir şey yazılmadan `conflict` fırlatılır
 * (atamalar servis noktasıyla birlikte sessizce silinmesin).
 */
export async function syncBarServicePoints(tx: Tx, eventId: string, decor: Decor): Promise<void> {
  const bars = decor.elements.filter((e) => e.kind === "bar").map(barServicePoint);
  const linked = await tx
    .select({ id: servicePoints.id, name: servicePoints.name, layoutElementId: servicePoints.layoutElementId })
    .from(servicePoints)
    .where(and(eq(servicePoints.eventId, eventId), isNotNull(servicePoints.layoutElementId)));
  if (bars.length === 0 && linked.length === 0) return;

  const wanted = new Set(bars.map((b) => b.elementId));
  const removed = linked.filter((p) => p.layoutElementId !== null && !wanted.has(p.layoutElementId));
  if (removed.length > 0) {
    const removedIds = removed.map((p) => p.id);
    const staffed = await tx
      .select({ id: eventStaffAssignments.servicePointId, n: count() })
      .from(eventStaffAssignments)
      .where(and(eq(eventStaffAssignments.eventId, eventId), inArray(eventStaffAssignments.servicePointId, removedIds)))
      .groupBy(eventStaffAssignments.servicePointId);
    if (staffed.length > 0) {
      const busy = new Set(staffed.map((r) => r.id));
      const names = removed.filter((p) => busy.has(p.id)).map((p) => `"${p.name}"`).sort();
      throw new DomainError(
        "conflict",
        `Personel atanmış bar / hizmet noktası silinemez: ${names.join(", ")}. Önce atamaları kaldırın. Hiçbir değişiklik kaydedilmedi.`,
      );
    }
    await tx.delete(servicePoints).where(and(eq(servicePoints.eventId, eventId), inArray(servicePoints.id, removedIds)));
  }

  const existing = new Map(linked.map((p) => [p.layoutElementId, p.id]));
  const inserts: Array<typeof servicePoints.$inferInsert> = [];
  for (const [index, bar] of bars.entries()) {
    const id = existing.get(bar.elementId);
    if (id === undefined) {
      inserts.push({ eventId, name: bar.name, pointType: "bar", x: bar.x, y: bar.y, color: bar.color, sortOrder: index, layoutElementId: bar.elementId });
    } else {
      await tx
        .update(servicePoints)
        .set({ name: bar.name, x: bar.x, y: bar.y, color: bar.color, isActive: true, updatedAt: new Date() })
        .where(and(eq(servicePoints.eventId, eventId), eq(servicePoints.id, id)));
    }
  }
  if (inserts.length > 0) await tx.insert(servicePoints).values(inserts);
}
