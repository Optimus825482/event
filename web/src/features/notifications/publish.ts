import { db } from "@/db/client";
import { publish } from "@/features/realtime/publish";
import { logError } from "@/lib/log";
import type { NotificationRow } from "./service";

/**
 * Gerçek zamanlı yayın bağlantı noktası (tek yer). Bildirim satırları transaction tamamlandıktan
 * sonra verilir; her biri için hedef kitleye yönelik `notification.created` olayı yayılır
 * (yük yalnızca kimlik taşır). İstemci bildirim sorgusunu yetki denetimli olarak yeniden çeker.
 *
 * Yayın hatası kullanıcının eylemini bozmaz: günlüğe yazılır ve yutulur.
 */
export async function publishNotifications(created: readonly NotificationRow[]): Promise<void> {
  for (const row of created) {
    try {
      await publish(db, { type: "notification.created", audience: row.audience, id: row.id });
    } catch (error) {
      logError("notifications.publish", error);
    }
  }
}
