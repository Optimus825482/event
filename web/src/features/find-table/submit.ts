import type { Db } from "@/db/client";
import { env } from "@/env";
import { invitationClientKey } from "@/features/invitations/rate-limit";
import { findTableByCode } from "./lookup";
import { FindTableRateLimitedError, type FindTableLimiters } from "./rate-limit";

export const FIND_TABLE_MISMATCH = "Kod ya da soyad hatalı";

const MAX_CODE_LENGTH = 64;
const MAX_LAST_NAME_LENGTH = 100;

export type FindTableOutcome =
  | { kind: "found"; token: string }
  | { kind: "mismatch" }
  | { kind: "limited"; retryAfterSeconds: number };

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * Form girdisini kırpıp arar. Her çağrı (boş girdi dahil) `findTableByCode`'dan geçer; IP sayacı oradadır.
 * IP yalnızca yapılandırılmış güvenilir başlıktan okunur. Kod ve soyad günlüğe yazılmaz.
 */
export async function submitFindTable(
  db: Db,
  raw: { code: unknown; lastName: unknown },
  headers: Headers,
  deps: { limiters?: FindTableLimiters; trustedHeader?: string | undefined } = {},
): Promise<FindTableOutcome> {
  const trustedHeader = "trustedHeader" in deps ? deps.trustedHeader : env.TRUSTED_IP_HEADER;
  const ip = invitationClientKey(headers, trustedHeader);
  try {
    const found = await findTableByCode(
      db,
      { code: text(raw.code, MAX_CODE_LENGTH), lastName: text(raw.lastName, MAX_LAST_NAME_LENGTH) },
      { ip },
      { limiters: deps.limiters },
    );
    return found ? { kind: "found", token: found.token } : { kind: "mismatch" };
  } catch (error) {
    if (error instanceof FindTableRateLimitedError) return { kind: "limited", retryAfterSeconds: error.retryAfterSeconds };
    throw error;
  }
}
