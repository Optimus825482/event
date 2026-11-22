import type { NotificationRow } from "./service";

/**
 * GERÇEK ZAMANLI YAYIN BAĞLANTI NOKTASI (tek yer).
 *
 * Bildirim satırları transaction tamamlandıktan sonra buraya verilir. Gerçek zamanlı (SSE)
 * katmanı hazır olduğunda yalnızca bu işlevin gövdesi `publish(...)` çağıracak şekilde
 * doldurulur; çağıranlar (action tanımları) değişmez. Şimdilik bilerek boştur.
 */
export async function publishNotifications(created: readonly NotificationRow[]): Promise<void> {
  void created;
}
