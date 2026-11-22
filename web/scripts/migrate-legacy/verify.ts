import type pg from "pg";
import { decorSchema } from "@/features/venue/schemas";
import { ACTIVE_RESERVATION_STATUSES } from "@/domain/reservation-status";
import type { VerificationResult } from "./report";
import { countRows } from "./target";

/**
 * Yükleme sonrası doğrulama (aynı işlem içinde, COMMIT'ten önce). Herhangi biri başarısızsa
 * çağıran işlemi geri alır.
 */

export type Expectations = {
  /** Yazıcının tablo başına eklediği satır sayısı. */
  written: Record<string, number>;
  /** Eski kaynaktan türetilen beklenen hedef sayıları (uzlaştırma). */
  reconcile: Record<string, number>;
  /** Eski `qrCodeHash` dolu satır sayısı. */
  legacyQrHashes: number;
  makeQrToken: (reservationId: string) => string;
};

async function scalar(client: pg.Client, query: string, params: unknown[] = []): Promise<number> {
  const res = await client.query<{ n: string }>(query, params);
  return Number(res.rows[0]?.n ?? 0);
}

export async function verifyTarget(client: pg.Client, exp: Expectations): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  const check = (name: string, ok: boolean, detail: string) => results.push({ name, ok, detail });
  const counts = await countRows(client);

  const writtenMismatch = Object.entries(exp.written).filter(([t, n]) => (counts[t] ?? -1) !== n);
  check(
    "yazılan satır = tablodaki satır",
    writtenMismatch.length === 0,
    writtenMismatch.length === 0 ? `${Object.keys(exp.written).length} tablo` : writtenMismatch.map(([t, n]) => `${t}: yazılan ${n}, tabloda ${counts[t] ?? 0}`).join("; "),
  );
  for (const [table, expected] of Object.entries(exp.reconcile)) {
    const actual = counts[table] ?? 0;
    check(`uzlaştırma: ${table}`, actual === expected, `beklenen ${expected}, hedefte ${actual}`);
  }

  const noTable = await scalar(
    client,
    `SELECT count(*)::text AS n FROM reservations r LEFT JOIN event_tables t ON t.event_id = r.event_id AND t.id = r.table_id WHERE t.id IS NULL`,
  );
  check("her rezervasyonun masası var", noTable === 0, `${noTable} masasız`);
  const noCustomer = await scalar(client, `SELECT count(*)::text AS n FROM reservations r LEFT JOIN customers c ON c.id = r.customer_id WHERE c.id IS NULL`);
  check("her rezervasyonun müşterisi var", noCustomer === 0, `${noCustomer} müşterisiz`);
  const active = ACTIVE_RESERVATION_STATUSES.map((s) => `'${s}'`).join(", ");
  const dupes = await scalar(
    client,
    `SELECT count(*)::text AS n FROM (SELECT 1 FROM reservations WHERE status IN (${active}) GROUP BY event_id, table_id HAVING count(*) > 1) d`,
  );
  check("masada birden çok aktif rezervasyon yok", dupes === 0, `${dupes} çakışan masa`);
  const noAccount = await scalar(
    client,
    `SELECT count(*)::text AS n FROM users u WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id AND a.provider_id = 'credential' AND a.account_id = u.id::text AND a.password IS NOT NULL)`,
  );
  check("her kullanıcının parola hesabı var", noAccount === 0, `${noAccount} hesapsız kullanıcı`);
  const hashes = await scalar(client, "SELECT count(legacy_qr_hash)::text AS n FROM reservations");
  check("eski QR özetleri korundu", hashes === exp.legacyQrHashes, `beklenen ${exp.legacyQrHashes}, hedefte ${hashes}`);

  const tokens = await client.query<{ id: string; qr_token: string }>("SELECT id, qr_token FROM reservations");
  const badTokens = tokens.rows.filter((r) => exp.makeQrToken(r.id) !== r.qr_token).length;
  check("QR belirteçleri rezervasyon kimliğiyle imzalı", badTokens === 0, `${badTokens} hatalı belirteç`);

  const decors = await client.query<{ id: string; layout_decor: unknown }>("SELECT id, layout_decor FROM events WHERE layout_decor IS NOT NULL");
  const badDecor = decors.rows.filter((r) => !decorSchema.safeParse(r.layout_decor).success).length;
  check("layout_decor decorSchema'ya uyuyor", badDecor === 0, `${badDecor} geçersiz`);

  const orphanLinks = await scalar(
    client,
    "SELECT count(*)::text AS n FROM users u LEFT JOIN staff s ON s.id = u.staff_id WHERE u.staff_id IS NOT NULL AND s.id IS NULL",
  );
  check("kullanıcı → personel bağları geçerli", orphanLinks === 0, `${orphanLinks} geçersiz bağ`);

  const ends = await scalar(client, "SELECT count(*)::text AS n FROM events WHERE ends_at IS NOT NULL AND ends_at <= starts_at");
  check("etkinlik bitişi başlangıçtan sonra", ends === 0, `${ends} ihlal`);

  // Varsayılanlar: her `id` sütunu gen_random_uuid() üretir; sahipli diziler en büyük değerin ilerisinde.
  const noDefault = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'id' AND data_type = 'uuid'
        AND coalesce(column_default, '') NOT LIKE '%gen_random_uuid()%'`,
  );
  check("id varsayılanları gen_random_uuid()", noDefault.rows.length === 0, noDefault.rows.map((r) => r.table_name).join(", ") || "tamam");
  const seqs = await client.query<{ seq: string; tbl: string; col: string }>(
    `SELECT s.relname AS seq, t.relname AS tbl, a.attname AS col
       FROM pg_class s JOIN pg_depend d ON d.objid = s.oid AND d.deptype IN ('a', 'i')
       JOIN pg_class t ON t.oid = d.refobjid JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
       JOIN pg_namespace n ON n.oid = s.relnamespace
      WHERE s.relkind = 'S' AND n.nspname = 'public'`,
  );
  const behind: string[] = [];
  for (const s of seqs.rows) {
    const max = await scalar(client, `SELECT coalesce(max("${s.col}"), 0)::text AS n FROM public."${s.tbl}"`);
    const last = await scalar(client, `SELECT (CASE WHEN is_called THEN last_value ELSE last_value - 1 END)::text AS n FROM public."${s.seq}"`);
    if (last < max) behind.push(`${s.seq} (${last} < ${max})`);
  }
  check("diziler en büyük değerin ilerisinde", behind.length === 0, behind.join(", ") || `${seqs.rows.length} dizi`);
  return results;
}
