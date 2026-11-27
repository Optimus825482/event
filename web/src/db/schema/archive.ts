import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, numeric, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
// drizzle-kit tsconfig yol takma adlarını çözmeyebilir; göreli içe aktarım.
import type { SaleCategory } from "../../domain/seating";
import { users } from "./auth";
import { currency, pk, timestamps, tstz } from "./columns";
// `events.ts` de bu dosyadan `artists`'i alır; döngü yalnızca tembel `references(() => …)` içinde kullanılır.
import { events } from "./events";

/** Arşiv satırının ayrıntı kopyası; etiketler de kopyalanır, okuma tarafı canlı tablolara bakmaz. */
export type ArchiveDetails = {
  categories: { category: SaleCategory; label: string; issued: number; revenue: string }[];
  financeItems: {
    direction: "expense" | "income";
    category: string;
    label: string;
    estimatedAmount: string;
    actualAmount: string | null;
  }[];
  gates: { gate: number | null; tickets: number; reservations: number }[];
};

/** Sanatçı kaydı; `name_key` büyük harfe çevrilmiş, boşlukları sadeleştirilmiş addır. */
export const artists = pgTable(
  "artists",
  {
    id: pk(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    genre: text("genre"),
    notes: text("notes"),
    image: text("image"),
    isDemo: boolean("is_demo").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [unique("artists_name_key_uq").on(t.nameKey)],
);

const count = (name: string) => integer(name).notNull().default(0);
const amount = (name: string) => numeric(name, { precision: 12, scale: 2 }).notNull().default("0");

/** Tamamlanan etkinliğin anlık görüntüsü; oranlar saklanmaz, okunurken hesaplanır. */
export const eventArchives = pgTable(
  "event_archives",
  {
    eventId: uuid("event_id")
      .primaryKey()
      .references(() => events.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull().default(1),
    archivedAt: tstz("archived_at").notNull(),
    archivedBy: uuid("archived_by").references(() => users.id, { onDelete: "set null" }),
    eventName: text("event_name").notNull(),
    startsAt: tstz("starts_at").notNull(),
    eventType: text("event_type"),
    artistId: uuid("artist_id").references(() => artists.id, { onDelete: "set null" }),
    artistName: text("artist_name"),
    artistFee: numeric("artist_fee", { precision: 12, scale: 2 }),
    currency: currency(),
    tableCount: count("table_count"),
    totalCapacity: count("total_capacity"),
    casinoTableCount: count("casino_table_count"),
    casinoSeatCount: count("casino_seat_count"),
    onlineTableCount: count("online_table_count"),
    sellableSeatCount: count("sellable_seat_count"),
    ticketsSold: count("tickets_sold"),
    demoTicketsSold: count("demo_tickets_sold"),
    ticketsCheckedIn: count("tickets_checked_in"),
    reservationCount: count("reservation_count"),
    reservationsCheckedIn: count("reservations_checked_in"),
    reservationsNoShow: count("reservations_no_show"),
    guestsExpected: count("guests_expected"),
    guestsCheckedIn: count("guests_checked_in"),
    fnbStaffCount: count("fnb_staff_count"),
    ticketRevenue: amount("ticket_revenue"),
    demoTicketRevenue: amount("demo_ticket_revenue"),
    estimatedExpense: amount("estimated_expense"),
    actualExpense: amount("actual_expense"),
    estimatedOtherIncome: amount("estimated_other_income"),
    actualOtherIncome: amount("actual_other_income"),
    details: jsonb("details").$type<ArchiveDetails>().notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [
    index("event_archives_starts_at_idx").on(t.startsAt),
    index("event_archives_artist_id_idx").on(t.artistId),
  ],
);
