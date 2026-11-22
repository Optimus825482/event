import { Pool } from "pg";

import { E2E_DATABASE_URL } from "./constants";

/** Testlerin doğrudan okuma/yazma yaptığı e2e veritabanı (yalnızca `eventflow_e2e`). */
export async function withDb<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: E2E_DATABASE_URL, max: 1, options: "-c timezone=UTC" });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

/** Misafir adına göre rezervasyonun QR belirtecini DB'den okur (detay sayfası belirteci metin olarak göstermez). */
export async function qrTokenFor(guestName: string): Promise<string> {
  return withDb(async (pool) => {
    const res = await pool.query<{ qr_token: string }>("select qr_token from reservations where guest_name = $1", [guestName]);
    const row = res.rows[0];
    if (!row) throw new Error(`Rezervasyon bulunamadı: ${guestName}`);
    return row.qr_token;
  });
}

export async function reservationCount(eventName: string): Promise<number> {
  return withDb(async (pool) => {
    const res = await pool.query<{ n: string }>(
      "select count(*)::text as n from reservations r join events e on e.id = r.event_id where e.name = $1",
      [eventName],
    );
    return Number(res.rows[0]?.n ?? "0");
  });
}

export type ReservationInfo = { id: string; status: string; guestCount: number };

/** Misafir adına göre rezervasyonlar (aynı ad birden fazla satır dönerse sayı testte denetlenir). */
export async function reservationsByGuest(guestName: string): Promise<ReservationInfo[]> {
  return withDb(async (pool) => {
    const res = await pool.query<{ id: string; status: string; guest_count: number }>(
      "select id, status, guest_count from reservations where guest_name = $1 order by created_at",
      [guestName],
    );
    return res.rows.map((r) => ({ id: r.id, status: r.status, guestCount: r.guest_count }));
  });
}

/** Bir rezervasyona bağlı `check_in_events` satırlarının anahtarları (tek check-in = tek satır). */
export async function checkInKeys(reservationId: string): Promise<string[]> {
  return withDb(async (pool) => {
    const res = await pool.query<{ idempotency_key: string }>(
      "select idempotency_key from check_in_events where reservation_id = $1 order by created_at",
      [reservationId],
    );
    return res.rows.map((r) => r.idempotency_key);
  });
}

export async function checkedInCount(eventName: string): Promise<number> {
  return withDb(async (pool) => {
    const res = await pool.query<{ n: string }>(
      "select count(*)::text as n from reservations r join events e on e.id = r.event_id where e.name = $1 and r.status = 'checked_in'",
      [eventName],
    );
    return Number(res.rows[0]?.n ?? "0");
  });
}
