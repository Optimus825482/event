import { purgeStaleItems } from "./flusher";
import { createIdbStore, idbAvailable } from "./idb-store";
import { purgeAuthenticatedShell } from "./purge-shell";

/** IndexedDB kuyruğundaki süresi geçmiş öğeleri siler. Savunmacı: hata ya da IndexedDB yokluğu sessizce geçilir. */
export async function purgeStaleQueue(now: number = Date.now()): Promise<void> {
  if (!idbAvailable()) return;
  try {
    await purgeStaleItems(createIdbStore(), now);
  } catch {
    // depo erişilemiyor: çıkış bunun yüzünden takılmaz
  }
}

/** Çıkışta: kabuk önbelleği + süresi geçmiş kuyruk öğeleri. */
export async function purgeOnSignOut(): Promise<void> {
  await Promise.all([purgeAuthenticatedShell(), purgeStaleQueue()]);
}
