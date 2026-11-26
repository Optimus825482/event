import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// drizzle-kit tsconfig yol takma adlarını çözmeyebilir; göreli içe aktarım.
import type { SaleCategory } from "../../domain/seating";
import { users } from "./auth";
import { createdOnly, pk, timestamps, tstz } from "./columns";
import { eventTables, events } from "./events";
import { tableSeatSlots } from "./seating";

export type OrderStatus = "pending" | "paid" | "expired";
export type TicketStatus = "held" | "issued" | "expired";
export type PaymentOutcome = "approved" | "declined" | "error";

/** Sipariş: tutma (`pending`) ödemeyle `paid` olur, süresi dolunca ya da bırakılınca `expired`. */
export const orders = pgTable(
  "orders",
  {
    id: pk(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "restrict" }),
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    pnr: text("pnr"),
    /** Tutma isteğinin idempotency anahtarı. */
    clientKey: uuid("client_key").notNull(),
    holdExpiresAt: tstz("hold_expires_at").notNull(),
    // Tutar ve para birimi bilerek varsayılansız: tutarı verilmemiş sipariş sessizce 0 olmasın.
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    // Alıcı bilgileri ödeme anında yazılır.
    buyerFirstName: text("buyer_first_name"),
    buyerLastName: text("buyer_last_name"),
    buyerLastNameKey: text("buyer_last_name_key"),
    buyerEmail: text("buyer_email"),
    buyerPhone: text("buyer_phone"),
    termsAcceptedAt: tstz("terms_accepted_at"),
    paymentProvider: text("payment_provider"),
    isDemo: boolean("is_demo").notNull().default(false),
    paidAt: tstz("paid_at"),
    eticketSentAt: tstz("eticket_sent_at"),
    ...timestamps(),
  },
  (t) => [
    check("orders_status_valid", sql`${t.status} IN ('pending', 'paid', 'expired')`),
    check("orders_total_non_negative", sql`${t.totalAmount} >= 0`),
    check(
      "orders_paid_complete",
      sql`${t.status} <> 'paid' OR (${t.pnr} IS NOT NULL AND ${t.paidAt} IS NOT NULL AND ${t.buyerLastNameKey} IS NOT NULL AND ${t.buyerEmail} IS NOT NULL AND ${t.termsAcceptedAt} IS NOT NULL AND ${t.paymentProvider} IS NOT NULL)`,
    ),
    unique("orders_pnr_uq").on(t.pnr),
    unique("orders_client_key_uq").on(t.clientKey),
    index("orders_event_status_idx").on(t.eventId, t.status),
    index("orders_pending_expiry_idx").on(t.holdExpiresAt).where(sql.raw(`status = 'pending'`)),
  ],
);

/** Tutma ve bilet aynı satırdır: `held` ödemeyle `issued` olur; `expired` yuvayı bırakır. */
export const tickets = pgTable(
  "tickets",
  {
    id: pk(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    eventId: uuid("event_id").notNull(),
    tableId: uuid("table_id").notNull(),
    seatSlotId: uuid("seat_slot_id"),
    status: text("status").$type<TicketStatus>().notNull().default("held"),
    /** Satış anındaki kategori ve fiyatın anlık görüntüsü. */
    saleCategory: text("sale_category").$type<SaleCategory>().notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    qrToken: text("qr_token"),
    checkedInAt: tstz("checked_in_at"),
    checkedInBy: uuid("checked_in_by").references(() => users.id, { onDelete: "set null" }),
    checkInGate: smallint("check_in_gate"),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: "tickets_event_table_fk",
      columns: [t.eventId, t.tableId],
      foreignColumns: [eventTables.eventId, eventTables.id],
    }).onDelete("restrict"),
    // Bilet yalnızca kendi masasının yuvasına bağlanır; bileti olan yuva silinemez.
    foreignKey({
      name: "tickets_seat_slot_fk",
      columns: [t.tableId, t.seatSlotId],
      foreignColumns: [tableSeatSlots.tableId, tableSeatSlots.id],
    }).onDelete("restrict"),
    check("tickets_status_valid", sql`${t.status} IN ('held', 'issued', 'expired')`),
    check("tickets_active_has_slot", sql`(${t.status} IN ('held', 'issued')) = (${t.seatSlotId} IS NOT NULL)`),
    check("tickets_issued_has_qr", sql`${t.status} <> 'issued' OR ${t.qrToken} IS NOT NULL`),
    check("tickets_gate_range", sql`${t.checkInGate} BETWEEN 1 AND 9`),
    unique("tickets_qr_token_uq").on(t.qrToken),
    // Çifte satış veritabanında imkânsız: bir yuvada aynı anda tek etkin tutma/bilet.
    uniqueIndex("tickets_active_seat_uq")
      .on(t.seatSlotId)
      .where(sql.raw(`status IN ('held', 'issued')`)),
    index("tickets_order_id_idx").on(t.orderId),
    index("tickets_event_table_status_idx").on(t.eventId, t.tableId, t.status),
  ],
);

/** Ödeme denemeleri; reddedilen deneme de iz olarak kalır. Kart verisi saklanmaz. */
export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: pk(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    outcome: text("outcome").$type<PaymentOutcome>().notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    providerRef: text("provider_ref"),
    isDemo: boolean("is_demo").notNull(),
    ...createdOnly(),
  },
  (t) => [
    check("payment_attempts_outcome_valid", sql`${t.outcome} IN ('approved', 'declined', 'error')`),
    index("payment_attempts_order_id_idx").on(t.orderId),
  ],
);
