import type { Db, Tx } from "@/db/client";
import type { Actor } from "@/features/auth/session";
import { getSecurityPolicy, type SecurityPolicy } from "./security-policy";
import { listActiveSessions, listLockouts, type LockoutRow, type SessionRow } from "./security-service";

/** İstemciye gidenler: tarihler ISO metni (sunucu/istemci biçimleme farkı olmasın). */
export type SecuritySession = Omit<SessionRow, "createdAt" | "expiresAt"> & { createdAt: string; expiresAt: string };
export type SecurityLockout = Omit<LockoutRow, "expiresAt"> & { expiresAt: string };

export type SecurityOverview = {
  policy: SecurityPolicy;
  sessions: SecuritySession[];
  lockouts: SecurityLockout[];
};

export async function getSecurityOverview(
  db: Db | Tx,
  actor: Actor,
  currentSessionId: string | null,
): Promise<SecurityOverview> {
  const [sessions, lockouts] = await Promise.all([
    listActiveSessions(db, actor, currentSessionId),
    listLockouts(db, actor),
  ]);
  return {
    policy: getSecurityPolicy(),
    sessions: sessions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    })),
    lockouts: lockouts.map((l) => ({ ...l, expiresAt: l.expiresAt.toISOString() })),
  };
}
