import type { z } from "zod";
import { logError } from "@/lib/log";
import { SalesError } from "@/features/ticketing/orders-service";
import { MAX_BODY_BYTES, SALES_ERROR_MESSAGES, SALES_ERROR_STATUS, type SalesErrorCode } from "./contract";

export function salesJson(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

export function salesFailure(
  code: SalesErrorCode,
  options: { message?: string; details?: Record<string, unknown>; headers?: Record<string, string> } = {},
): Response {
  const error: { code: SalesErrorCode; message: string; details?: Record<string, unknown> } = {
    code,
    message: options.message ?? SALES_ERROR_MESSAGES[code],
  };
  if (options.details !== undefined) error.details = options.details;
  return salesJson(SALES_ERROR_STATUS[code], { error }, options.headers);
}

export function toSalesResponse(error: unknown): Response {
  if (error instanceof SalesError) {
    return salesFailure(error.salesCode, { message: error.message, details: error.details });
  }
  logError("sales-api", error);
  return salesJson(500, { error: { code: "internal", message: "Beklenmeyen bir hata oluştu" } });
}

const encoder = new TextEncoder();

function invalid(details?: Record<string, unknown>): { ok: false; response: Response } {
  return { ok: false, response: salesFailure("invalid", details ? { details } : {}) };
}

/** Gövdeyi en çok `MAX_BODY_BYTES` okur, JSON'a çevirir ve şemayla doğrular. */
export async function readJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  const declared = request.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared) && Number.parseInt(declared, 10) > MAX_BODY_BYTES) return invalid();

  let text = "";
  if (request.body) {
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return invalid();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  }
  if (encoder.encode(text).byteLength > MAX_BODY_BYTES) return invalid();

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return invalid();
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "_";
      (fieldErrors[path] ??= []).push(issue.message);
    }
    return invalid({ fieldErrors });
  }
  return { ok: true, data: parsed.data };
}
