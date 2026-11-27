import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { z } from "zod";
import {
  DEMO_NOTICE,
  IMAGE_PATH_PATTERN,
  MAX_ORDER_TABLES,
  SALES_CATEGORIES,
  SALES_ERROR_MESSAGES,
  SALES_ERROR_STATUS,
  createOrderBodySchema,
  lookupBodySchema,
  payOrderBodySchema,
  type Availability,
  type EventCard,
  type EventDetail,
  type OrderResponse,
  type PlanTablePublic,
  type SaleMode,
  type SaleState,
  type SalesErrorCode,
} from "@/lib/core/contract";

/** Sahte çekirdek: sözleşmenin (§4.4) bellek içi kopyası; fazlası yoktur. */
export type SaleCategory = (typeof SALES_CATEGORIES)[number];
export type FakeTable = PlanTablePublic;

export const FAKE_IMAGES = {
  cover: "event/00000000-0000-4000-8000-0000000000c1.webp",
  hero: "event/00000000-0000-4000-8000-0000000000c2.webp",
  artist: "artist/00000000-0000-4000-8000-0000000000a1.webp",
} as const;

const FAKE_WEBP_BYTES = Uint8Array.from(
  Buffer.from("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=", "base64"),
);

export type FakeEventSeed = {
  id?: string;
  name?: string;
  startsAt?: string;
  saleState?: SaleState;
  saleMode?: SaleMode;
  demo?: boolean;
  isDemo?: boolean;
  coverImage?: string | null;
  artistImage?: string | null;
  artistName?: string | null;
  site?: Partial<EventDetail["site"]>;
  holdMinutes?: number;
  maxSeatsPerOrder?: number;
  blockSingleLeftover?: boolean;
  currency?: string;
  prices?: Partial<Record<SaleCategory, string>>;
  tables?: FakeTable[];
  decor?: unknown[];
  lines?: unknown[];
};

export type FakeRequest = {
  method: string;
  path: string;
  authorization: string | null;
  clientIp: string | null;
};

export type FakeCore = {
  readonly secret: string;
  readonly requests: FakeRequest[];
  addEvent(seed?: FakeEventSeed): EventDetail;
  free(eventId: string, tableId: string): number;
  freeSeats(eventId: string, tableId: string): number[];
  holdAs(eventId: string, tableId: string, quantity: number, seatNos?: number[]): OrderResponse;
  /** Bekleyen siparişin tutma süresini bitirir; remainingMs verilirse o kadar süre bırakır. */
  expireOrder(orderToken: string, remainingMs?: number): void;
  advance(ms: number): void;
  failNext(pathPattern: RegExp, status: number): void;
  resetOrders(): void;
  handle(request: Request): Promise<Response>;
  listen(port: number): Promise<{ url: string; close(): Promise<void> }>;
};

const API_PREFIX = "/api/sales/v1";
const PNR_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CATEGORY_LABELS: Record<SaleCategory, string> = { standard: "Standart", premium: "Premium", vip: "VIP" };
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);

const tableId = (index: number) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;

/** Varsayılan yerleşim: 1200×800 tuvalde çakışmasız 15 masa (13 satılabilir). */
export function defaultTables(): FakeTable[] {
  const tables: FakeTable[] = [];
  let index = 1;
  const add = (partial: Partial<FakeTable> & Pick<FakeTable, "label" | "x" | "y">) => {
    const seats = partial.seats === undefined ? 8 : partial.seats;
    const seatNos = partial.seatNos ?? (seats === null ? [] : Array.from({ length: seats }, (_, i) => i + 1));
    tables.push({
      id: tableId(index++),
      rotation: 0,
      shape: "round",
      isLoca: false,
      sellable: true,
      category: "standard",
      capacity: partial.capacity ?? seats ?? 8,
      seats,
      seatNos,
      wholeOnly: false,
      ...partial,
    });
  };
  for (let i = 0; i < 6; i++) add({ label: `A${i + 1}`, x: 150 + i * 180, y: 150 });
  for (let i = 0; i < 3; i++) add({ label: `P${i + 1}`, x: 150 + i * 180, y: 330, category: "premium" });
  for (let i = 0; i < 2; i++) add({ label: `V${i + 1}`, x: 150 + i * 180, y: 510, category: "vip", seats: 6 });
  add({ label: "L1", x: 900, y: 330, shape: "rectangle", isLoca: true, category: "vip", seats: 6, wholeOnly: true });
  add({ label: "G1", x: 1050, y: 510, category: "standard", capacity: 8, seats: 6, seatNos: [1, 2, 3, 5, 6, 8] });
  for (let i = 0; i < 2; i++) {
    add({
      label: `C${i + 1}`,
      x: 150 + i * 180,
      y: 690,
      shape: "square",
      sellable: false,
      category: null,
      capacity: 8,
      seats: null,
      seatNos: [],
    });
  }
  return tables;
}

const priceToCents = (price: string): bigint => {
  const [whole = "0", fraction = ""] = price.split(".");
  return BigInt(whole) * HUNDRED + BigInt(fraction.padEnd(2, "0").slice(0, 2));
};
const centsToPrice = (cents: bigint): string => `${cents / HUNDRED}.${(cents % HUNDRED).toString().padStart(2, "0")}`;

type OrderLine = {
  tableId: string;
  tableLabel: string;
  category: SaleCategory;
  quantity: number;
  unitPrice: string;
  seatNos: number[];
};
type Order = {
  id: string;
  token: string;
  eventId: string;
  clientKey: string;
  lines: OrderLine[];
  status: "pending" | "paid" | "expired";
  holdExpiresMs: number;
  pnr: string | null;
  tickets: OrderResponse["tickets"];
  lastNameKey: string | null;
};
type EventState = { detail: EventDetail; freeSeats: Map<string, number[]>; prices: Map<SaleCategory, string> };
type Result = { status: number; body: unknown };

const trUpper = (value: string) => value.trim().toLocaleUpperCase("tr-TR");
/** Çekirdeğin `normalizeCode` kuralı: boşluk ve tire atılır, alfabe dışı karakter varsa eşleşmez. */
const normalizePnr = (value: string) => {
  const code = value.replace(/[\s-]/g, "").toUpperCase();
  return [...code].every((ch) => PNR_ALPHABET.includes(ch)) ? code : "";
};

function errorResult(code: SalesErrorCode, details?: Record<string, unknown>): Result {
  return {
    status: SALES_ERROR_STATUS[code],
    body: { error: { code, message: SALES_ERROR_MESSAGES[code], ...(details ? { details } : {}) } },
  };
}

const json = (result: Result): Response =>
  result.status === 204
    ? new Response(null, { status: 204 })
    : new Response(JSON.stringify(result.body), { status: result.status, headers: { "content-type": "application/json" } });

export function createFakeCore(options: { secret?: string; now?: () => number } = {}): FakeCore {
  const secret = options.secret ?? randomBytes(24).toString("hex");
  const baseNow = options.now ?? Date.now;
  let offsetMs = 0;
  const now = () => baseNow() + offsetMs;

  const events = new Map<string, EventState>();
  const orders = new Map<string, Order>();
  const clientKeys = new Map<string, string>();
  const requests: FakeRequest[] = [];
  const failures: { pattern: RegExp; status: number }[] = [];

  function release(order: Order) {
    const state = events.get(order.eventId);
    if (!state) return;
    for (const line of order.lines) {
      const current = state.freeSeats.get(line.tableId) ?? [];
      const restored = Array.from(new Set([...current, ...line.seatNos])).sort((a, b) => a - b);
      state.freeSeats.set(line.tableId, restored);
    }
  }

  function refresh() {
    for (const order of orders.values()) {
      if (order.status === "pending" && order.holdExpiresMs <= now()) {
        order.status = "expired";
        release(order);
      }
    }
  }

  function toResponse(order: Order): OrderResponse {
    const state = events.get(order.eventId);
    const total = order.lines.reduce((sum, l) => sum + priceToCents(l.unitPrice) * BigInt(l.quantity), ZERO);
    return {
      orderId: order.id,
      eventId: order.eventId,
      eventName: state?.detail.name ?? "",
      startsAt: state?.detail.startsAt ?? "",
      status: order.status,
      holdExpiresAt: new Date(order.holdExpiresMs).toISOString(),
      currency: state?.detail.currency ?? "TRY",
      total: centsToPrice(total),
      isDemo: order.status === "paid" && (state?.detail.sale.demo ?? true),
      pnr: order.pnr,
      items: order.lines.map((l) => ({
        tableId: l.tableId,
        tableLabel: l.tableLabel,
        category: l.category,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      tickets: order.tickets.map((t) => ({ ...t })),
      orderToken: order.token,
      demoNotice: order.status === "paid" && (state?.detail.sale.demo ?? true) ? DEMO_NOTICE : null,
    };
  }

  function addEvent(seed: FakeEventSeed = {}): EventDetail {
    const saleMode = seed.saleMode ?? "seat";
    const tables = (seed.tables ?? defaultTables()).map((t) => ({
      ...t,
      seatNos: [...t.seatNos],
      wholeOnly: saleMode === "table" && t.sellable ? true : t.wholeOnly,
    }));
    const priceMap: Record<SaleCategory, string | undefined> = {
      standard: "1500.00",
      premium: "2500.00",
      vip: "4000.00",
      ...seed.prices,
    };
    const prices = SALES_CATEGORIES.flatMap((category) => {
      const price = priceMap[category];
      return price === undefined ? [] : [{ category, label: CATEGORY_LABELS[category], price }];
    });
    const minPrice = prices.reduce<bigint | null>((min, p) => {
      const cents = priceToCents(p.price);
      return min === null || cents < min ? cents : min;
    }, null);
    const saleState = seed.saleState ?? "open";
    const detail: EventDetail = {
      id: seed.id ?? randomUUID(),
      name: seed.name ?? "Sahte Gala Gecesi",
      startsAt: seed.startsAt ?? "2027-01-15T18:00:00.000Z",
      endsAt: null,
      artistName: seed.artistName ?? null,
      eventType: null,
      currency: seed.currency ?? "TRY",
      minPrice: minPrice === null ? null : centsToPrice(minPrice),
      saleState,
      coverImage: seed.coverImage ?? null,
      artistImage: seed.artistImage ?? null,
      isDemo: seed.isDemo ?? false,
      description: null,
      site: {
        heroImage: seed.site?.heroImage ?? null,
        summary: seed.site?.summary ?? null,
        doorsOpenAt: seed.site?.doorsOpenAt ?? null,
        ageLimit: seed.site?.ageLimit ?? null,
        dressCode: seed.site?.dressCode ?? null,
        sightlineSet: seed.site?.sightlineSet ?? null,
      },
      sale: {
        state: saleState,
        mode: saleMode,
        opensAt: null,
        closesAt: null,
        holdMinutes: seed.holdMinutes ?? 10,
        maxSeatsPerOrder: seed.maxSeatsPerOrder ?? 12,
        blockSingleLeftover: seed.blockSingleLeftover ?? true,
        demo: seed.demo ?? true,
      },
      prices,
      plan: { canvas: { width: 1200, height: 800 }, tables, decor: seed.decor ?? [], lines: seed.lines ?? [] },
    };
    const freeSeats = new Map<string, number[]>();
    for (const t of tables) {
      if (t.sellable) freeSeats.set(t.id, [...t.seatNos].sort((a, b) => a - b));
    }
    events.set(detail.id, { detail, freeSeats, prices: new Map(prices.map((p) => [p.category, p.price])) });
    return detail;
  }

  function createHold(body: unknown): Result {
    const parsed = createOrderBodySchema.safeParse(body);
    if (!parsed.success) return errorResult("invalid", { fieldErrors: z.flattenError(parsed.error).fieldErrors });
    const { eventId, items, clientKey } = parsed.data;
    const state = events.get(eventId);
    if (!state) return errorResult("event_not_found");
    const { sale } = state.detail;
    const existingToken = clientKeys.get(clientKey);
    const existing = existingToken ? orders.get(existingToken) : undefined;
    if (existing) {
      // Yineleme, satış arada kapansa bile aynı siparişi alır; başka etkinliğin siparişi sızmaz.
      return existing.eventId === eventId ? { status: 200, body: toResponse(existing) } : errorResult("invalid");
    }
    if (sale.state !== "open") return errorResult("sales_closed");

    // Yinelenen masa kalemleri birleştirilir.
    const merged = new Map<string, { quantity: number; seatNos?: number[] }>();
    for (const item of items) {
      const prev = merged.get(item.tableId);
      if (!prev) {
        merged.set(item.tableId, { quantity: item.quantity, ...(item.seatNos ? { seatNos: [...item.seatNos] } : {}) });
      } else {
        if ((prev.seatNos === undefined) !== (item.seatNos === undefined)) return errorResult("invalid");
        const combinedSeats = prev.seatNos && item.seatNos ? [...prev.seatNos, ...item.seatNos] : undefined;
        if (combinedSeats && new Set(combinedSeats).size !== combinedSeats.length) return errorResult("invalid");
        merged.set(item.tableId, {
          quantity: prev.quantity + item.quantity,
          ...(combinedSeats ? { seatNos: combinedSeats } : {}),
        });
      }
    }
    const lineItems = [...merged].map(([id, v]) => ({ tableId: id, quantity: v.quantity, seatNos: v.seatNos }));

    const total = lineItems.reduce((sum, i) => sum + i.quantity, 0);
    if (lineItems.length > MAX_ORDER_TABLES || total > sale.maxSeatsPerOrder) return errorResult("limit_exceeded");

    const working = new Map<string, number[]>();
    for (const [k, v] of state.freeSeats) working.set(k, [...v]);
    const lines: OrderLine[] = [];
    for (const item of lineItems) {
      const table = state.detail.plan.tables.find((t) => t.id === item.tableId);
      if (!table || !table.sellable || table.category === null || table.seats === null) {
        return errorResult("table_not_sellable");
      }
      const freeList = working.get(table.id) ?? [];
      if (item.seatNos !== undefined) {
        if (sale.mode === "table" || table.isLoca) return errorResult("invalid");
        const freeSet = new Set(freeList);
        if (item.seatNos.some((s) => !freeSet.has(s))) {
          return {
            status: SALES_ERROR_STATUS.seats_unavailable,
            body: {
              error: {
                code: "seats_unavailable",
                message: "Seçtiğiniz sandalyelerden biri az önce alındı",
                details: { tableId: table.id, free: freeList.length },
              },
            },
          };
        }
      }
      if (table.wholeOnly && (freeList.length < table.seats || item.quantity !== table.seats)) {
        return errorResult("whole_table_required", { tableId: table.id, seats: table.seats });
      }
      if (item.quantity > freeList.length) return errorResult("seats_unavailable", { tableId: table.id, free: freeList.length });
      if (sale.blockSingleLeftover && freeList.length - item.quantity === 1) {
        return errorResult("leaves_single_seat", { tableId: table.id });
      }
      const unitPrice = state.prices.get(table.category);
      if (unitPrice === undefined) return errorResult("price_missing", { tableId: table.id });

      let taken: number[];
      if (item.seatNos !== undefined) {
        const takenSet = new Set(item.seatNos);
        taken = [...item.seatNos];
        working.set(
          table.id,
          freeList.filter((s) => !takenSet.has(s)),
        );
      } else {
        taken = freeList.slice(0, item.quantity);
        working.set(table.id, freeList.slice(item.quantity));
      }
      lines.push({
        tableId: table.id,
        tableLabel: table.label,
        category: table.category,
        quantity: item.quantity,
        unitPrice,
        seatNos: taken,
      });
    }
    state.freeSeats = working;
    const id = randomUUID();
    const order: Order = {
      id,
      // Çekirdekteki biçim: base64url(uuid) + "." + base64url(32 baytlık imza).
      token: `${Buffer.from(id, "utf8").toString("base64url")}.${randomBytes(32).toString("base64url")}`,
      eventId,
      clientKey,
      lines,
      status: "pending",
      holdExpiresMs: now() + sale.holdMinutes * 60_000,
      pnr: null,
      tickets: [],
      lastNameKey: null,
    };
    orders.set(order.token, order);
    clientKeys.set(clientKey, order.token);
    return { status: 201, body: toResponse(order) };
  }

  function newPnr(): string {
    for (;;) {
      const pnr = Array.from(randomBytes(8), (b) => PNR_ALPHABET[b % PNR_ALPHABET.length]).join("");
      if (![...orders.values()].some((o) => o.pnr === pnr)) return pnr;
    }
  }

  function pay(order: Order, body: unknown): Result {
    const parsed = payOrderBodySchema.safeParse(body);
    if (!parsed.success) return errorResult("invalid", { fieldErrors: z.flattenError(parsed.error).fieldErrors });
    if (order.status === "paid") return { status: 200, body: toResponse(order) };
    if (order.status === "expired") return errorResult("hold_expired");
    if (parsed.data.payment.action === "decline") return errorResult("payment_declined");
    order.status = "paid";
    order.pnr = newPnr();
    order.lastNameKey = trUpper(parsed.data.buyer.lastName);
    const state = events.get(order.eventId);
    order.tickets = order.lines.flatMap((line) => {
      const table = state?.detail.plan.tables.find((t) => t.id === line.tableId);
      const showSeatNo = state?.detail.sale.mode === "seat" && !table?.isLoca;
      return line.seatNos.map((seatNo) => ({
        ticketId: randomUUID(),
        tableId: line.tableId,
        tableLabel: line.tableLabel,
        seatNo: showSeatNo ? seatNo : null,
        qrPayload: randomBytes(16).toString("base64url"),
      }));
    });
    return { status: 200, body: toResponse(order) };
  }

  function hasSeededImage(path: string): boolean {
    for (const { detail } of events.values()) {
      if (detail.coverImage === path || detail.artistImage === path || detail.site.heroImage === path) {
        return true;
      }
    }
    return false;
  }

  function route(method: string, segments: string[], body: unknown): Result {
    refresh();
    const [head, id, tail] = segments;
    if (head === "events" && method === "GET") {
      if (id === undefined) {
        const list: EventCard[] = [...events.values()].map(({ detail }) => ({
          id: detail.id,
          name: detail.name,
          startsAt: detail.startsAt,
          endsAt: detail.endsAt,
          artistName: detail.artistName,
          eventType: detail.eventType,
          currency: detail.currency,
          minPrice: detail.minPrice,
          saleState: detail.saleState,
          coverImage: detail.coverImage,
          artistImage: detail.artistImage,
          isDemo: detail.isDemo,
        }));
        return { status: 200, body: { events: list } };
      }
      const state = events.get(id);
      if (!state) return errorResult("event_not_found");
      if (tail === undefined) return { status: 200, body: state.detail };
      if (tail === "availability" && segments.length === 3) {
        const availability: Availability = {
          at: new Date(now()).toISOString(),
          tables: state.detail.plan.tables
            .filter((t) => t.sellable)
            .map((t) => {
              const freeSeats = state.freeSeats.get(t.id) ?? [];
              return { id: t.id, free: freeSeats.length, freeSeats: [...freeSeats] };
            }),
        };
        return { status: 200, body: availability };
      }
    }
    if (head === "orders") {
      if (id === undefined && method === "POST") return createHold(body);
      if (id === "lookup" && tail === undefined && method === "POST") {
        const parsed = lookupBodySchema.safeParse(body);
        if (!parsed.success) return errorResult("invalid", { fieldErrors: z.flattenError(parsed.error).fieldErrors });
        const pnr = normalizePnr(parsed.data.pnr);
        const last = trUpper(parsed.data.lastName);
        const found = [...orders.values()].find((o) => o.pnr === pnr && o.lastNameKey === last);
        return found ? { status: 200, body: { orderToken: found.token } } : errorResult("order_not_found");
      }
      if (id !== undefined && segments.length <= 3) {
        const order = orders.get(id);
        if (!order) return errorResult("order_not_found");
        if (tail === undefined && method === "GET") return { status: 200, body: toResponse(order) };
        if (tail === undefined && method === "DELETE") {
          if (order.status === "paid") return errorResult("already_paid");
          if (order.status === "pending") {
            order.status = "expired";
            release(order);
          }
          return { status: 204, body: null };
        }
        if (tail === "pay" && method === "POST") return pay(order, body);
      }
    }
    return errorResult("invalid");
  }

  const authorized = (header: string | null) => {
    const expected = Buffer.from(`Bearer ${secret}`);
    const actual = Buffer.from(header ?? "");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  };

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const entry: FakeRequest = {
      method: request.method,
      path: url.pathname,
      authorization: request.headers.get("authorization"),
      clientIp: request.headers.get("x-sales-client-ip"),
    };
    requests.push(entry);
    if (!authorized(entry.authorization)) return json(errorResult("unauthorized"));
    const failure = failures.findIndex((f) => f.pattern.test(url.pathname));
    if (failure >= 0) {
      const status = failures[failure]!.status;
      failures.splice(failure, 1);
      const code = (Object.keys(SALES_ERROR_STATUS) as SalesErrorCode[]).find((c) => SALES_ERROR_STATUS[c] === status);
      // Sözleşmede eşlenmeyen durum (ör. 502) gerçek bir ağ geçidi gibi gövdesiz döner.
      return code ? json(errorResult(code)) : new Response(null, { status });
    }
    if (!url.pathname.startsWith(`${API_PREFIX}/`)) return json(errorResult("invalid"));
    let body: unknown;
    if (request.method === "POST") {
      try {
        body = await request.json();
      } catch {
        return json(errorResult("invalid"));
      }
    }
    const segments = url.pathname
      .slice(API_PREFIX.length + 1)
      .split("/")
      .filter(Boolean);
    if (request.method === "GET" && segments[0] === "images" && segments.length === 3) {
      const imagePath = `${segments[1]}/${segments[2]}`;
      if (IMAGE_PATH_PATTERN.test(imagePath) && hasSeededImage(imagePath)) {
        return new Response(FAKE_WEBP_BYTES, {
          status: 200,
          headers: {
            "content-type": "image/webp",
            "cache-control": "private, max-age=300",
            "x-content-type-options": "nosniff",
          },
        });
      }
      return json(errorResult("event_not_found"));
    }
    return json(route(request.method, segments, body));
  }

  const core: FakeCore = {
    secret,
    requests,
    addEvent,
    free(eventId, id) {
      refresh();
      return events.get(eventId)?.freeSeats.get(id)?.length ?? 0;
    },
    freeSeats(eventId, id) {
      refresh();
      return [...(events.get(eventId)?.freeSeats.get(id) ?? [])];
    },
    holdAs(eventId, id, quantity, seatNos) {
      refresh();
      const result = createHold({
        eventId,
        items: [{ tableId: id, quantity, ...(seatNos === undefined ? {} : { seatNos }) }],
        clientKey: randomUUID(),
      });
      if (result.status >= 300) throw new Error(`holdAs başarısız: ${JSON.stringify(result.body)}`);
      return result.body as OrderResponse;
    },
    expireOrder(orderToken, remainingMs = 0) {
      const order = orders.get(orderToken);
      if (order && order.status === "pending") order.holdExpiresMs = now() + remainingMs;
      refresh();
    },
    advance(ms) {
      offsetMs += ms;
      refresh();
    },
    failNext(pathPattern, status) {
      failures.push({ pattern: pathPattern, status });
    },
    resetOrders() {
      orders.clear();
      clientKeys.clear();
      for (const state of events.values()) {
        for (const t of state.detail.plan.tables) {
          if (t.sellable) state.freeSeats.set(t.id, [...t.seatNos].sort((a, b) => a - b));
        }
      }
    },
    handle,
    async listen(port) {
      const reply = (value: unknown, status = 200) =>
        new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
      const control = async (request: Request, pathname: string): Promise<Response> => {
        if (pathname === "/__fake/requests" && request.method === "GET") return reply(requests);
        if (request.method !== "POST") return reply({ error: "yöntem desteklenmiyor" }, 405);
        const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        try {
          switch (pathname) {
            case "/__fake/events":
              return reply(addEvent(input as FakeEventSeed));
            case "/__fake/hold-as": {
              const seatNos = Array.isArray(input.seatNos) ? input.seatNos.map(Number) : undefined;
              return reply(core.holdAs(String(input.eventId), String(input.tableId), Number(input.quantity), seatNos));
            }
            case "/__fake/expire-order":
              core.expireOrder(String(input.orderToken), input.remainingMs === undefined ? 0 : Number(input.remainingMs));
              return reply({ ok: true });
            case "/__fake/fail-next":
              core.failNext(new RegExp(String(input.pattern)), Number(input.status));
              return reply({ ok: true });
            case "/__fake/reset-orders":
              core.resetOrders();
              return reply({ ok: true });
            default:
              return reply({ error: "bilinmeyen denetim ucu" }, 404);
          }
        } catch (error) {
          return reply({ error: error instanceof Error ? error.message : "hata" }, 400);
        }
      };
      const server = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          const url = new URL(req.url ?? "/", "http://127.0.0.1");
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === "string") headers.set(key, value);
          }
          const method = req.method ?? "GET";
          const hasBody = method !== "GET" && method !== "HEAD" && chunks.length > 0;
          const request = new Request(url, { method, headers, body: hasBody ? Buffer.concat(chunks) : undefined });
          const run = url.pathname.startsWith("/__fake/") ? control(request, url.pathname) : handle(request);
          run
            .then(async (response) => {
              res.writeHead(response.status, Object.fromEntries(response.headers));
              res.end(Buffer.from(await response.arrayBuffer()));
            })
            .catch(() => {
              res.writeHead(500);
              res.end();
            });
        });
      });
      await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
      const address = server.address() as AddressInfo;
      return {
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
            server.closeAllConnections();
          }),
      };
    },
  };
  return core;
}
