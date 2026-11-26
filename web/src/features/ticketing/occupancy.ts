import { sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";

export type TableOccupancy = { held: number; issued: number };

/**
 * Etkinliğin masa başına doluluğu; yalnızca en az bir etkin bileti olan masalar döner. `held` yalnızca
 * siparişi `pending` ve süresi dolmamış (DB saatiyle) biletleri sayar: süresi dolmuş ama süpürülmemiş tutma
 * okumada boş görünür. Kilit almaz; anlık görüntü okumasıdır, satış kararı için kullanılmaz.
 */
export async function getSeatOccupancy(ex: Db | Tx, eventId: string): Promise<Map<string, TableOccupancy>> {
  // Ham SQL ve tam nitelikli sütunlar: Drizzle'ın alt sorgu öneki tuzağından kaçınmak için.
  const result = await ex.execute<{ table_id: string; held: number; issued: number }>(sql`
    select t.table_id,
           count(*) filter (where t.status = 'held' and o.status = 'pending' and o.hold_expires_at > clock_timestamp())::int as held,
           count(*) filter (where t.status = 'issued')::int as issued
      from tickets t
      join orders o on o.id = t.order_id
     where t.event_id = ${eventId}
       and t.status in ('held', 'issued')
     group by t.table_id
  `);
  const map = new Map<string, TableOccupancy>();
  for (const row of result.rows) {
    if (row.held + row.issued === 0) continue;
    map.set(row.table_id, { held: row.held, issued: row.issued });
  }
  return map;
}
