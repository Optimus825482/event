import { env } from "@/lib/env";
import { SALES_ERROR_CODES, type Availability, type EventCard, type EventDetail, type OrderResponse } from "./contract";
import { CoreError, type SiteErrorCode } from "./errors";

/**
 * Çekirdek satış API'si istemcisi. Yalnızca sunucuda çalışır: `"use client"` dosyalarından
 * (dolaylı da olsa) içe aktarılmaz.
 */
export type WriteContext = { clientIp: string | null };

export type HoldInput = {
  eventId: string;
  items: { tableId: string; quantity: number }[];
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

  async function request(
    method: "GET" | "POST" | "DELETE",
    path: string,
    options: { body?: unknown; ctx?: WriteContext } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${config.secret}`,
      accept: "application/json",
    };
    if (options.body !== undefined) headers["content-type"] = "application/json";
    if (options.ctx?.clientIp) headers["x-sales-client-ip"] = options.ctx.clientIp;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new CoreError("core_unreachable", 0));
      }, timeoutMs);
    });
    try {
      const response = await Promise.race([
        doFetch(`${baseUrl}${API_PREFIX}${path}`, {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          cache: "no-store",
          signal: controller.signal,
        }),
        timeout,
      ]);
      if (!response.ok) throw await toError(response);
      return response;
    } catch (error) {
      if (error instanceof CoreError) throw error;
      throw new CoreError("core_unreachable", 0);
    } finally {
      clearTimeout(timer);
    }
  }

  async function readJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      throw new CoreError("core_unreachable", response.status);
    }
  }

  const orderPath = (orderToken: string) => `/orders/${encodeURIComponent(orderToken)}`;

  return {
    async listEvents() {
      const body = await readJson<{ events: EventCard[] }>(await request("GET", "/events"));
      return body.events;
    },
    async getEvent(eventId) {
      return readJson<EventDetail>(await request("GET", `/events/${encodeURIComponent(eventId)}`));
    },
    async getAvailability(eventId) {
      return readJson<Availability>(await request("GET", `/events/${encodeURIComponent(eventId)}/availability`));
    },
    async createHold(input, ctx) {
      return readJson<OrderResponse>(await request("POST", "/orders", { body: input, ctx }));
    },
    async getOrder(orderToken) {
      return readJson<OrderResponse>(await request("GET", orderPath(orderToken)));
    },
    async payOrder(orderToken, input, ctx) {
      return readJson<OrderResponse>(await request("POST", `${orderPath(orderToken)}/pay`, { body: input, ctx }));
    },
    async releaseOrder(orderToken, ctx) {
      await request("DELETE", orderPath(orderToken), { ctx });
    },
    async lookupOrder(input, ctx) {
      return readJson<{ orderToken: string }>(await request("POST", "/orders/lookup", { body: input, ctx }));
    },
  };
}

let instance: CoreClient | undefined;

/** Ortamdan yapılandırılmış tekil istemci. */
export function getCore(): CoreClient {
  instance ??= createCoreClient({ baseUrl: env.CORE_API_URL, secret: env.SALES_API_SECRET });
  return instance;
}
