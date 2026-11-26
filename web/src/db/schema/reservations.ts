import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// drizzle-kit tsconfig yol takma adlarını çözmeyebilir; göreli içe aktarım.
import { ACTIVE_RESERVATION_STATUSES, RESERVATION_STATUSES } from "../../domain/reservation-status";
import { randomBookingCode } from "../../lib/short-code";
import { users } from "./auth";
import { createdOnly, currency, money, pk, timestamps, tstz } from "./columns";
import { eventTables, events } from "./events";
import { customers } from "./people";
import { tickets } from "./ticketing";

export const reservationStatus = pgEnum("reservation_status", RESERVATION_STATUSES);

/** `'pending', 'confirmed', 'checked_in'`: kısmi tekil index yüklemi bu listeden üretilir. */
const ACTIVE_STATUS_LIST = ACTIVE_RESERVATION_STATUSES.map((s) => `'${s}'`).join(", ");

export const reservations = pgTable(
  "reservations",
  {
    id: pk(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "restrict" }),
    // (event_id, table_id) → event_tables(event_id, id) bileşik yabancı anahtarı aşağıda.
    tableId: uuid("table_id").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    guestCount: integer("guest_count").notNull(),
    // Rezervasyon anındaki misafir bilgisi (eski sistemden taşınan anlık görüntü).
    guestName: text("guest_name"),
    guestPhone: text("guest_phone"),
    guestEmail: text("guest_email"),
    specialRequests: text("special_requests"),
    status: reservationStatus("status").notNull().default("pending"),
    qrToken: text("qr_token").notNull().unique(),
    /** Müşteriye söylenen kısa rezervasyon kodu (`R` + 6 karakter). */
    bookingCode: text("booking_code")
      .notNull()
      .unique("reservations_booking_code_uq")
      .$defaultFn(() => randomBookingCode()),
    /**
     * Etkin rezervasyonda 'casino', değilse null (üretilmiş sütun). `reservations_casino_table_fk` ile
     * etkin rezervasyonun masası yalnızca Casino'ya tahsisli olabilir; null iken FK denetlenmez.
     */
    allocationLock: text("allocation_lock").generatedAlwaysAs(
      sql.raw(`CASE WHEN status IN (${ACTIVE_STATUS_LIST}) THEN 'casino' END`),
    ),
    legacyQrHash: text("legacy_qr_hash").unique(),
    totalAmount: money("total_amount"),
    currency: currency(),
    isPaid: boolean("is_paid").notNull().default(false),
    checkedInAt: tstz("checked_in_at"),
    checkedInBy: uuid("checked_in_by").references(() => users.id, { onDelete: "set null" }),
    /** Girişin yapıldığı kapı (1–9); kapı seçilmemişse ya da eski kayıtta boş. */
    checkInGate: smallint("check_in_gate"),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: "reservations_event_table_fk",
      columns: [t.eventId, t.tableId],
      foreignColumns: [eventTables.eventId, eventTables.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "reservations_casino_table_fk",
      columns: [t.eventId, t.tableId, t.allocationLock],
      foreignColumns: [eventTables.eventId, eventTables.id, eventTables.allocation],
    }).onDelete("restrict"),
    // Çifte rezervasyon veritabanında imkânsız: bir masada aynı anda tek aktif rezervasyon.
    uniqueIndex("reservations_active_table_uq")
      .on(t.eventId, t.tableId)
      .where(sql.raw(`status IN (${ACTIVE_STATUS_LIST})`)),
    check("reservations_guest_count_range", sql`${t.guestCount} BETWEEN 1 AND 50`),
    check("reservations_total_amount_non_negative", sql`${t.totalAmount} >= 0`),
    check("reservations_gate_range", sql`${t.checkInGate} BETWEEN 1 AND 9`),
    index("reservations_event_table_idx").on(t.eventId, t.tableId),
    index("reservations_event_status_idx").on(t.eventId, t.status),
    index("reservations_customer_id_idx").on(t.customerId),
    index("reservations_checked_in_by_idx").on(t.checkedInBy),
  ],
);

export const checkInOutcome = pgEnum("check_in_outcome", [
  "checked_in",
  "already_checked_in",
  "not_found",
  "invalid_status",
]);

/** Her check-in denemesinin değişmez kaydı; çevrimdışı kuyruk tekrarları `idempotency_key` ile elenir. */
export const checkInEvents = pgTable(
  "check_in_events",
  {
    id: pk(),
    // QR çözülemediyse (not_found) rezervasyon yoktur.
    reservationId: uuid("reservation_id").references(() => reservations.id, { onDelete: "restrict" }),
    // Bilet girişinde hedef bilettir; bir kayıt en çok bir hedefe bağlanır (aşağıdaki kısıt).
    // Tembel başvuru: ticketing ↔ reservations döngüsel içe aktarmaya karşı.
    ticketId: uuid("ticket_id").references((): AnyPgColumn => tickets.id, { onDelete: "restrict" }),
    /** Denemenin yapıldığı kapı (1–9); kapısız cihazda ya da eski kayıtta boş. */
    gate: smallint("gate"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    clientTimestamp: tstz("client_timestamp"),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    outcome: checkInOutcome("outcome").notNull(),
    // İsteğin özeti (sha256): aynı anahtar farklı bir istekle gelirse tekrar sayılmaz.
    requestFingerprint: text("request_fingerprint"),
    // İlk çağrının yanıtı (ActionResult); aynı anahtarlı tekrarlar bunu aynen alır. Eski kayıtlarda boş.
    response: jsonb("response"),
    ...createdOnly(),
  },
  (t) => [
    index("check_in_events_reservation_id_idx").on(t.reservationId),
    index("check_in_events_actor_id_idx").on(t.actorId),
    index("check_in_events_ticket_id_idx").on(t.ticketId),
    check("check_in_events_gate_range", sql`${t.gate} BETWEEN 1 AND 9`),
    check("check_in_events_single_target", sql`${t.reservationId} IS NULL OR ${t.ticketId} IS NULL`),
  ],
);
