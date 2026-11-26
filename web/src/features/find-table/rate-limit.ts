import type { Db } from "@/db/client";
import { createPgRateLimiter, type AsyncRateLimiter } from "@/lib/rate-limit";

export const FIND_TABLE_IP_LIMIT = { limit: 5, windowMs: 600_000 } as const;
export const FIND_TABLE_CODE_LIMIT = { limit: 10, windowMs: 3_600_000 } as const;

export type FindTableLimiters = { ip: AsyncRateLimiter; code: AsyncRateLimiter };

/** İkisi de veritabanı hatasında kapalı kalır: kaba kuvvet korumasının sessizce kalkması istenmez. */
export function createFindTableLimiters(db: Pick<Db, "execute">): FindTableLimiters {
  return {
    ip: createPgRateLimiter({ db, scope: "find_table_ip", ...FIND_TABLE_IP_LIMIT, onFailure: "closed" }),
    code: createPgRateLimiter({ db, scope: "find_table_code", ...FIND_TABLE_CODE_LIMIT, onFailure: "closed" }),
  };
}

export class FindTableRateLimitedError extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("Çok fazla deneme");
    this.name = "FindTableRateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
