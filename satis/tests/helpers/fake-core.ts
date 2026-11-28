import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { z } from "zod";
import {
  DEMO_NOTICE,
  HERO_VIDEO_PATH_PATTERN,
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
  heroVideo: "event/00000000-0000-4000-8000-0000000000c3.webm",
} as const;

/** En küçük EBML başlığı (DocType `webm`) ve birkaç dolgu baytı. */
export const FAKE_WEBM_BYTES = Uint8Array.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x87, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d, 0x18, 0x53, 0x80, 0x67, 0x11, 0x11,
]);

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
  canvas?: { width: number; height: number };
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

/** Demo Diamond salonu (çekirdek `web/src/features/demo/diamond-plan.ts`): masa no, x ve z metre (15 px = 1 m). */
const DIAMOND_COORDS =
  "1,-26.94,-18.85;2,-23.38,-18.85;3,-19.82,-18.85;4,-16.25,-18.85;5,-12.69,-18.85;6,12.69,-18.85;" +
  "7,16.25,-18.85;8,19.82,-18.85;9,23.38,-18.85;10,26.94,-18.85;11,-25.82,-15.88;12,-22.2,-15.88;" +
  "13,-18.58,-15.88;14,-14.96,-15.88;15,-11.34,-15.88;16,11.34,-15.88;17,14.96,-15.88;18,18.58,-15.88;" +
  "19,22.2,-15.88;20,25.82,-15.88;21,-26.06,-12.91;22,-22.55,-12.91;23,-19.04,-12.91;24,-15.52,-12.91;" +
  "25,-12.01,-12.91;26,12.01,-12.91;27,15.52,-12.91;28,19.04,-12.91;29,22.55,-12.91;30,26.06,-12.91;" +
  "31,-25.32,-9.9;32,-21.7,-9.9;33,-18.08,-9.9;34,-14.45,-9.9;35,-10.83,-9.9;36,-7.21,-9.9;" +
  "37,-3.59,-9.9;38,3.59,-9.9;39,7.21,-9.9;40,10.83,-9.9;41,14.45,-9.9;42,18.08,-9.9;43,21.7,-9.9;" +
  "44,25.32,-9.9;45,-25.43,-6.85;46,-21.83,-6.85;47,-18.24,-6.85;48,-14.65,-6.85;49,-11.06,-6.85;" +
  "50,-7.47,-6.85;51,-3.87,-6.85;52,3.87,-6.85;53,7.47,-6.85;54,11.06,-6.85;55,14.65,-6.85;" +
  "56,18.24,-6.85;57,21.83,-6.85;58,25.43,-6.85;59,-24.19,-3.65;60,-20.8,-3.65;61,-17.4,-3.65;" +
  "62,-14.01,-3.65;63,-10.61,-3.65;64,-7.22,-3.65;65,7.22,-3.65;66,10.61,-3.65;67,14.01,-3.65;" +
  "68,17.4,-3.65;69,20.8,-3.65;70,24.19,-3.65;71,-24.81,-0.35;72,-21.22,-0.35;73,-17.64,-0.35;" +
  "74,-14.05,-0.35;75,-10.46,-0.35;76,-6.87,-0.35;77,-3.28,-0.35;78,0.31,-0.35;79,3.9,-0.35;" +
  "80,7.49,-0.35;81,11.08,-0.35;82,14.67,-0.35;83,18.26,-0.35;84,21.84,-0.35;85,25.43,-0.35;" +
  "86,-24.81,2.65;87,-21.22,2.65;88,-17.64,2.65;89,-14.05,2.65;90,-10.46,2.65;91,-6.87,2.65;" +
  "92,-3.28,2.65;93,0.31,2.65;94,3.9,2.65;95,7.49,2.65;96,11.08,2.65;97,14.67,2.65;98,18.26,2.65;" +
  "99,21.84,2.65;100,25.43,2.65;101,-23.65,6.08;102,-20.08,6.08;103,-16.51,6.08;104,-12.95,6.08;" +
  "105,-9.38,6.08;106,-5.81,6.08;107,-2.24,6.08;108,1.32,6.08;109,4.89,6.08;110,8.46,6.08;" +
  "111,12.03,6.08;112,15.59,6.08;113,19.16,6.08;114,22.73,6.08;115,26.3,6.08;116,-24.23,9.5;" +
  "117,-20.72,9.5;118,-17.22,9.5;119,-13.71,9.5;120,-10.2,9.5;121,-6.69,9.5;122,-3.19,9.5;123,0.32,9.5;" +
  "124,3.83,9.5;125,7.33,9.5;126,10.84,9.5;127,14.35,9.5;128,17.85,9.5;129,21.36,9.5;130,24.87,9.5;" +
  "131,28.37,9.5;132,-26.19,12.92;133,-22.78,12.92;134,-19.37,12.92;135,-15.96,12.92;136,-12.55,12.92;" +
  "137,-9.14,12.92;138,-5.73,12.92;139,8.86,12.92;140,12.55,12.92;141,16.25,12.92;142,19.94,12.92;" +
  "143,23.63,12.92;144,27.33,12.92;145,-28.7,-1.03;146,-28.7,1.76;147,-28.7,4.55;148,29,-11.21;" +
  "149,29,-8.18;150,29,-4.22;151,29,1.02;152,29,-13.93;153,20.52,16.26;154,15.35,16.26;" +
  "155,-11.34,16.26;156,-16.5,16.26;157,-28.7,8.13;158,-28.7,-6.27;159,-28.7,-9.71;160,-20.66,16.26;" +
  "161,-25.4,16.26";
const DIAMOND_STAGE_TABLES = new Set([
  4, 5, 6, 7, 14, 15, 16, 17, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 49, 50, 51, 52, 53, 54, 63, 64, 65, 66,
  75, 76, 77, 78, 79, 80, 81, 91, 92, 93, 94, 95,
]);
const DIAMOND_BOXES = ["9B", "9A", "8B", "8", "7", "6", "5", "4", "3B", "3A", "2", "1"];

/** Demo Diamond salonuna benzer tohum: 161 masa (M-1…M-161), 12 loca (L-…), sahne + podyum, 960×710 tuval. */
export function diamondSeed(): Required<Pick<FakeEventSeed, "tables" | "decor" | "lines" | "canvas">> {
  const px = 15;
  const cx = (xm: number) => 480 + xm * px;
  const cy = (zm: number) => (zm + 22) * px;
  let index = 0x0d00;
  const tables: FakeTable[] = DIAMOND_COORDS.split(";").map((row) => {
    const [num, xm, zm] = row.split(",").map(Number) as [number, number, number];
    const category: SaleCategory = DIAMOND_STAGE_TABLES.has(num) ? "vip" : zm / 18.9 < 0.28 ? "premium" : "standard";
    return {
      id: tableId(index++),
      label: `M-${num}`,
      x: cx(xm),
      y: cy(zm),
      rotation: 0,
      shape: "round",
      isLoca: false,
      sellable: true,
      category,
      capacity: 12,
      seats: 12,
      seatNos: Array.from({ length: 12 }, (_, i) => i + 1),
      wholeOnly: false,
    };
  });
  DIAMOND_BOXES.forEach((box, i) => {
    tables.push({
      id: tableId(index++),
      label: `L-${box}`,
      x: cx((i - 5.5) * 4.97),
      y: cy(21.18),
      rotation: 0,
      shape: "rectangle",
      isLoca: true,
      sellable: true,
      category: "vip",
      capacity: 12,
      seats: 12,
      seatNos: Array.from({ length: 12 }, (_, n) => n + 1),
      wholeOnly: true,
    });
  });
  const decor = [
    { id: "stage", kind: "stage", x: cx(-17.4 / 2), y: cy(-15.9 - 8.5 / 2), width: 17.4 * px, height: 8.5 * px, label: "SAHNE" },
    { id: "catwalk-stem", kind: "catwalk", x: cx(-2.7 / 2), y: cy(-7.9 - 8 / 2), width: 2.7 * px, height: 8 * px, label: "" },
    { id: "catwalk-cross", kind: "catwalk", x: cx(-10.6 / 2), y: cy(-3.15 - 2.7 / 2), width: 10.6 * px, height: 2.7 * px, label: "" },
  ];
  const b = { left: 30, top: 20, right: 930, bottom: 680 };
  const lines = [
    { id: "border-top", x1: b.left, y1: b.top, x2: b.right, y2: b.top, width: 4 },
    { id: "border-left", x1: b.left, y1: b.top, x2: b.left, y2: b.bottom, width: 4 },
    { id: "border-right", x1: b.right, y1: b.top, x2: b.right, y2: b.bottom, width: 4 },
    { id: "border-bottom", x1: b.left, y1: b.bottom, x2: b.right, y2: b.bottom, width: 4 },
  ];
  return { tables, decor, lines, canvas: { width: 960, height: 710 } };
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
      plan: { canvas: seed.canvas ?? { width: 1200, height: 800 }, tables, decor: seed.decor ?? [], lines: seed.lines ?? [] },
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
          heroImage: detail.site.heroImage,
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
      const video = HERO_VIDEO_PATH_PATTERN.test(imagePath);
      if ((video || IMAGE_PATH_PATTERN.test(imagePath)) && hasSeededImage(imagePath)) {
        return new Response(video ? FAKE_WEBM_BYTES : FAKE_WEBP_BYTES, {
          status: 200,
          headers: {
            "content-type": video ? "video/webm" : "image/webp",
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
