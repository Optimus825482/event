import { timingSafeEqual } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventSaleSettings, eventTables, events, orders, paymentAttempts, tableSeatSlots, tickets, type OrderStatus } from "@/db/schema";
import { seatNoShown, wholeOnlyOf, type SaleCategory } from "@/domain/seating";
import { normalizeEmail } from "@/features/customers/normalize";
import { publish } from "@/features/realtime/publish";
import { lockEvent } from "@/features/reservations/internal";
import { signQrToken } from "@/features/reservations/qr-token";
import { MAX_ORDER_TABLES, SALES_ERROR_MESSAGES, type SalesErrorCode } from "@/features/sales-api/contract";
import { getSeatPrices } from "@/features/seating/prices";
import { getSaleSettings } from "@/features/seating/settings-service";
import { DomainError, type DomainErrorCode } from "@/lib/action";
import { byLabel } from "@/lib/compare";
import { sha256 } from "@/lib/digest";
import { logError } from "@/lib/log";
import { nameKey } from "@/lib/name-key";
import { pgCodeOf, pgConstraintOf } from "@/lib/pg-error";
import { SALES_ACTOR } from "./internal";
import { lineTotal, sumMoney } from "./money";
import type { PaymentProvider, PaymentRequest } from "./payment/provider";
import { activeProvider } from "./payment/registry";
import { generatePnr, parsePnr } from "./pnr";
import { saleStateOf } from "./sale-state";

export type HoldItem = { tableId: string; quantity: number; seatNos?: number[] };

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
  tickets: { ticketId: string; tableId: string; tableLabel: string; seatNo: number | null; qrPayload: string }[];
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

export const SEAT_TAKEN_MESSAGE = "Seçtiğiniz sandalyelerden biri az önce alındı";

/** Aynı masanın kalemlerini birleştirir; masa kimliğine göre artan sıralar (kilit sırası). */
function mergeItems(items: readonly HoldItem[]): HoldItem[] {
  const merged = new Map<string, { quantity: number; seatNos?: number[] }>();
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new SalesError("invalid");
    const prev = merged.get(item.tableId);
    if (!prev) {
      merged.set(item.tableId, {
        quantity: item.quantity,
        ...(item.seatNos !== undefined ? { seatNos: [...item.seatNos] } : {}),
      });
      continue;
    }
    if ((prev.seatNos !== undefined) !== (item.seatNos !== undefined)) {
      throw new SalesError("invalid");
    }
    prev.quantity += item.quantity;
    if (prev.seatNos && item.seatNos) prev.seatNos.push(...item.seatNos);
  }
  const result: HoldItem[] = [];
  for (const [tableId, { quantity, seatNos }] of merged.entries()) {
    if (seatNos !== undefined) {
      if (seatNos.length !== quantity || new Set(seatNos).size !== seatNos.length) {
        throw new SalesError("invalid");
      }
      result.push({ tableId, quantity, seatNos });
    } else {
      result.push({ tableId, quantity });
    }
  }
  return result.sort((a, b) => (a.tableId < b.tableId ? -1 : a.tableId > b.tableId ? 1 : 0));
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

type TableSlots = { total: number; free: { id: string; seatNo: number }[] };

/**
 * Masa başına yuva sayısı ve etkin bileti olmayan yuvalar (`seat_no` sırasıyla). Masa kilitleri tutulurken
 * çağrılır; kilit öncesi okunan doluluk bayattır.
 */
async function slotsByTable(tx: Tx, tableIds: readonly string[]): Promise<Map<string, TableSlots>> {
  const result = new Map<string, TableSlots>();
  if (tableIds.length === 0) return result;
  const ids = [...tableIds];
  const totals = await tx
    .select({ tableId: tableSeatSlots.tableId, total: sql<number>`count(*)::int` })
    .from(tableSeatSlots)
    .where(inArray(tableSeatSlots.tableId, ids))
    .groupBy(tableSeatSlots.tableId);
  for (const row of totals) result.set(row.tableId, { total: row.total, free: [] });
  const freeRows = await tx
    .select({ id: tableSeatSlots.id, tableId: tableSeatSlots.tableId, seatNo: tableSeatSlots.seatNo })
    .from(tableSeatSlots)
    .where(
      and(
        inArray(tableSeatSlots.tableId, ids),
        sql`not exists (select 1 from ${tickets} where ${tickets.seatSlotId} = ${tableSeatSlots.id} and ${tickets.status} in ('held', 'issued'))`,
      ),
    )
    .orderBy(asc(tableSeatSlots.tableId), asc(tableSeatSlots.seatNo));
  for (const row of freeRows) result.get(row.tableId)?.free.push({ id: row.id, seatNo: row.seatNo });
  return result;
}

type HoldInput = { eventId: string; items: HoldItem[]; clientKey: string };
type HoldLine = { tableId: string; category: SaleCategory; unitPrice: string; slotIds: string[]; bySeatChoice: boolean };

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
  // Tekil indeks çakışmasında hangi masanın biletleri yazılıyordu: `seats_unavailable` ayrıntısı ve mesajı için.
  let inserting: { tableId: string; bySeatChoice: boolean } | null = null;

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

      const orderedSeats = items.reduce((sum, i) => sum + i.quantity, 0);
      if (items.length > MAX_ORDER_TABLES || orderedSeats > settings.maxSeatsPerOrder) {
        throw new SalesError("limit_exceeded", { maxTables: MAX_ORDER_TABLES, maxSeats: settings.maxSeatsPerOrder });
      }

      const tableIds = items.map((i) => i.tableId);
      const tables = await tx
        .select({
          id: eventTables.id,
          allocation: eventTables.allocation,
          saleCategory: eventTables.saleCategory,
          isLoca: eventTables.isLoca,
        })
        .from(eventTables)
        .where(and(eq(eventTables.eventId, eventId), inArray(eventTables.id, tableIds)))
        .orderBy(asc(eventTables.id))
        .for("update");

      // Süresi dolmuş tutmalar yuvayı hâlâ dolu gösterir: masa kilitleri tutulurken, saymadan önce süpür.
      await sweepStaleHolds(tx, { eventId, tableIds });

      // Aynı anahtarla eşzamanlı yineleme masa kilidinde bekledi; kilit sonrası anlık görüntüde öncekinin
      // siparişi görünür. Yer kalmamış olsa da yineleme `seats_unavailable` değil aynı siparişi almalı.
      const duplicate = await orderIdByClientKey(tx, clientKey, eventId);
      if (duplicate) return { orderId: duplicate, created: false };

      const prices = await getSeatPrices(tx, eventId);
      const slotMap = await slotsByTable(tx, tableIds);
      const lines: HoldLine[] = [];
      for (const item of items) {
        const table = tables.find((t) => t.id === item.tableId);
        if (!table || table.allocation !== "online") {
          throw new SalesError("table_not_sellable", { tableId: item.tableId });
        }
        const { total: seats, free: slots } = slotMap.get(table.id) ?? { total: 0, free: [] };
        const wholeOnly = wholeOnlyOf({ saleMode: settings.saleMode, sharedTables: settings.sharedTables, isLoca: table.isLoca });
        if (wholeOnly && item.seatNos) throw new SalesError("invalid");
        if (wholeOnly && item.quantity !== seats) {
          throw new SalesError("whole_table_required", { tableId: table.id, seats });
        }
        let slotIds: string[];
        if (item.seatNos) {
          const byNo = new Map(slots.map((s) => [s.seatNo, s.id]));
          slotIds = item.seatNos.map((no) => {
            const id = byNo.get(no);
            if (!id) throw new SalesError("seats_unavailable", { tableId: table.id, free: slots.length }, SEAT_TAKEN_MESSAGE);
            return id;
          });
        } else {
          if (item.quantity > slots.length) {
            throw new SalesError("seats_unavailable", { tableId: table.id, free: slots.length });
          }
          slotIds = slots.slice(0, item.quantity).map((s) => s.id);
        }
        if (settings.blockSingleLeftover && slots.length - item.quantity === 1) {
          throw new SalesError("leaves_single_seat", { tableId: table.id });
        }
        const unitPrice = prices[table.saleCategory].finalPrice;
        if (unitPrice === null) throw new SalesError("price_missing", { tableId: table.id });
        lines.push({
          tableId: table.id,
          category: table.saleCategory,
          unitPrice,
          slotIds,
          bySeatChoice: item.seatNos !== undefined,
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
        inserting = { tableId: line.tableId, bySeatChoice: line.bySeatChoice };
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
        const failed = inserting as { tableId: string; bySeatChoice: boolean } | null;
        throw new SalesError(
          "seats_unavailable",
          failed ? { tableId: failed.tableId } : undefined,
          failed?.bySeatChoice ? SEAT_TAKEN_MESSAGE : undefined,
        );
      }
    }
    throw error;
  }
  return { order: await viewOrThrow(db, outcome.orderId), created: outcome.created };
}

export async function createHold(db: Db, input: HoldInput, deps: OrderDeps = {}): Promise<OrderView> {
  return (await createHoldWithOutcome(db, input, deps)).order;
}

export type SweepScope = {
  eventId?: string;
  tableIds?: readonly string[];
  /** Tek süpürmede kilitlenip bırakılacak en çok sipariş (en küçük kimliklerden); uzun işlemi önler. */
  limit?: number;
};

/** Süresi dolan tutmaların fırsatçı süpürmesinde tek seferde işlenen en çok sipariş. */
export const OPPORTUNISTIC_SWEEP_LIMIT = 100;

/**
 * Kapsamsız (tüm etkinlikler/masalar) sınırlı süpürme: `orders_pending_expiry_idx` üzerinden süresi dolan
 * `pending` siparişleri `expired` yapar. Zamanlayıcı yoktur; okuma yollarından ucuzca çağrılır.
 */
export function sweepExpiredHolds(ex: Db | Tx, limit: number = OPPORTUNISTIC_SWEEP_LIMIT): Promise<number> {
  return expireStaleHolds(ex, { limit });
}

/**
 * Verilen siparişlerin biletlerini bırakır (`expired`, yuvasız) ve etkilenen her masa için `seats.changed`
 * yayar. Çağıran sipariş satırlarını kilitlemiş ve `expired` yapmış olmalı (kilit sırası: sipariş → bilet).
 */
async function expireTicketsOf(tx: Tx, orderIds: readonly string[]): Promise<void> {
  if (orderIds.length === 0) return;
  const freed = await tx
    .update(tickets)
    .set({ status: "expired", seatSlotId: null })
    .where(and(inArray(tickets.orderId, [...orderIds]), eq(tickets.status, "held")))
    .returning({ eventId: tickets.eventId, tableId: tickets.tableId });
  const touched = new Map<string, string>();
  for (const row of freed) touched.set(row.tableId, row.eventId);
  const ordered = [...touched.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [id, eventId] of ordered) await publish(tx, { type: "seats.changed", eventId, id });
}

/**
 * İşlem içinde süpürme. Kilit sırası: sistem geneli sıranın (etkinlik → masalar → sipariş → bilet) sipariş
 * ve bilet adımları; `createHold` bunu masa kilitlerinden sonra çağırır. Siparişler tek sorguda kimlik
 * artan `FOR UPDATE` ile kilitlenir: farklı kapsamlarla eşzamanlı süpürmeler aynı siparişlere aynı sırayla
 * gelir ve kilitlenmez. Bekleyen kilit (ör. eşzamanlı bırakma) bırakılınca satır yeniden değerlendirilir;
 * artık `pending` değilse atlanır. Başka masadaki biletler o masanın kilidi alınmadan bırakılır: bu yalnızca
 * yuvayı boşaltır, o masada kilit tutan tutma en kötü bayat (dolu) okur ve fazla satış oluşmaz.
 */
async function sweepStaleHolds(tx: Tx, scope: SweepScope = {}): Promise<number> {
  if (scope.tableIds && scope.tableIds.length === 0) return 0;
  const conditions = [sql`o.status = 'pending'`, sql`o.hold_expires_at <= clock_timestamp()`];
  if (scope.eventId !== undefined) conditions.push(sql`o.event_id = ${scope.eventId}`);
  if (scope.tableIds) {
    const ids = sql.join(
      scope.tableIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    conditions.push(sql`exists (select 1 from tickets t where t.order_id = o.id and t.table_id in (${ids}))`);
  }
  const limit = scope.limit !== undefined ? sql`limit ${Math.max(1, Math.trunc(scope.limit))}` : sql``;
  const locked = await tx.execute<{ id: string }>(sql`
    select o.id from orders o
     where ${sql.join(conditions, sql` and `)}
     order by o.id
     ${limit}
       for update of o
  `);
  const lockedIds = locked.rows.map((r) => r.id);
  if (lockedIds.length === 0) return 0;
  // Kilit beklenip satır yeniden değerlendirildiyse koşul zaten doğrulandı; yine de durum koşulu korunur.
  const expired = await tx
    .update(orders)
    .set({ status: "expired" })
    .where(and(inArray(orders.id, lockedIds), eq(orders.status, "pending")))
    .returning({ id: orders.id });
  const expiredIds = expired.map((r) => r.id);
  await expireTicketsOf(tx, expiredIds);
  return expiredIds.length;
}

/**
 * Süresi dolmuş (`pending`, `hold_expires_at <= clock_timestamp()`) ve kapsama giren siparişleri ve tüm
 * biletlerini (başka masadakiler dahil) `expired` yapar; süresi dolan sipariş sayısını döner. `tableIds`
 * verilirse yalnızca o masalardan birinde bileti olan siparişler; kapsam yoksa tüm etkinlikler.
 */
export async function expireStaleHolds(ex: Db | Tx, scope: SweepScope = {}): Promise<number> {
  // `Tx` üzerinde `transaction` bir kayıt noktası açar; dış işlemin kilitleri ve sırası korunur.
  return ex.transaction((tx) => sweepStaleHolds(tx, scope));
}

/**
 * Tutmayı hemen bırakır: sipariş `expired`, biletler `expired` + yuvasız, masa başına `seats.changed`.
 * Zaten `expired` ise hiçbir şey yapmaz (süresi dolmuş ama süpürülmemiş `pending` satır da bırakılır).
 * Kilit sırası sipariş → bilet; etkinlik ve masa kilidi almaz: yalnızca yuva boşaltır, fazla satış doğuramaz.
 */
export async function releaseHold(db: Db, orderId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");
    if (!order) throw new SalesError("order_not_found");
    if (order.status === "paid") throw new SalesError("already_paid");
    if (order.status === "expired") return;
    await tx.update(orders).set({ status: "expired" }).where(eq(orders.id, order.id));
    await expireTicketsOf(tx, [order.id]);
  });
}

export type PayInput = {
  buyer: { firstName: string; lastName: string; email: string; phone?: string };
  acceptTerms: true;
  payment: PaymentRequest;
};

const PNR_ATTEMPTS = 5;

type PayOutcome = { kind: "already_paid" } | { kind: "declined" } | { kind: "paid" };

/**
 * Siparişin ödemesi. Sağlayıcı çağrısı sipariş kilidi altında yapılır: eşzamanlı yinelemeler kilitte
 * bekler, kilidi alınca siparişi `paid` görür ve sağlayıcıyı yeniden çağırmadan aynı görünümü alır.
 *
 * Kilit sırası (sistem geneli): siparişin masaları kilitsiz okunur (bir siparişin masa kümesi değişmez) →
 * etkinlik `FOR SHARE` → masalar tek sorguda kimlik artan `FOR UPDATE` → sipariş `FOR UPDATE` → biletler.
 * Masa kilidi, süresi ödemenin ortasında dolan siparişi aynı masayı tutan `createHold`'un süpürmesine
 * karşı korur: süpürme masa kilidinden sonra çalıştığından ödeme commit edilene dek bekler, sonra `paid`
 * satırı atlar. Durum ve süre kilitler alındıktan sonra DB saatiyle (`clock_timestamp()`) doğrulanır.
 */
export async function payOrder(db: Db, orderId: string, input: PayInput, deps: OrderDeps = {}): Promise<OrderView> {
  const provider = deps.provider !== undefined ? deps.provider : activeProvider();
  const email = normalizeEmail(input.buyer.email);
  const firstName = input.buyer.firstName.trim();
  const lastName = input.buyer.lastName.trim();
  const lastNameKey = nameKey(lastName);
  if (email === null || input.acceptTerms !== true || firstName === "" || lastNameKey === "") {
    throw new SalesError("invalid");
  }
  const phone = input.buyer.phone?.trim() || null;
  const makePnr = deps.generatePnr ?? generatePnr;

  const outcome = await db.transaction(async (tx): Promise<PayOutcome> => {
    const [ref] = await tx.select({ eventId: orders.eventId }).from(orders).where(eq(orders.id, orderId));
    if (!ref) throw new SalesError("order_not_found");
    const tableRows = await tx
      .selectDistinct({ tableId: tickets.tableId })
      .from(tickets)
      .where(eq(tickets.orderId, orderId));
    const tableIds = tableRows.map((r) => r.tableId).sort();

    const event = await lockEvent(tx, SALES_ACTOR, ref.eventId);
    if (tableIds.length > 0) {
      await tx
        .select({ id: eventTables.id })
        .from(eventTables)
        .where(inArray(eventTables.id, tableIds))
        .orderBy(asc(eventTables.id))
        .for("update");
    }
    const [order] = await tx
      .select({
        id: orders.id,
        status: orders.status,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        live: sql<boolean>`${orders.holdExpiresAt} > clock_timestamp()`,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");
    if (!order) throw new SalesError("order_not_found");
    // Ödenmiş siparişin yinelemesi sağlayıcı ve etkinlik durumundan bağımsız aynı görünümü alır.
    if (order.status === "paid") return { kind: "already_paid" };
    if (provider === null || provider.id !== input.payment.provider) throw new SalesError("payments_disabled");
    // Satış aşaması `sales_closed` olsa da canlı tutma ödenebilir (T13); ama etkinlik yayından kalktıysa
    // (taslak, iptal, tamamlandı) ödeme alınmaz.
    if (event.status !== "published" && event.status !== "active") throw new SalesError("sales_closed");
    if (order.status === "expired" || !order.live) throw new SalesError("hold_expired");

    const result = await provider.start({
      orderId,
      amount: order.totalAmount,
      currency: order.currency,
      request: input.payment,
    });
    await tx.insert(paymentAttempts).values({
      orderId,
      provider: provider.id,
      outcome: result.outcome,
      amount: order.totalAmount,
      currency: order.currency,
      providerRef: result.providerRef,
      isDemo: provider.isDemo,
    });
    if (result.outcome !== "approved") return { kind: "declined" };

    for (let attempt = 1; ; attempt += 1) {
      const pnr = makePnr();
      try {
        // Kayıt noktası: PNR çakışması dış işlemi bozmaz, yeni kodla yeniden denenir.
        await tx.transaction(async (sp) => {
          await sp
            .update(orders)
            .set({
              status: "paid",
              pnr,
              paidAt: sql`clock_timestamp()`,
              buyerFirstName: firstName,
              buyerLastName: lastName,
              buyerLastNameKey: lastNameKey,
              buyerEmail: email,
              buyerPhone: phone,
              termsAcceptedAt: sql`clock_timestamp()`,
              paymentProvider: provider.id,
              isDemo: provider.isDemo,
            })
            .where(eq(orders.id, orderId));
        });
        break;
      } catch (error) {
        const pnrClash = pgCodeOf(error) === "23505" && pgConstraintOf(error) === "orders_pnr_uq";
        if (!pnrClash) throw error;
        if (attempt >= PNR_ATTEMPTS) throw new Error(`PNR ${PNR_ATTEMPTS} denemede üretilemedi`);
      }
    }

    const held = await tx
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.orderId, orderId), eq(tickets.status, "held")))
      .orderBy(asc(tickets.id))
      .for("update");
    for (const ticket of held) {
      await tx
        .update(tickets)
        .set({ status: "issued", qrToken: signQrToken(ticket.id) })
        .where(eq(tickets.id, ticket.id));
    }
    await publish(tx, { type: "order.paid", eventId: ref.eventId, id: orderId });
    for (const tableId of tableIds) await publish(tx, { type: "seats.changed", eventId: ref.eventId, id: tableId });
    return { kind: "paid" };
  });

  if (outcome.kind === "declined") throw new SalesError("payment_declined");
  if (outcome.kind === "paid" && deps.onPaid) {
    try {
      deps.onPaid(orderId);
    } catch (error) {
      logError("ticketing.onPaid", error);
    }
  }
  return viewOrThrow(db, orderId);
}

// PNR bulunamadığında da aynı karşılaştırma yapılır: yanıt süresi PNR'ın varlığını sızdırmaz.
const DUMMY_KEY_DIGEST = sha256("\u0000pnr-not-found");

/** PNR + soyadıyla ödenmiş siparişi bulur; biçim ve harf duyarsız. Eşleşme yoksa `null`. */
export async function findOrderByPnr(
  ex: Db | Tx,
  input: { pnr: string; lastName: string },
): Promise<{ orderId: string; eventId: string } | null> {
  const pnr = parsePnr(input.pnr);
  if (pnr === null) return null;
  const [row] = await ex
    .select({ id: orders.id, eventId: orders.eventId, key: orders.buyerLastNameKey })
    .from(orders)
    .where(and(eq(orders.pnr, pnr), eq(orders.status, "paid")));
  const wanted = nameKey(input.lastName);
  const stored = row?.key ? sha256(row.key) : DUMMY_KEY_DIGEST;
  const same = timingSafeEqual(sha256(wanted), stored);
  if (!row || !row.key || wanted === "" || !same) return null;
  return { orderId: row.id, eventId: row.eventId };
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
      saleMode: eventSaleSettings.saleMode,
    })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .leftJoin(eventSaleSettings, eq(eventSaleSettings.eventId, orders.eventId))
    .where(eq(orders.id, orderId));
  if (!row) return null;

  const ticketRows = await ex
    .select({
      id: tickets.id,
      tableId: tickets.tableId,
      tableLabel: eventTables.label,
      isLoca: eventTables.isLoca,
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

  const saleMode = row.saleMode ?? "seat";
  const issued =
    row.rawStatus === "paid"
      ? ticketRows
          .filter((t): t is typeof t & { qrToken: string } => t.status === "issued" && t.qrToken !== null)
          .sort((a, b) => byLabel(a.tableLabel, b.tableLabel) || (a.seatNo ?? 0) - (b.seatNo ?? 0))
          .map((t) => ({
            ticketId: t.id,
            tableId: t.tableId,
            tableLabel: t.tableLabel,
            seatNo: seatNoShown({ saleMode, isLoca: t.isLoca }) ? t.seatNo : null,
            qrPayload: t.qrToken,
          }))
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
