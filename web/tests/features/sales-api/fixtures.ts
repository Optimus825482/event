import { randomBytes } from "node:crypto";
import { db } from "@/db/client";
import { createSalesHandlers, type SalesDeps } from "@/features/sales-api/handlers";
import { demoProvider } from "@/features/ticketing/payment/demo";

export const TEST_SECRET = randomBytes(24).toString("hex");

export function makeApi(overrides: Partial<SalesDeps> = {}) {
  return createSalesHandlers({ db, secret: TEST_SECRET, provider: () => demoProvider, now: Date.now, ...overrides });
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
