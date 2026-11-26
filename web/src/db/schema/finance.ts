import { sql } from "drizzle-orm";
import { check, index, integer, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
// drizzle-kit tsconfig yol takma adlarını çözmeyebilir; göreli içe aktarım.
import type { CasinoCostMode, FinanceCategory, FinanceDirection } from "../../features/finance/constants";
import { users } from "./auth";
import { money, pk, timestamps, tstz } from "./columns";
import { events } from "./events";

/** Etkinlik başına finans planı: hedef kâr ve Casino maliyet kipi; satır yoksa varsayılanlar geçerlidir. */
export const eventFinancePlans = pgTable(
  "event_finance_plans",
  {
    eventId: uuid("event_id")
      .primaryKey()
      .references(() => events.id, { onDelete: "cascade" }),
    targetProfit: money("target_profit"),
    casinoCostMode: text("casino_cost_mode").$type<CasinoCostMode>().notNull().default("free"),
    casinoTransferPrice: money("casino_transfer_price"),
    /** Son tavsiye fiyat hesabının zamanı. */
    recommendedAt: tstz("recommended_at"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    check("event_finance_plans_target_non_negative", sql`${t.targetProfit} >= 0`),
    check("event_finance_plans_casino_mode_valid", sql`${t.casinoCostMode} IN ('free', 'transfer')`),
    check("event_finance_plans_transfer_price_non_negative", sql`${t.casinoTransferPrice} >= 0`),
  ],
);

/** Etkinliğin gider ve gelir kalemleri (bilet geliri hariç); tahmini ve gerçekleşen tutarlar. */
export const eventFinanceItems = pgTable(
  "event_finance_items",
  {
    id: pk(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    direction: text("direction").$type<FinanceDirection>().notNull(),
    category: text("category").$type<FinanceCategory>().notNull(),
    label: text("label").notNull(),
    estimatedAmount: money("estimated_amount"),
    // money() not null üretir; gerçekleşen tutar girilene kadar boştur.
    actualAmount: numeric("actual_amount", { precision: 12, scale: 2 }),
    note: text("note"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    check("event_finance_items_direction_valid", sql`${t.direction} IN ('expense', 'income')`),
    check(
      "event_finance_items_category_valid",
      sql`${t.category} IN ('artist_fee', 'production', 'fnb', 'staff', 'marketing', 'sponsorship', 'other')`,
    ),
    check(
      "event_finance_items_amounts_non_negative",
      sql`${t.estimatedAmount} >= 0 AND (${t.actualAmount} IS NULL OR ${t.actualAmount} >= 0)`,
    ),
    index("event_finance_items_event_sort_idx").on(t.eventId, t.sortOrder),
  ],
);
