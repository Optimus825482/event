import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
// drizzle-kit tsconfig yol takma adlarını çözmeyebilir; göreli içe aktarım.
import type { SaleCategory } from "../../domain/seating";
import { users } from "./auth";
import { createdOnly, currency, pk, timestamps, tstz } from "./columns";
import { eventTables, events } from "./events";

/** Etkinlik başına online satış ayarları; satır yoksa varsayılanlar geçerlidir. */
export const eventSaleSettings = pgTable(
  "event_sale_settings",
  {
    eventId: uuid("event_id")
      .primaryKey()
      .references(() => events.id, { onDelete: "cascade" }),
    /** Bir masanın sandalyeleri farklı siparişlere satılabilir. */
    sharedTables: boolean("shared_tables").notNull().default(true),
    /** Masada tek boş sandalye bırakan sipariş engellenir. */
    blockSingleLeftover: boolean("block_single_leftover").notNull().default(true),
    /** Localar online satışa açılabilir. */
    locaOnline: boolean("loca_online").notNull().default(false),
    /** Sepette tutma süresi (dakika). */
    holdMinutes: integer("hold_minutes").notNull().default(10),
    maxSeatsPerOrder: integer("max_seats_per_order").notNull().default(12),
    saleStartsAt: tstz("sale_starts_at"),
    saleEndsAt: tstz("sale_ends_at"),
    currency: currency(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    check("event_sale_settings_hold_minutes_range", sql`${t.holdMinutes} BETWEEN 5 AND 30`),
    check("event_sale_settings_max_seats_range", sql`${t.maxSeatsPerOrder} BETWEEN 1 AND 50`),
    check(
      "event_sale_settings_window_valid",
      sql`${t.saleEndsAt} IS NULL OR ${t.saleStartsAt} IS NULL OR ${t.saleEndsAt} > ${t.saleStartsAt}`,
    ),
  ],
);

/** Kategori başına sandalye fiyatı (Faz 5 doldurur, Faz 6 okur). */
export const eventSeatPrices = pgTable(
  "event_seat_prices",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    category: text("category").$type<SaleCategory>().notNull(),
    finalPrice: numeric("final_price", { precision: 12, scale: 2 }),
    recommendedPrice: numeric("recommended_price", { precision: 12, scale: 2 }),
    coefficient: numeric("coefficient", { precision: 6, scale: 3 }).notNull().default("1"),
    finalSetBy: uuid("final_set_by").references(() => users.id, { onDelete: "set null" }),
    finalSetAt: tstz("final_set_at"),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.category] }),
    check("event_seat_prices_category_valid", sql`${t.category} IN ('standard', 'premium', 'vip')`),
    check("event_seat_prices_final_positive", sql`${t.finalPrice} IS NULL OR ${t.finalPrice} > 0`),
    check(
      "event_seat_prices_recommended_non_negative",
      sql`${t.recommendedPrice} IS NULL OR ${t.recommendedPrice} >= 0`,
    ),
    check("event_seat_prices_coefficient_positive", sql`${t.coefficient} > 0`),
  ],
);

/** İsimsiz sandalye yuvaları; yalnızca online tahsisli masalarda bulunur. */
export const tableSeatSlots = pgTable(
  "table_seat_slots",
  {
    id: pk(),
    eventId: uuid("event_id").notNull(),
    tableId: uuid("table_id").notNull(),
    // Sabit 'online': bileşik FK masanın online tahsisli olmasını zorlar.
    allocation: text("allocation").$type<"online">().notNull().default("online"),
    seatNo: integer("seat_no").notNull(),
    ...createdOnly(),
  },
  (t) => [
    check("table_seat_slots_allocation_online", sql`${t.allocation} = 'online'`),
    check("table_seat_slots_seat_no_positive", sql`${t.seatNo} >= 1`),
    foreignKey({
      name: "table_seat_slots_online_table_fk",
      columns: [t.eventId, t.tableId, t.allocation],
      foreignColumns: [eventTables.eventId, eventTables.id, eventTables.allocation],
    }).onDelete("cascade"),
    unique("table_seat_slots_table_seat_uq").on(t.tableId, t.seatNo),
    // Bilet satırlarının bileşik yabancı anahtar hedefi.
    unique("table_seat_slots_table_id_id_uq").on(t.tableId, t.id),
    index("table_seat_slots_event_table_idx").on(t.eventId, t.tableId),
  ],
);
