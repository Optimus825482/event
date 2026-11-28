import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  artists,
  eventSaleSettings,
  eventSeatPrices,
  eventSiteContent,
  eventTables,
  events,
  tableSeatSlots,
} from "@/db/schema";
import { SALE_CATEGORY_LABELS, wholeOnlyOf, type SaleCategory } from "@/domain/seating";
import { matchesDemoMode } from "@/features/demo/flag";
import { getSeatPrices } from "@/features/seating/prices";
import { getSaleSettings } from "@/features/seating/settings-service";
import { SALES_ACTOR } from "@/features/ticketing/internal";
import { minMoney } from "@/features/ticketing/money";
import type { PaymentProvider } from "@/features/ticketing/payment/provider";
import { providerForEvent } from "@/features/ticketing/payment/registry";
import { saleStateOf } from "@/features/ticketing/sale-state";
import { DomainError } from "@/lib/action";
import { SalesError } from "@/features/ticketing/orders-service";
import { getFloorPlan } from "@/features/venue/plan-service";
import {
  HERO_VIDEO_PATH_PATTERN,
  IMAGE_PATH_PATTERN,
  SALES_CATEGORIES,
  SIGHTLINE_SETS,
  type Availability,
  type EventCard,
  type EventDetail,
  type PlanTablePublic,
  type SightlineSet,
} from "./contract";

/** `provider`: gerçek etkinliklerin genel sağlayıcısı; demo etkinlik `providerForEvent` ile demo sağlayıcıya çözülür. */
type Ctx = { provider: PaymentProvider | null; now: Date };

const VISIBLE_STAGES = ["on_sale", "sales_closed"] as const;
const VISIBLE_STATUSES = ["published", "active"] as const;

type EventRow = typeof events.$inferSelect;

function safeImagePath(value: string | null | undefined): string | null {
  return value && IMAGE_PATH_PATTERN.test(value) ? value : null;
}

/** Hero alanı görsel ya da WebM video olabilir. */
function safeHeroPath(value: string | null | undefined): string | null {
  return value && (IMAGE_PATH_PATTERN.test(value) || HERO_VIDEO_PATH_PATTERN.test(value)) ? value : null;
}

function safeSightlineSet(value: string | null | undefined): SightlineSet | null {
  return value && (SIGHTLINE_SETS as readonly string[]).includes(value) ? (value as SightlineSet) : null;
}

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

function cardOf(
  row: EventRow,
  currency: string,
  minPrice: string | null,
  saleState: EventCard["saleState"],
  artistImage: string | null,
): EventCard {
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
    coverImage: safeImagePath(row.coverImage),
    artistImage: safeImagePath(artistImage),
    isDemo: row.isDemo,
  };
}

async function visibleEvents(ex: Db | Tx, eventId?: string): Promise<EventRow[]> {
  const conditions = [
    inArray(events.planningStage, [...VISIBLE_STAGES]),
    inArray(events.status, [...VISIBLE_STATUSES]),
    matchesDemoMode(),
  ];
  if (eventId) conditions.push(eq(events.id, eventId));
  return ex
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(asc(events.startsAt), asc(events.id));
}

/**
 * Sitede listelenebilen en az bir etkinliğin kapak, hero veya bağlı sanatçı görseli ise `true`.
 * `slot: "hero"` yalnızca hero sütununa bakar (WebM video yalnızca hero alanında geçerlidir).
 */
export async function isListedImagePath(
  ex: Db | Tx,
  imagePath: string,
  slot: "any" | "hero" = "any",
): Promise<boolean> {
  const [row] = await ex
    .select({ id: events.id })
    .from(events)
    .leftJoin(eventSiteContent, eq(eventSiteContent.eventId, events.id))
    .leftJoin(artists, eq(artists.id, events.artistId))
    .where(
      and(
        inArray(events.planningStage, [...VISIBLE_STAGES]),
        inArray(events.status, [...VISIBLE_STATUSES]),
        matchesDemoMode(),
        slot === "hero"
          ? eq(eventSiteContent.heroImage, imagePath)
          : or(eq(events.coverImage, imagePath), eq(eventSiteContent.heroImage, imagePath), eq(artists.image, imagePath)),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function listSaleEvents(ex: Db | Tx, ctx: Ctx): Promise<EventCard[]> {
  const rows = await visibleEvents(ex);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const artistIds = [...new Set(rows.map((r) => r.artistId).filter((id): id is string => id !== null))];
  const [settingsRows, priceRows, categoryRows, artistRows, heroRows] = await Promise.all([
    ex.select().from(eventSaleSettings).where(inArray(eventSaleSettings.eventId, ids)),
    ex.select().from(eventSeatPrices).where(inArray(eventSeatPrices.eventId, ids)),
    ex
      .selectDistinct({ eventId: eventTables.eventId, category: eventTables.saleCategory })
      .from(eventTables)
      .where(and(inArray(eventTables.eventId, ids), eq(eventTables.allocation, "online"))),
    artistIds.length > 0
      ? ex.select({ id: artists.id, image: artists.image }).from(artists).where(inArray(artists.id, artistIds))
      : Promise.resolve([]),
    ex.select({ eventId: eventSiteContent.eventId, image: eventSiteContent.heroImage })
      .from(eventSiteContent).where(inArray(eventSiteContent.eventId, ids)),
  ]);
  const artistImageById = new Map(artistRows.map((a) => [a.id, a.image]));
  const heroByEvent = new Map(heroRows.map((hero) => [hero.eventId, safeHeroPath(hero.image)]));
  const cards: EventCard[] = [];
  for (const row of rows) {
    const settings = settingsRows.find((s) => s.eventId === row.id);
    const state = saleStateOf({
      planningStage: row.planningStage,
      status: row.status,
      saleStartsAt: settings?.saleStartsAt ?? null,
      saleEndsAt: settings?.saleEndsAt ?? null,
      providerActive: providerForEvent(row, ctx.provider) !== null,
      now: ctx.now,
    });
    if (state === null) continue;
    const online = new Set(categoryRows.filter((c) => c.eventId === row.id).map((c) => c.category));
    const finals: Partial<Record<SaleCategory, string | null>> = {};
    for (const p of priceRows) if (p.eventId === row.id) finals[p.category] = p.finalPrice;
    const minPrice = minMoney(pricesOf(finals, online).map((p) => p.price));
    const artistImage = row.artistId ? (artistImageById.get(row.artistId) ?? null) : null;
    cards.push({ ...cardOf(row, settings?.currency ?? "TRY", minPrice, state, artistImage), heroImage: heroByEvent.get(row.id) ?? null });
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
    providerActive: providerForEvent(row, ctx.provider) !== null,
    now: ctx.now,
  });
  if (state === null) return null;

  const [plan, seatPrices, slotRows, siteRows, artistRows] = await Promise.all([
    getFloorPlan(ex, SALES_ACTOR, eventId).catch((error: unknown) => {
      if (error instanceof DomainError && error.code === "not_found") throw new SalesError("event_not_found");
      throw error;
    }),
    getSeatPrices(ex, eventId),
    ex
      .select({ tableId: tableSeatSlots.tableId, seatNo: tableSeatSlots.seatNo })
      .from(tableSeatSlots)
      .where(eq(tableSeatSlots.eventId, eventId))
      .orderBy(asc(tableSeatSlots.seatNo)),
    ex.select().from(eventSiteContent).where(eq(eventSiteContent.eventId, eventId)),
    row.artistId
      ? ex.select({ image: artists.image }).from(artists).where(eq(artists.id, row.artistId))
      : Promise.resolve([]),
  ]);
  const slotsByTable = new Map<string, number[]>();
  for (const s of slotRows) {
    const list = slotsByTable.get(s.tableId);
    if (list) list.push(s.seatNo);
    else slotsByTable.set(s.tableId, [s.seatNo]);
  }

  const online = new Set<SaleCategory>();
  const tables: PlanTablePublic[] = plan.tables.map((t) => {
    const sellable = t.allocation === "online";
    const category = sellable ? (t.category ?? "standard") : null;
    if (category) online.add(category);
    const seatNos = sellable ? (slotsByTable.get(t.id) ?? []) : [];
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
      capacity: t.capacity,
      seats: sellable ? seatNos.length : null,
      seatNos,
      wholeOnly: sellable
        ? wholeOnlyOf({ saleMode: settings.saleMode, sharedTables: settings.sharedTables, isLoca: t.isLoca })
        : false,
    };
  });

  const finals: Partial<Record<SaleCategory, string | null>> = {};
  for (const c of SALES_CATEGORIES) finals[c] = seatPrices[c].finalPrice;
  const prices = pricesOf(finals, online);
  const artistImage = artistRows[0]?.image ?? null;
  const card = cardOf(row, settings.currency, minMoney(prices.map((p) => p.price)), state, artistImage);
  const siteRow = siteRows[0];
  return {
    ...card,
    description: row.description,
    site: {
      heroImage: safeHeroPath(siteRow?.heroImage),
      summary: siteRow?.summary ?? null,
      doorsOpenAt: siteRow?.doorsOpenAt ? siteRow.doorsOpenAt.toISOString() : null,
      ageLimit: siteRow?.ageLimit ?? null,
      dressCode: siteRow?.dressCode ?? null,
      sightlineSet: safeSightlineSet(siteRow?.sightlineSet),
    },
    sale: {
      state,
      mode: settings.saleMode,
      opensAt: settings.saleStartsAt ? settings.saleStartsAt.toISOString() : null,
      closesAt: settings.saleEndsAt ? settings.saleEndsAt.toISOString() : null,
      holdMinutes: settings.holdMinutes,
      maxSeatsPerOrder: settings.maxSeatsPerOrder,
      blockSingleLeftover: settings.blockSingleLeftover,
      demo: providerForEvent(row, ctx.provider)?.isDemo ?? false,
    },
    prices,
    plan: { canvas: plan.canvas, tables, decor: plan.decor, lines: plan.lines ?? [] },
  };
}

export async function computeAvailability(ex: Db | Tx, eventId: string, now: Date): Promise<Availability | null> {
  const [row] = await visibleEvents(ex, eventId);
  if (!row) return null;
  const result = await ex.execute<{ table_id: string; seat_no: number; occupied: boolean }>(sql`
    select s.table_id,
           s.seat_no,
           exists (
             select 1
               from tickets t
               join orders o on o.id = t.order_id
              where t.seat_slot_id = s.id
                and (
                  t.status = 'issued'
                  or (t.status = 'held' and o.status = 'pending' and o.hold_expires_at > clock_timestamp())
                )
           ) as occupied
      from table_seat_slots s
      join event_tables et on et.id = s.table_id
     where s.event_id = ${eventId}
       and et.allocation = 'online'
     order by s.table_id, s.seat_no
  `);
  const freeSeatsByTable = new Map<string, number[]>();
  for (const r of result.rows) {
    let list = freeSeatsByTable.get(r.table_id);
    if (!list) {
      list = [];
      freeSeatsByTable.set(r.table_id, list);
    }
    if (!r.occupied) list.push(r.seat_no);
  }
  const tables = [...freeSeatsByTable.entries()]
    .map(([id, freeSeats]) => ({ id, free: freeSeats.length, freeSeats }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { at: now.toISOString(), tables };
}
