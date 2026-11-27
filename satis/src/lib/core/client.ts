import { env } from "@/lib/env";
import {
  IMAGE_PATH_PATTERN,
  SALES_ERROR_CODES,
  type Availability,
  type EventCard,
  type EventDetail,
  type OrderResponse,
} from "./contract";
import { CoreError, type SiteErrorCode } from "./errors";

/**
 * Çekirdek satış API'si istemcisi. Yalnızca sunucuda çalışır: `"use client"` dosyalarından
 * (dolaylı da olsa) içe aktarılmaz.
 */
export type WriteContext = { clientIp: string | null };

export type HoldInput = {
  eventId: string;
  items: { tableId: string; quantity: number; seatNos?: number[] }[];
  clientKey: string;
};

export type PayInput = {
  buyer: { firstName: string; lastName: string; email: string; phone?: string };
  acceptTerms: true;
  payment: { provider: "demo"; action: "approve" | "decline" };
};

export type CoreClient = {
  listEvents(): Promise<EventCard[]>;
  getEvent(eventId: string): Promise<EventDetail>;
  getAvailability(eventId: string): Promise<Availability>;
  getImage(path: string): Promise<{ body: ArrayBuffer; contentType: "image/webp" }>;
  createHold(input: HoldInput, ctx: WriteContext): Promise<OrderResponse>;
  getOrder(orderToken: string): Promise<OrderResponse>;
  payOrder(orderToken: string, input: PayInput, ctx: WriteContext): Promise<OrderResponse>;
  releaseOrder(orderToken: string, ctx: WriteContext): Promise<void>;
  lookupOrder(input: { pnr: string; lastName: string }, ctx: WriteContext): Promise<{ orderToken: string }>;
};

type CoreConfig = { baseUrl: string; secret: string; fetch?: typeof fetch; timeoutMs?: number };

const API_PREFIX = "/api/sales/v1";
const DEFAULT_TIMEOUT_MS = 8000;
const KNOWN_CODES: readonly string[] = SALES_ERROR_CODES;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parseRetryAfter(header: string | null): number | undefined {
  if (!header || !/^\d+$/.test(header.trim())) return undefined;
  const seconds = Number.parseInt(header.trim(), 10);
  return seconds > 0 ? seconds : undefined;
}

async function toError(response: Response): Promise<CoreError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return new CoreError("core_unreachable", response.status);
  }
  const error = isRecord(body) ? body.error : undefined;
  const code = isRecord(error) ? error.code : undefined;
  if (typeof code !== "string" || !KNOWN_CODES.includes(code)) {
    return new CoreError("core_unreachable", response.status);
  }
  const details = isRecord(error) && isRecord(error.details) ? error.details : undefined;
  const retryAfter = response.status === 429 ? parseRetryAfter(response.headers.get("retry-after")) : undefined;
  return new CoreError(code as SiteErrorCode, response.status, details, retryAfter);
}

export function createCoreClient(config: CoreConfig): CoreClient {
  const doFetch = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseUrl = config.baseUrl.replace(/\/+$/, "");

  /** Zaman aşımı başlıktan gövdenin tamamen okunmasına kadar sürer. `none`: gövde okunmaz (204). */
  async function requestRaw<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    headers: Record<string, string>,
    body: unknown,
    readResponse: (response: Response) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new CoreError("core_unreachable", 0));
      }, timeoutMs);
    });
    const work = (async () => {
      const response = await doFetch(`${baseUrl}${API_PREFIX}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) throw await toError(response);
      return await readResponse(response);
    })();
    work.catch(() => undefined);
    try {
      return await Promise.race([work, timeout]);
    } catch (error) {
      if (error instanceof CoreError) throw error;
      throw new CoreError("core_unreachable", 0);
    } finally {
      clearTimeout(timer);
    }
  }

  async function request(
    method: "GET" | "POST" | "DELETE",
    path: string,
    options: { body?: unknown; ctx?: WriteContext; read?: "json" | "none" } = {},
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${config.secret}`,
      accept: "application/json",
    };
    if (options.body !== undefined) headers["content-type"] = "application/json";
    if (options.ctx?.clientIp) headers["x-sales-client-ip"] = options.ctx.clientIp;
    return requestRaw(method, path, headers, options.body, async (response) => {
      if (options.read === "none") return undefined;
      try {
        return await response.json();
      } catch {
        throw new CoreError("core_unreachable", response.status);
      }
    });
  }

  const orderPath = (orderToken: string) => `/orders/${encodeURIComponent(orderToken)}`;

  return {
    async listEvents() {
      const body = (await request("GET", "/events")) as { events: EventCard[] };
      return body.events;
    },
    async getEvent(eventId) {
      return (await request("GET", `/events/${encodeURIComponent(eventId)}`)) as EventDetail;
    },
    async getAvailability(eventId) {
      return (await request("GET", `/events/${encodeURIComponent(eventId)}/availability`)) as Availability;
    },
    async getImage(path) {
      if (!IMAGE_PATH_PATTERN.test(path)) {
        throw new CoreError("event_not_found", 404);
      }
      return requestRaw(
        "GET",
        `/images/${path}`,
        { authorization: `Bearer ${config.secret}` },
        undefined,
        async (response) => {
          try {
            return { body: await response.arrayBuffer(), contentType: "image/webp" as const };
          } catch {
            throw new CoreError("core_unreachable", response.status);
          }
        },
      );
    },
    async createHold(input, ctx) {
      const body = {
        eventId: input.eventId,
        items: input.items.map((i) => ({
          tableId: i.tableId,
          quantity: i.quantity,
          ...(i.seatNos === undefined ? {} : { seatNos: i.seatNos }),
        })),
        clientKey: input.clientKey,
      };
      return (await request("POST", "/orders", { body, ctx })) as OrderResponse;
    },
    async getOrder(orderToken) {
      return (await request("GET", orderPath(orderToken))) as OrderResponse;
    },
    async payOrder(orderToken, input, ctx) {
      const { buyer } = input;
      const body = {
        buyer: {
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          email: buyer.email,
          ...(buyer.phone === undefined ? {} : { phone: buyer.phone }),
        },
        acceptTerms: input.acceptTerms,
        payment: { provider: input.payment.provider, action: input.payment.action },
      };
      return (await request("POST", `${orderPath(orderToken)}/pay`, { body, ctx })) as OrderResponse;
    },
    async releaseOrder(orderToken, ctx) {
      await request("DELETE", orderPath(orderToken), { ctx, read: "none" });
    },
    async lookupOrder(input, ctx) {
      const body = { pnr: input.pnr, lastName: input.lastName };
      return (await request("POST", "/orders/lookup", { body, ctx })) as { orderToken: string };
    },
  };
}

let instance: CoreClient | undefined;

/** Ortamdan yapılandırılmış tekil istemci. */
export function getCore(): CoreClient {
  instance ??= createCoreClient({ baseUrl: env.CORE_API_URL, secret: env.SALES_API_SECRET });
  return instance;
}
