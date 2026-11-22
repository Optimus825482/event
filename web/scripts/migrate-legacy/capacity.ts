import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { ACTIVE_RESERVATION_STATUSES } from "@/domain/reservation-status";
import type { Ctx } from "./context";

/**
 * Kapasite kuralı (I2): aktif bir rezervasyonun `guest_count` değeri masanın kapasitesini aşamaz;
 * yeni uygulama böyle bir rezervasyonu düzenlemeyi ve masayı kaydetmeyi reddeder. Eski sistem
 * kapasiteyi denetlemiyordu. Rezervasyon ve kişi sayısı KORUNUR (kısaltılmaz); masanın kapasitesi
 * o masadaki en büyük aktif kişi sayısına yükseltilir ve her masa/rezervasyon `capacityRaised`
 * kategorisinde listelenir. Yer tutucu masalar zaten en büyük kişi sayısına göre boyutlanır.
 */

const ACTIVE = new Set<string>(ACTIVE_RESERVATION_STATUSES);

export type CapacityInput = { id: string; eventId: string; tableId: string; guestCount?: number; status?: string };

/** Masaları eklenmiş (rezervasyonlar henüz eklenmemiş) durumda çağrılır. */
export async function raiseCapacities(ctx: Ctx, rows: readonly CapacityInput[], skipTableIds: ReadonlySet<string>): Promise<void> {
  const need = new Map<string, { max: number; rows: CapacityInput[] }>();
  for (const r of rows) {
    if (!ACTIVE.has(r.status ?? "pending") || skipTableIds.has(r.tableId)) continue;
    const entry = need.get(r.tableId) ?? { max: 0, rows: [] };
    entry.max = Math.max(entry.max, r.guestCount ?? 1);
    entry.rows.push(r);
    need.set(r.tableId, entry);
  }
  if (need.size === 0) return;
  const tables = await ctx.w.db
    .select({ id: schema.eventTables.id, eventId: schema.eventTables.eventId, label: schema.eventTables.label, capacity: schema.eventTables.capacity })
    .from(schema.eventTables)
    .where(inArray(schema.eventTables.id, [...need.keys()]));
  for (const t of tables) {
    const entry = need.get(t.id);
    if (!entry || entry.max <= t.capacity) continue;
    await ctx.w.db.update(schema.eventTables).set({ capacity: entry.max }).where(eq(schema.eventTables.id, t.id));
    ctx.add("capacityRaised", {
      eventId: t.eventId,
      tableId: t.id,
      label: t.label,
      fromCapacity: t.capacity,
      toCapacity: entry.max,
      reservationIds: entry.rows.filter((r) => (r.guestCount ?? 1) > t.capacity).map((r) => r.id),
    });
  }
}
