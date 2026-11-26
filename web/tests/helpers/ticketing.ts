import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { createHold, payOrder, type HoldItem, type OrderView } from "@/features/ticketing/orders-service";

/** Bekleyen bir tutma yaratır; `clientKey` verilmezse rastgele üretilir. */
export async function createPendingHold(
  db: Db,
  input: { eventId: string; items: HoldItem[]; clientKey?: string },
): Promise<OrderView> {
  return createHold(db, { eventId: input.eventId, items: input.items, clientKey: input.clientKey ?? randomUUID() });
}

/** Tutmanın süresini geçmişe çeker; satır `pending` kalır (süpürmez). Yalnızca test kurulumu içindir. */
export async function expireOrder(ex: Pick<Db, "execute">, orderId: string): Promise<void> {
  await ex.execute(
    sql`update orders set hold_expires_at = clock_timestamp() - interval '1 second' where id = ${orderId}`,
  );
}

/** Tutup demo sağlayıcıyla onaylanmış ödenmiş sipariş; varsayılan alıcı Ayşe Yılmaz. */
export async function createPaidOrder(
  db: Db,
  input: {
    eventId: string;
    items: HoldItem[];
    buyer?: { firstName: string; lastName: string; email: string; phone?: string };
  },
): Promise<OrderView> {
  const hold = await createPendingHold(db, { eventId: input.eventId, items: input.items });
  return payOrder(db, hold.orderId, {
    buyer: input.buyer ?? { firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.com" },
    acceptTerms: true,
    payment: { provider: "demo", action: "approve" },
  });
}
