import { sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { encodeRealtimeEvent, REALTIME_CHANNEL, type RealtimeEventInput } from "./events";

/**
 * Canlı güncelleme olayı yayar (`pg_notify`). Verilen yürütücü üzerinde çalışır:
 * transaction içinde çağrılırsa olay yalnızca commit ile dağıtılır, geri alınırsa
 * hiç dağıtılmaz. Geçersiz veya 7900 bayttan büyük yükte `RealtimePayloadError`
 * fırlatır (transaction içindeyse onu da geri aldırır — bu bir programlama hatasıdır).
 *
 * Aynı transaction'da aynı yük iki kez yayılırsa PostgreSQL tek bildirim teslim eder.
 */
export async function publish(tx: Tx | Db, event: RealtimeEventInput): Promise<void> {
  const payload = encodeRealtimeEvent(event);
  await tx.execute(sql`select pg_notify(${REALTIME_CHANNEL}, ${payload})`);
}
