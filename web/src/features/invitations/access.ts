import type { Db, Tx } from "@/db/client";
import { systemSettings } from "@/db/schema";
import { DomainError } from "@/lib/action";

type Executor = Db | Tx;

/** Eski davranış: sistem ayarlarında davetiye sistemi kapalıysa yönetim işlemleri reddedilir. */
export async function assertInvitationSystemEnabled(db: Executor): Promise<void> {
  const [row] = await db.select({ enabled: systemSettings.invitationSystemEnabled }).from(systemSettings).limit(1);
  if (row && !row.enabled) {
    throw new DomainError("conflict", "Davetiye sistemi şu anda devre dışı. Sistem ayarlarından etkinleştirebilirsiniz.");
  }
}
