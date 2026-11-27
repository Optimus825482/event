import { sql, type SQL } from "drizzle-orm";
import { orders, tickets } from "@/db/schema";

/**
 * Bilet durumu; süresi dolmuş tutma (`held` + bekleyen sipariş + `holdExpiresAt` geçmiş), süpürülmemiş olsa da
 * `expired` okunur (DB saatiyle). `tickets` ve `orders` sorguda birleştirilmiş olmalı.
 */
export function ticketStatusSql(): SQL<"held" | "issued" | "expired"> {
  return sql<"held" | "issued" | "expired">`case when ${tickets.status} = 'held' and ${orders.status} = 'pending' and ${orders.holdExpiresAt} <= clock_timestamp() then 'expired' else ${tickets.status} end`;
}

/**
 * Alıcının tam adı; `joinFullName` ile aynı kural (kırp, boşları at, tek boşlukla birleştir). İkisi de boşsa `null`.
 * `orders` sorguda birleştirilmiş olmalı.
 */
export function buyerFullNameSql(): SQL<string | null> {
  return sql<string | null>`nullif(concat_ws(' ', nullif(trim(${orders.buyerFirstName}), ''), nullif(trim(${orders.buyerLastName}), '')), '')`;
}
