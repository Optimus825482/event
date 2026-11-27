import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  artists,
  eventSaleSettings,
  eventSiteContent,
  eventTables,
  events,
  orders,
  systemSettings,
  tableSeatSlots,
  tickets,
} from "@/db/schema";
import type { SaleMode } from "@/domain/seating";
import { authorize, can } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import type { SaleState } from "@/features/sales-api/contract";
import { saleStateOf } from "@/features/ticketing/sale-state";
import { zonedDayStart, zonedNextDayStart } from "@/lib/time-zone";
import { imageStatusOf, type ImageStatus } from "./image-status";

export type SalesSiteRow = {
  eventId: string;
  name: string;
  startsAt: string;
  isDemo: boolean;
  siteState: SaleState | null;
  saleMode: SaleMode;
  sold: number | null;
  occupancyPercent: number | null;
  images: ImageStatus;
};

export type SalesSummaryRow = {
  isDemo: boolean;
  currency: string;
  todayTickets: number;
  todayRevenue: string;
  totalTickets: number;
  totalRevenue: string;
};

export type SalesSiteOverview = {
  demoEnabled: boolean;
  canSeeSales: boolean;
  summary: SalesSummaryRow[] | null;
  rows: SalesSiteRow[];
};

const MAX_ROWS = 500;

/** Satış sitesi yönetim ekranı için demo durumu, gerçek/demo ayrı satış özeti ve etkinlik tablosunu döndürür. */
export async function getSalesSiteOverview(
  ex: Db | Tx,
  actor: Actor,
  ctx: { now: Date; providerActive: boolean },
): Promise<SalesSiteOverview> {
  authorize(actor, "events", "view");
  const canSeeSales = can(actor, "ticketing", "view");

  const [settingsRows, eventRows] = await Promise.all([
    ex.select({ salesDemoEnabled: systemSettings.salesDemoEnabled }).from(systemSettings).limit(1),
    ex
      .select({
        eventId: events.id,
        name: events.name,
        startsAt: events.startsAt,
        planningStage: events.planningStage,
        status: events.status,
        isDemo: events.isDemo,
        coverImage: events.coverImage,
        artistId: events.artistId,
        heroImage: eventSiteContent.heroImage,
        artistImage: artists.image,
        saleStartsAt: eventSaleSettings.saleStartsAt,
        saleEndsAt: eventSaleSettings.saleEndsAt,
        saleMode: eventSaleSettings.saleMode,
      })
      .from(events)
      .leftJoin(eventSaleSettings, eq(eventSaleSettings.eventId, events.id))
      .leftJoin(eventSiteContent, eq(eventSiteContent.eventId, events.id))
      .leftJoin(artists, eq(artists.id, events.artistId))
      .orderBy(desc(events.startsAt), asc(events.id))
      .limit(MAX_ROWS),
  ]);

  const demoEnabled = settingsRows[0]?.salesDemoEnabled ?? false;

  if (!canSeeSales) {
    return {
      demoEnabled,
      canSeeSales: false,
      summary: null,
      rows: eventRows.map((r) => ({
        eventId: r.eventId,
        name: r.name,
        startsAt: r.startsAt.toISOString(),
        isDemo: r.isDemo,
        siteState: saleStateOf({
          planningStage: r.planningStage,
          status: r.status,
          saleStartsAt: r.saleStartsAt ?? null,
          saleEndsAt: r.saleEndsAt ?? null,
          providerActive: ctx.providerActive,
          now: ctx.now,
        }),
        saleMode: r.saleMode ?? "seat",
        sold: null,
        occupancyPercent: null,
        images: imageStatusOf({
          coverImage: r.coverImage,
          heroImage: r.heroImage,
          artistId: r.artistId,
          artistImage: r.artistImage,
        }),
      })),
    };
  }

  const eventIds = eventRows.map((r) => r.eventId);
  const todayStart = zonedDayStart(ctx.now);
  const todayEnd = zonedNextDayStart(ctx.now);

  const [slotRows, soldRows, summaryRows] = await Promise.all([
    eventIds.length > 0
      ? ex
          .select({
            eventId: tableSeatSlots.eventId,
            count: sql<number>`count(*)::int`,
          })
          .from(tableSeatSlots)
          .innerJoin(eventTables, eq(eventTables.id, tableSeatSlots.tableId))
          .where(and(inArray(tableSeatSlots.eventId, eventIds), eq(eventTables.allocation, "online")))
          .groupBy(tableSeatSlots.eventId)
      : Promise.resolve([]),
    eventIds.length > 0
      ? ex
          .select({
            eventId: tickets.eventId,
            count: sql<number>`count(*)::int`,
          })
          .from(tickets)
          .where(and(inArray(tickets.eventId, eventIds), eq(tickets.status, "issued")))
          .groupBy(tickets.eventId)
      : Promise.resolve([]),
    ex
      .select({
        isDemo: events.isDemo,
        currency: orders.currency,
        todayTickets: sql<number>`count(*) filter (where ${orders.paidAt} >= ${todayStart} and ${orders.paidAt} < ${todayEnd})::int`,
        todayRevenue: sql<string>`coalesce(sum(${tickets.unitPrice}) filter (where ${orders.paidAt} >= ${todayStart} and ${orders.paidAt} < ${todayEnd}), 0)::numeric(12,2)::text`,
        totalTickets: sql<number>`count(*)::int`,
        totalRevenue: sql<string>`coalesce(sum(${tickets.unitPrice}), 0)::numeric(12,2)::text`,
      })
      .from(tickets)
      .innerJoin(orders, eq(orders.id, tickets.orderId))
      .innerJoin(events, eq(events.id, tickets.eventId))
      .where(eq(tickets.status, "issued"))
      .groupBy(events.isDemo, orders.currency)
      .orderBy(asc(events.isDemo), asc(orders.currency)),
  ]);

  const slotsByEvent = new Map(slotRows.map((s) => [s.eventId, s.count]));
  const soldByEvent = new Map(soldRows.map((s) => [s.eventId, s.count]));

  return {
    demoEnabled,
    canSeeSales: true,
    summary: summaryRows,
    rows: eventRows.map((r) => {
      const sold = soldByEvent.get(r.eventId) ?? 0;
      const onlineSlots = slotsByEvent.get(r.eventId) ?? 0;
      return {
        eventId: r.eventId,
        name: r.name,
        startsAt: r.startsAt.toISOString(),
        isDemo: r.isDemo,
        siteState: saleStateOf({
          planningStage: r.planningStage,
          status: r.status,
          saleStartsAt: r.saleStartsAt ?? null,
          saleEndsAt: r.saleEndsAt ?? null,
          providerActive: ctx.providerActive,
          now: ctx.now,
        }),
        saleMode: r.saleMode ?? "seat",
        sold,
        occupancyPercent: onlineSlots > 0 ? Math.round((100 * sold) / onlineSlots) : null,
        images: imageStatusOf({
          coverImage: r.coverImage,
          heroImage: r.heroImage,
          artistId: r.artistId,
          artistImage: r.artistImage,
        }),
      };
    }),
  };
}
