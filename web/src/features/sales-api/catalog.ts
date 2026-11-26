import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventSaleSettings, eventSeatPrices, eventTables, events, tableSeatSlots } from "@/db/schema";
import { SALE_CATEGORY_LABELS, type SaleCategory } from "@/domain/seating";
import { getSeatPrices } from "@/features/seating/prices";
import { getSaleSettings } from "@/features/seating/settings-service";
import { SALES_ACTOR } from "@/features/ticketing/internal";
import { minMoney } from "@/features/ticketing/money";
import { getSeatOccupancy } from "@/features/ticketing/occupancy";
import type { PaymentProvider } from "@/features/ticketing/payment/provider";
import { saleStateOf } from "@/features/ticketing/sale-state";
import { DomainError } from "@/lib/action";
import { SalesError } from "@/features/ticketing/orders-service";
import { getFloorPlan } from "@/features/venue/plan-service";
import {
  SALES_CATEGORIES,
  type Availability,
  type EventCard,
  type EventDetail,
  type PlanTablePublic,
} from "./contract";

type Ctx = { provider: PaymentProvider | null; now: Date };

const VISIBLE_STAGES = ["on_sale", "sales_closed"] as const;
const VISIBLE_STATUSES = ["published", "active"] as const;

type EventRow = typeof events.$inferSelect;

function pricesOf(
  finals: Partial<Record<SaleCategory, string | null>>,
  onlineCategories: ReadonlySet<SaleCategory>,
): { category: SaleCategory; label: string; price: string }[] {
  const result: { category: SaleCategory; label: string; price: string }[] = [];
  for (const category of SALES_CATEGORIES) {
    const price = finals[category];
    if (onlineCategories.has(category) && price) result.push({ category, label: SALE_CATEGORY_LABELS[category], price });
  }
  return result;
}

function cardOf(row: EventRow, currency: string, minPrice: string | null, saleState: EventCard["saleState"]): EventCard {
  return {
    id: row.id,
    name: row.name,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    artistName: row.artistName,
    eventType: row.eventType,
    currency,
    minPrice,
    saleState,
  };
}

async function visibleEvents(ex: Db | Tx, eventId?: string): Promise<EventRow[]> {
  const conditions = [
    inArray(events.planningStage, [...VISIBLE_STAGES]),
    inArray(events.status, [...VISIBLE_STATUSES]),
  ];
  if (eventId) conditions.push(eq(events.id, eventId));
  return ex
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(asc(events.startsAt), asc(events.id));
}

export async function listSaleEvents(ex: Db | Tx, ctx: Ctx): Promise<EventCard[]> {
  const rows = await visibleEvents(ex);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [settingsRows, priceRows, categoryRows] = await Promise.all([
    ex.select().from(eventSaleSettings).where(inArray(eventSaleSettings.eventId, ids)),
    ex.select().from(eventSeatPrices).where(inArray(eventSeatPrices.eventId, ids)),
    ex
      .selectDistinct({ eventId: eventTables.eventId, category: eventTables.saleCategory })
      .from(eventTables)
      .where(and(inArray(eventTables.eventId, ids), eq(eventTables.allocation, "online"))),
  ]);
  const cards: EventCard[] = [];
  for (const row of rows) {
    const settings = settingsRows.find((s) => s.eventId === row.id);
    const state = saleStateOf({
      planningStage: row.planningStage,
      status: row.status,
      saleStartsAt: settings?.saleStartsAt ?? null,
      saleEndsAt: settings?.saleEndsAt ?? null,
      providerActive: ctx.provider !== null,
      now: ctx.now,
    });
    if (state === null) continue;
    const online = new Set(categoryRows.filter((c) => c.eventId === row.id).map((c) => c.category));
    const finals: Partial<Record<SaleCategory, string | null>> = {};
    for (const p of priceRows) if (p.eventId === row.id) finals[p.category] = p.finalPrice;
    const minPrice = minMoney(pricesOf(finals, online).map((p) => p.price));
    cards.push(cardOf(row, settings?.currency ?? "TRY", minPrice, state));
  }
  return cards;
}

export async function getSaleEventDetail(ex: Db | Tx, eventId: string, ctx: Ctx): Promise<EventDetail | null> {
  const [row] = await visibleEvents(ex, eventId);
  if (!row) return null;
  const settings = await getSaleSettings(ex, eventId);
  const state = saleStateOf({
    planningStage: row.planningStage,
    status: row.status,
    saleStartsAt: settings.saleStartsAt,
    saleEndsAt: settings.saleEndsAt,
    providerActive: ctx.provider !== null,
    now: ctx.now,
  });
  if (state === null) return null;

  const [plan, seatPrices, slotRows] = await Promise.all([
    getFloorPlan(ex, SALES_ACTOR, eventId).catch((error: unknown) => {
      if (error instanceof DomainError && error.code === "not_found") throw new SalesError("event_not_found");
      throw error;
    }),
    getSeatPrices(ex, eventId),
    ex.select({ tableId: tableSeatSlots.tableId }).from(tableSeatSlots).where(eq(tableSeatSlots.eventId, eventId)),
  ]);
  const slots = new Map<string, number>();
  for (const s of slotRows) slots.set(s.tableId, (slots.get(s.tableId) ?? 0) + 1);

  const online = new Set<SaleCategory>();
  const tables: PlanTablePublic[] = plan.tables.map((t) => {
    const sellable = t.allocation === "online";
    const category = sellable ? (t.category ?? "standard") : null;
    if (category) online.add(category);
    return {
      id: t.id,
      label: t.label,
      x: t.x,
      y: t.y,
      rotation: t.rotation,
      shape: t.shape,
      isLoca: t.isLoca,
      sellable,
      category,
      seats: sellable ? (slots.get(t.id) ?? 0) : null,
      wholeOnly: sellable ? !settings.sharedTables || t.isLoca : false,
    };
  });

  const finals: Partial<Record<SaleCategory, string | null>> = {};
  for (const c of SALES_CATEGORIES) finals[c] = seatPrices[c].finalPrice;
  const prices = pricesOf(finals, online);
  const card = cardOf(row, settings.currency, minMoney(prices.map((p) => p.price)), state);
  return {
    ...card,
    description: row.description,
    sale: {
      state,
      opensAt: settings.saleStartsAt ? settings.saleStartsAt.toISOString() : null,
      closesAt: settings.saleEndsAt ? settings.saleEndsAt.toISOString() : null,
      holdMinutes: settings.holdMinutes,
      maxSeatsPerOrder: settings.maxSeatsPerOrder,
      blockSingleLeftover: settings.blockSingleLeftover,
      demo: ctx.provider?.isDemo ?? false,
    },
    prices,
    plan: { canvas: plan.canvas, tables, decor: plan.decor, lines: plan.lines ?? [] },
  };
}

export async function computeAvailability(ex: Db | Tx, eventId: string, now: Date): Promise<Availability | null> {
  const [row] = await visibleEvents(ex, eventId);
  if (!row) return null;
  const [slotRows, occupancy] = await Promise.all([
    ex
      .select({ tableId: tableSeatSlots.tableId })
      .from(tableSeatSlots)
      .innerJoin(eventTables, eq(eventTables.id, tableSeatSlots.tableId))
      .where(and(eq(tableSeatSlots.eventId, eventId), eq(eventTables.allocation, "online"))),
    getSeatOccupancy(ex, eventId),
  ]);
  const totals = new Map<string, number>();
  for (const s of slotRows) totals.set(s.tableId, (totals.get(s.tableId) ?? 0) + 1);
  const tables = [...totals.entries()]
    .map(([id, total]) => {
      const used = occupancy.get(id);
      const free = total - (used ? used.held + used.issued : 0);
      return { id, free: free < 0 ? 0 : free };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { at: now.toISOString(), tables };
}
