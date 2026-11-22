import * as schema from "@/db/schema";
import { ACTIVE_RESERVATION_STATUSES, RESERVATION_STATUSES, type ReservationStatus } from "@/domain/reservation-status";
import { LABEL_MAX, normalizeLabel } from "@/features/venue/schemas";
import { timestamps } from "./catalogs";
import { raiseCapacities } from "./capacity";
import type { Ctx } from "./context";
import type { CustomerDirectory } from "./customers";
import { byCreatedThenId, clampInt, stableId, uniqueName } from "./values";

/**
 * Rezervasyonlar. Kararlar:
 * - Masa: eski `tableId` önce yerleşim kimliğiyle, sonra etiket/masa numarasıyla eşlenir. Hiçbiri
 *   tutmazsa rezervasyon ATLANMAZ: eski referanstan etiketlenen bir yer tutucu masa oluşturulur
 *   (x=y=0, etkinlik başına referans başına bir masa) ve raporlanır.
 * - Aynı masada birden çok aktif rezervasyon (yeni kısmi tekil index'i ihlal eder): en eski
 *   oluşturulan aktif kalır, diğerleri `cancelled` olarak taşınır; gerekçe rezervasyona bağlı bir
 *   `guest_notes` satırına yazılır (rezervasyon tablosunda not sütunu yok).
 * - Kapasite (I2): aktif rezervasyon masa kapasitesini aşıyorsa masa kapasitesi yükseltilir (capacity.ts).
 * - Müşteri sayaçları (M9): son satırlardan yeniden hesaplanır (customers.ts `recomputeCounters`).
 * - QR: eski `qrCodeHash` → `legacy_qr_hash`; `qr_token` uygulamanın imzalı belirteci (qr.ts).
 */

const ACTIVE = new Set<string>(ACTIVE_RESERVATION_STATUSES);
const PLACEHOLDER_PREFIX = "Eski ";

function isStatus(value: string | null): value is ReservationStatus {
  return value !== null && (RESERVATION_STATUSES as readonly string[]).includes(value);
}

type ReservationRow = typeof schema.reservations.$inferInsert & { id: string; tableId: string; eventId: string };
type Placeholder = { row: typeof schema.eventTables.$inferInsert & { id: string; capacity: number }; ref: string; reservationIds: string[] };

export async function migrateReservations(
  ctx: Ctx,
  customers: CustomerDirectory,
): Promise<(typeof schema.guestNotes.$inferInsert)[]> {
  const placeholders = new Map<string, Placeholder>();
  const rows: ReservationRow[] = [];

  for (const r of [...ctx.legacy.reservations].sort(byCreatedThenId)) {
    const eventId = r.text("eventId");
    const ref = r.text("tableId");
    const guests = clampInt(r.int("guestCount") ?? 1, 1, 50);
    if (guests.changed) ctx.add("invalidValues", { table: "reservations", id: r.id, field: "guestCount", from: r.int("guestCount"), to: guests.value });

    let tableId = ctx.resolveTable(eventId, ref);
    if (tableId === null) {
      const byLabel = ctx.tables.get(eventId)?.byLabel.get(normalizeLabel(ref)) ?? null;
      if (byLabel !== null) {
        tableId = byLabel;
        ctx.add("tablesResolvedByLabel", { reservationId: r.id, eventId, legacyRef: ref, tableId });
      }
    }
    if (tableId === null) {
      const key = `${eventId}\u001f${ref}`;
      let ph = placeholders.get(key);
      if (!ph) {
        const index = ctx.tableIndex(eventId);
        const label = uniqueName(`${PLACEHOLDER_PREFIX}${ref.trim() || "?"}`, index.takenLabels, normalizeLabel, LABEL_MAX);
        const id = stableId("placeholder-table", eventId, ref);
        ph = {
          ref,
          reservationIds: [],
          row: { id, eventId, label, capacity: guests.value, x: 0, y: 0, rotation: 0, isLoca: false },
        };
        // byLegacyId'ye eklenmez: aynı referansı kullanan sonraki rezervasyonlar da yetim olarak raporlanır.
        placeholders.set(key, ph);
        index.ids.add(id);
      }
      ph.row.capacity = Math.min(100, Math.max(ph.row.capacity, guests.value));
      ph.reservationIds.push(r.id);
      tableId = ph.row.id;
      ctx.add("orphanTableReferences", { table: "reservations", id: r.id, eventId, legacyRef: ref, action: "yer tutucu masa", tableId });
    }

    let customerId = r.str("customerId") ? (ctx.customerAlias.get(r.text("customerId")) ?? null) : null;
    if (customerId === null) {
      const res = customers.forGuest(r);
      customerId = res.customerId;
      if (res.kind === "placeholder") {
        ctx.add("placeholderCustomers", { reservationId: r.id, customerId, hasGuestName: r.trimmed("guestName") !== null });
      } else {
        ctx.add("customersFromGuest", { reservationId: r.id, customerId, action: res.kind, matchedBy: res.matchedBy });
      }
    }

    const status = r.str("status");
    if (!isStatus(status)) ctx.add("invalidValues", { table: "reservations", id: r.id, field: "status", from: status, to: "pending" });
    const amount = r.num("totalAmount") ?? 0;
    if (amount < 0) ctx.add("invalidValues", { table: "reservations", id: r.id, field: "totalAmount", from: amount, to: 0 });
    rows.push({
      id: r.id,
      eventId,
      tableId,
      customerId,
      guestCount: guests.value,
      guestName: r.str("guestName"),
      guestPhone: r.str("guestPhone"),
      guestEmail: r.str("guestEmail"),
      specialRequests: r.str("specialRequests"),
      status: isStatus(status) ? status : "pending",
      qrToken: ctx.options.makeQrToken(r.id),
      legacyQrHash: r.str("qrCodeHash"),
      totalAmount: amount < 0 ? "0" : r.text("totalAmount", "0"),
      isPaid: r.bool("isPaid", false),
      checkedInAt: r.date("checkInTime"),
      checkedInBy: null,
      ...timestamps(r),
    });
    ctx.reservationIds.add(r.id);
  }

  const notes = resolveDoubleBookings(ctx, rows);
  // I2: kapasiteyi aşan aktif rezervasyonlar için masa kapasitesi yükseltilir (yer tutucular zaten uyumlu).
  await raiseCapacities(ctx, rows, new Set([...placeholders.values()].map((p) => p.row.id)));
  // M9: müşteri sayaçları eski değerlerden değil, taşınan rezervasyon satırlarından hesaplanır.
  customers.recomputeCounters(rows);

  for (const ph of placeholders.values()) {
    ctx.add("placeholderTables", { eventId: ph.row.eventId, tableId: ph.row.id, label: ph.row.label, legacyRef: ph.ref, reservationIds: ph.reservationIds });
  }
  await ctx.w.insert(schema.eventTables, [...placeholders.values()].map((p) => p.row));
  await customers.flush();
  await ctx.w.insert(schema.reservations, rows);
  return notes;
}

/** Aynı (etkinlik, masa) için birden çok aktif rezervasyon: en eskisi kalır, diğerleri iptal + not. */
function resolveDoubleBookings(ctx: Ctx, rows: ReservationRow[]): (typeof schema.guestNotes.$inferInsert)[] {
  const groups = new Map<string, ReservationRow[]>();
  for (const row of rows) {
    if (!ACTIVE.has(row.status ?? "pending")) continue;
    const key = `${row.eventId}:${row.tableId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const notes: (typeof schema.guestNotes.$inferInsert)[] = [];
  for (const group of groups.values()) {
    const [kept, ...others] = group; // rows zaten createdAt, id sırasında
    if (!kept || others.length === 0) continue;
    for (const other of others) {
      const legacyStatus = other.status ?? "pending";
      other.status = "cancelled";
      notes.push({
        id: stableId("double-booking-note", other.id),
        customerId: other.customerId,
        eventId: other.eventId,
        reservationId: other.id,
        noteType: "general",
        content:
          `Veri taşıma: bu rezervasyon eski sistemde "${legacyStatus}" durumundaydı. Aynı masada daha önce ` +
          `oluşturulmuş aktif rezervasyon (${kept.id}) olduğu için "cancelled" olarak taşındı.`,
      });
    }
    ctx.add("conflictingReservations", {
      eventId: kept.eventId,
      tableId: kept.tableId,
      keptReservationId: kept.id,
      cancelledReservationIds: others.map((o) => o.id),
    });
  }
  return notes;
}
