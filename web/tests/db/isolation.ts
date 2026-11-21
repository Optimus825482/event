import { sql } from "drizzle-orm";
import { db, type Tx } from "@/db/client";

class Rollback extends Error {}

/**
 * Test gövdesini geri alınan bir transaction içinde çalıştırır.
 *
 * Vitest test dosyalarını paralel çalıştırır; başka dosyalar `truncateAll()` ile
 * tüm tabloları boşaltabilir. İlk iş olarak tüm public tablolar ROW EXCLUSIVE
 * kipinde kilitlenir: TRUNCATE (ACCESS EXCLUSIVE) bu transaction bitene kadar
 * bekler, böylece ebeveyn satırlar test ortasında silinmez ve test sonunda
 * hiçbir satır kalıcı olmaz. Kilitler tek komutta alındığı için TRUNCATE ile
 * kilitlenme (deadlock) penceresi pratikte yoktur.
 */
export async function inRollback(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const res = await tx.execute<{ name: string }>(
        sql`select quote_ident(schemaname) || '.' || quote_ident(tablename) as name from pg_tables where schemaname = 'public'`,
      );
      const names = res.rows.map((r) => r.name).join(", ");
      if (names) await tx.execute(sql.raw(`lock table ${names} in row exclusive mode`));
      await fn(tx);
      throw new Rollback();
    });
  } catch (err) {
    if (err instanceof Rollback) return;
    throw err;
  }
}
