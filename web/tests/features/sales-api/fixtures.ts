import { randomBytes } from "node:crypto";
import { vi } from "vitest";
import { db } from "@/db/client";
import { createSalesHandlers, type SalesDeps } from "@/features/sales-api/handlers";
import type { SalesRateScope } from "@/features/sales-api/rate-limits";
import { demoProvider } from "@/features/ticketing/payment/demo";
import type { AsyncRateLimiter } from "@/lib/rate-limit";

export const TEST_SECRET = randomBytes(24).toString("hex");

export const allowAll: AsyncRateLimiter = { check: async () => ({ allowed: true }) };

export function allowAllLimiters(): Record<SalesRateScope, AsyncRateLimiter> {
  return { sales_hold: allowAll, sales_pay: allowAll, sales_lookup_ip: allowAll, sales_lookup_pnr: allowAll };
}

/** Çağrı anahtarlarını kaydeder ve her zaman izin verir. */
export function countingLimiter(): AsyncRateLimiter & { keys: string[] } {
  const keys: string[] = [];
  return {
    keys,
    check: async (key) => {
      keys.push(key);
      return { allowed: true };
    },
  };
}

export function denyLimiter(retryAfterSeconds: number): AsyncRateLimiter {
  return { check: async () => ({ allowed: false, retryAfterSeconds }) };
}

export function makeApi(overrides: Partial<SalesDeps> = {}) {
  const deferred: Array<() => Promise<void>> = [];
  const sendEmail = vi.fn<(orderId: string) => Promise<unknown>>(async () => undefined);
  const handlers = createSalesHandlers({
    db,
    secret: TEST_SECRET,
    provider: () => demoProvider,
    now: Date.now,
    limiters: allowAllLimiters(),
    defer: (task) => {
      deferred.push(task);
    },
    sendEmail,
    ...overrides,
  });
  return {
    ...handlers,
    sendEmail: overrides.sendEmail ? vi.mocked(overrides.sendEmail) : sendEmail,
    /** Ertelenen görevleri çalıştırır (görevler kendi hatasını yakalar; burada fırlatırsa test düşer). */
    async runDeferred(): Promise<void> {
      const tasks = deferred.splice(0);
      for (const task of tasks) await task();
    },
  };
}

export function req(
  method: string,
  path: string,
  o: { body?: unknown; raw?: string; auth?: string | null; ip?: string } = {},
): Request {
  const headers: Record<string, string> = {};
  const auth = o.auth === undefined ? `Bearer ${TEST_SECRET}` : o.auth;
  if (auth !== null) headers.authorization = auth;
  if (o.ip !== undefined) headers["x-sales-client-ip"] = o.ip;
  let body: string | undefined;
  if (o.raw !== undefined) body = o.raw;
  else if (o.body !== undefined) body = JSON.stringify(o.body);
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`http://localhost${path}`, { method, headers, body });
}

export async function bodyOf<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
