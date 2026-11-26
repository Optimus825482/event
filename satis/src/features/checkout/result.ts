import { CoreError, messageFor, type SiteErrorCode } from "@/lib/core/errors";

export type ActionFailure = {
  ok: false;
  code: SiteErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
  details?: { tableId?: string; free?: number; seats?: number };
  retryAfterSeconds?: number;
};

export type ActionResult<T> = { ok: true; data: T } | ActionFailure;

function pickDetails(raw: Record<string, unknown> | undefined): ActionFailure["details"] {
  if (!raw) return undefined;
  const details: NonNullable<ActionFailure["details"]> = {};
  if (typeof raw.tableId === "string") details.tableId = raw.tableId;
  if (typeof raw.free === "number") details.free = raw.free;
  if (typeof raw.seats === "number") details.seats = raw.seats;
  return Object.keys(details).length > 0 ? details : undefined;
}

/** Hatayı kullanıcıya gösterilebilir sonuca çevirir; çekirdeğin ham mesajı sızmaz. */
export function failure(error: unknown): ActionFailure {
  if (error instanceof CoreError) {
    const details = pickDetails(error.details);
    return {
      ok: false,
      code: error.code,
      message: messageFor(error),
      ...(details ? { details } : {}),
      ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
    };
  }
  return { ok: false, code: "core_unreachable", message: messageFor({ code: "core_unreachable" }) };
}
