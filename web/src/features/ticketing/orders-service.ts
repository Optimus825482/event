import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventTables, events, orders, tableSeatSlots, tickets, type OrderStatus } from "@/db/schema";
import type { SaleCategory } from "@/domain/seating";
import { publish } from "@/features/realtime/publish";
import { lockEvent } from "@/features/reservations/internal";
import { SALES_ERROR_MESSAGES, type SalesErrorCode } from "@/features/sales-api/contract";
import { getSeatPrices } from "@/features/seating/prices";
import { getSaleSettings } from "@/features/seating/settings-service";
import { DomainError, type DomainErrorCode } from "@/lib/action";
import { pgCodeOf, pgConstraintOf } from "@/lib/pg-error";
import { SALES_ACTOR } from "./internal";
import { lineTotal, sumMoney } from "./money";
import type { PaymentProvider } from "./payment/provider";
import { activeProvider } from "./payment/registry";
import { saleStateOf } from "./sale-state";

export type HoldItem = { tableId: string; quantity: number };

export type OrderView = {
  orderId: string;
  eventId: string;
  eventName: string;
  startsAt: string;
  status: "pending" | "paid" | "expired";
  holdExpiresAt: string;
  currency: string;
  total: string;
  isDemo: boolean;
  pnr: string | null;
  items: { tableId: string; tableLabel: string; category: SaleCategory; quantity: number; unitPrice: string }[];
  tickets: { ticketId: string; tableId: string; tableLabel: string; qrPayload: string }[];
};

export type OrderDeps = {
  provider?: PaymentProvider | null;
  generatePnr?: () => string;
  onPaid?: (orderId: string) => void;
};

function domainCodeOf(code: SalesErrorCode): DomainErrorCode {
  if (code === "event_not_found" || code === "order_not_found") return "not_found";
  if (code === "invalid") return "invalid";
  return "conflict";
}

/** Satış yüzeyinin hatası: `salesCode` sözleşmedeki koddur, `details` yanıta aynen geçer. */
export class SalesError extends DomainError {
  readonly salesCode: SalesErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(salesCode: SalesErrorCode, details?: Record<string, unknown>, message?: string) {
    super(domainCodeOf(salesCode), message ?? SALES_ERROR_MESSAGES[salesCode]);
    this.name = "SalesError";
    this.salesCode = salesCode;
    if (details !== undefined) this.details = details;
  }
}

const byLabel = (a: string, b: string) => a.localeCompare(b, "tr", { numeric: true });

/** Aynı masanın kalemlerini birleştirir; masa kimliğine göre artan sıralar (kilit sırası). */
function mergeItems(items: readonly HoldItem[]): HoldItem[] {
  const merged = new Map<string, number>();
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new SalesError("invalid");
    merged.set(item.tableId, (merged.get(item.tableId) ?? 0) + item.quantity);
  }
  return [...merged.entries()]
    .map(([tableId, quantity]) => ({ tableId, quantity }))
    .sort((a, b) => (a.tableId < b.tableId ? -1 : a.tableId > b.tableId ? 1 : 0));
}

/** Anahtarla bulunan sipariş başka bir etkinliğe aitse `invalid`: başka etkinliğin siparişi sızmaz. */
async function orderIdByClientKey(ex: Db | Tx, clientKey: string, eventId: string): Promise<string | null> {
  const [row] = await ex
    .select({ id: orders.id, eventId: orders.eventId })
    .from(orders)
    .where(eq(orders.clientKey, clientKey));
  if (!row) return null;
  if (row.eventId !== eventId) throw new SalesError("invalid");
  return row.id;
}

async function viewOrThrow(ex: Db | Tx, orderId: string): Promise<OrderView> {
  const view = await getOrderView(ex, orderId);
  if (!view) throw new Error(`Sipariş okunamadı: ${orderId}`);
  return view;
}

/** Masa başına, etkin bileti olmayan yuvalar `seat_no` sırasıyla. Masa kilitleri tutulurken çağrılır. */
async function freeSlotsByTable(tx: Tx, tableIds: readonly string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (tableIds.length === 0) return result;
  const rows = await tx
    .select({ id: tableSeatSlots.id, tableId: tableSeatSlots.tableId })
    .from(tableSeatSlots)
    .where(
      and(
        inArray(tableSeatSlots.tableId, [...tableIds]),
        sql`not exists (select 1 from ${tickets} where ${tickets.seatSlotId} = ${tableSeatSlots.id} and ${tickets.status} in ('held', 'issued'))`,
      ),
    )
    .orderBy(asc(tableSeatSlots.tableId), asc(tableSeatSlots.seatNo));
  for (const row of rows) {
    const list = result.get(row.tableId);
    if (list) list.push(row.id);
    else result.set(row.tableId, [row.id]);
  }
  return result;
}

type HoldInput = { eventId: string; items: HoldItem[]; clientKey: string };
type HoldLine = { tableId: string; category: SaleCategory; unitPrice: string; slotIds: string[] };

/**
 * Süreli tutma. Kilit sırası (sistem geneli): etkinlik `FOR SHARE` → istenen masalar tek sorguda kimlik
 * artan sırayla `FOR UPDATE`. Aynı masayı isteyenler masa kilidinde sıraya girer; READ COMMITTED altında
 * kilidi alan işlemin sonraki sorguları öncekilerin commit ettiği biletleri görür. Son savunma kısmi tekil
 * indeks `tickets_active_seat_uq`'dur: kilit atlansa da aynı yuvaya iki etkin bilet yazılamaz.
 */
export async function createHoldWithOutcome(
  db: Db,
  input: HoldInput,
  deps: OrderDeps = {},
): Promise<{ order: OrderView; created: boolean }> {
  const existing = await orderIdByClientKey(db, input.clientKey, input.eventId);
  if (existing) return { order: await viewOrThrow(db, existing), created: false };

  const items = mergeItems(input.items);
  if (items.length === 0) throw new SalesError("invalid");
  const provider = deps.provider !== undefined ? deps.provider : activeProvider();
  const { eventId, clientKey } = input;
  // Tekil indeks çakışmasında hangi masanın biletleri yazılıyordu: `seats_unavailable` ayrıntısı için.
  let inserting: string | null = null;

  let outcome: { orderId: string; created: boolean };
  try {
    outcome = await db.transaction(async (tx) => {
      let event;
      try {
        event = await lockEvent(tx, SALES_ACTOR, eventId);
      } catch (error) {
        if (error instanceof DomainError && error.code === "not_found") throw new SalesError("event_not_found");
        throw error;
      }
      // Satış durumu denetiminden önce: aynı anahtarın yinelemesi, arada satış kapansa da aynı yanıtı almalı.
      const early = await orderIdByClientKey(tx, clientKey, eventId);
      if (early) return { orderId: early, created: false };

      const settings = await getSaleSettings(tx, eventId);
      const state = saleStateOf({
        planningStage: event.planningStage,
        status: event.status,
        saleStartsAt: settings.saleStartsAt,
        saleEndsAt: settings.saleEndsAt,
        providerActive: provider !== null,
        now: new Date(),
      });
      if (state === null) throw new SalesError("event_not_found");
      if (state !== "open") throw new SalesError("sales_closed");

      const tableIds = items.map((i) => i.tableId);
      const tables = await tx
        .select({
          id: eventTables.id,
          allocation: eventTables.allocation,
          saleCategory: eventTables.saleCategory,
        })
        .from(eventTables)
        .where(and(eq(eventTables.eventId, eventId), inArray(eventTables.id, tableIds)))
        .orderBy(asc(eventTables.id))
        .for("update");

      // Aynı anahtarla eşzamanlı yineleme masa kilidinde bekledi; kilit sonrası anlık görüntüde öncekinin
      // siparişi görünür. Yer kalmamış olsa da yineleme `seats_unavailable` değil aynı siparişi almalı.
      const duplicate = await orderIdByClientKey(tx, clientKey, eventId);
      if (duplicate) return { orderId: duplicate, created: false };

      const prices = await getSeatPrices(tx, eventId);
      const free = await freeSlotsByTable(tx, tableIds);
      const lines: HoldLine[] = [];
      for (const item of items) {
        const table = tables.find((t) => t.id === item.tableId);
        if (!table || table.allocation !== "online") {
          throw new SalesError("table_not_sellable", { tableId: item.tableId });
        }
        const slots = free.get(table.id) ?? [];
        if (slots.length < item.quantity) {
          throw new SalesError("seats_unavailable", { tableId: table.id, free: slots.length });
        }
        const unitPrice = prices[table.saleCategory].finalPrice;
        if (unitPrice === null) throw new SalesError("price_missing", { tableId: table.id });
        lines.push({
          tableId: table.id,
          category: table.saleCategory,
          unitPrice,
          slotIds: slots.slice(0, item.quantity),
        });
      }

      const total = sumMoney(lines.map((l) => lineTotal(l.unitPrice, l.slotIds.length)));
      const [order] = await tx
        .insert(orders)
        .values({
          eventId,
          clientKey,
          status: "pending",
          holdExpiresAt: sql`clock_timestamp() + make_interval(mins => ${settings.holdMinutes}::int)`,
          totalAmount: total,
          currency: settings.currency,
        })
        .returning({ id: orders.id });
      if (!order) throw new Error("Sipariş yazılamadı");

      for (const line of lines) {
        inserting = line.tableId;
        await tx.insert(tickets).values(
          line.slotIds.map((seatSlotId) => ({
            orderId: order.id,
            // Bilet her zaman siparişin etkinliğiyle yazılır; tutarlılığı veritabanı zorlamaz.
            eventId,
            tableId: line.tableId,
            seatSlotId,
            status: "held" as const,
            saleCategory: line.category,
            unitPrice: line.unitPrice,
          })),
        );
      }
      inserting = null;
      for (const line of lines) await publish(tx, { type: "seats.changed", eventId, id: line.tableId });
      return { orderId: order.id, created: true };
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (pgCodeOf(error) === "23505") {
      const constraint = pgConstraintOf(error);
      if (constraint === "orders_client_key_uq") {
        const winner = await orderIdByClientKey(db, clientKey, eventId);
        if (winner) return { order: await viewOrThrow(db, winner), created: false };
      }
      if (constraint === "tickets_active_seat_uq") {
        throw new SalesError("seats_unavailable", inserting ? { tableId: inserting } : undefined);
      }
    }
    throw error;
  }
  return { order: await viewOrThrow(db, outcome.orderId), created: outcome.created };
}

export async function createHold(db: Db, input: HoldInput, deps: OrderDeps = {}): Promise<OrderView> {
  return (await createHoldWithOutcome(db, input, deps)).order;
}

/**
 * Siparişin satış yüzeyi görünümü. `status` zaman duyarlıdır: süresi dolmuş ama süpürülmemiş `pending`
 * satır `expired` okunur (DB saatiyle). Kalemler biletlerden masa başına toplanır; biletler yalnızca
 * `paid` siparişte ve QR'ı olan (`issued`) satırlar için döner.
 */
export async function getOrderView(ex: Db | Tx, orderId: string): Promise<OrderView | null> {
  const [row] = await ex
    .select({
      id: orders.id,
      eventId: orders.eventId,
      eventName: events.name,
      startsAt: events.startsAt,
      rawStatus: orders.status,
      status: sql<OrderStatus>`case when ${orders.status} = 'pending' and ${orders.holdExpiresAt} <= clock_timestamp() then 'expired' else ${orders.status} end`,
      holdExpiresAt: orders.holdExpiresAt,
      currency: orders.currency,
      total: orders.totalAmount,
      isDemo: orders.isDemo,
      pnr: orders.pnr,
    })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .where(eq(orders.id, orderId));
  if (!row) return null;

  const ticketRows = await ex
    .select({
      id: tickets.id,
      tableId: tickets.tableId,
      tableLabel: eventTables.label,
      category: tickets.saleCategory,
      unitPrice: tickets.unitPrice,
      status: tickets.status,
      qrToken: tickets.qrToken,
      seatNo: tableSeatSlots.seatNo,
    })
    .from(tickets)
    .innerJoin(eventTables, eq(eventTables.id, tickets.tableId))
    .leftJoin(tableSeatSlots, eq(tableSeatSlots.id, tickets.seatSlotId))
    .where(eq(tickets.orderId, orderId))
    .orderBy(asc(tickets.createdAt), asc(tickets.id));

  const items = new Map<string, OrderView["items"][number]>();
  for (const t of ticketRows) {
    const item = items.get(t.tableId);
    if (item) item.quantity += 1;
    else {
      items.set(t.tableId, {
        tableId: t.tableId,
        tableLabel: t.tableLabel,
        category: t.category,
        quantity: 1,
        unitPrice: t.unitPrice,
      });
    }
  }

  const issued =
    row.rawStatus === "paid"
      ? ticketRows
          .filter((t): t is typeof t & { qrToken: string } => t.status === "issued" && t.qrToken !== null)
          .sort((a, b) => byLabel(a.tableLabel, b.tableLabel) || (a.seatNo ?? 0) - (b.seatNo ?? 0))
          .map((t) => ({ ticketId: t.id, tableId: t.tableId, tableLabel: t.tableLabel, qrPayload: t.qrToken }))
      : [];

  return {
    orderId: row.id,
    eventId: row.eventId,
    eventName: row.eventName,
    startsAt: row.startsAt.toISOString(),
    status: row.status,
    holdExpiresAt: row.holdExpiresAt.toISOString(),
    currency: row.currency,
    total: row.total,
    isDemo: row.isDemo,
    pnr: row.pnr,
    items: [...items.values()].sort((a, b) => byLabel(a.tableLabel, b.tableLabel)),
    tickets: issued,
  };
}
