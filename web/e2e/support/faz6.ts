import { randomUUID } from "node:crypto";

import { withDb } from "./db";

export type SeedPaidDemoOrder = {
  eventName: string;
  tableLabel: string;
  seats: number;
  pnr: string;
  buyer: { firstName: string; lastName: string; email: string };
};

const UNIT_PRICE_CENTS = 150000;

/** Soyadı karşılaştırma anahtarı (ASCII büyük harf); e2e alıcıları Türkçe harf içermez. */
function lastNameKey(value: string): string {
  return value.toLocaleUpperCase("tr").replace(/[^A-Z]/g, "");
}

function money(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/**
 * Masayı online tahsise alır, eksik sandalye yuvalarını ekler ve ödenmiş bir DEMO sipariş ile `seats` adet `issued`
 * bilet yazar. Satış arayüzü/API yerine ham SQL kullanılır (e2e sunucusunda satış sırrı tanımsızdır).
 */
export async function seedPaidDemoOrder(input: SeedPaidDemoOrder): Promise<{ orderId: string }> {
  return withDb(async (pool) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const table = await client.query<{ id: string; event_id: string; capacity: number }>(
        `select t.id, t.event_id, t.capacity
           from event_tables t join events e on e.id = t.event_id
          where e.name = $1 and t.label = $2`,
        [input.eventName, input.tableLabel],
      );
      const row = table.rows[0];
      if (!row) throw new Error(`Masa bulunamadı: ${input.eventName} / ${input.tableLabel}`);
      if (input.seats > row.capacity) throw new Error("Bilet sayısı masa kapasitesini aşıyor");

      await client.query("update event_tables set allocation = 'online' where id = $1", [row.id]);
      for (let seatNo = 1; seatNo <= row.capacity; seatNo += 1) {
        await client.query(
          `insert into table_seat_slots (event_id, table_id, allocation, seat_no)
           values ($1, $2, 'online', $3) on conflict (table_id, seat_no) do nothing`,
          [row.event_id, row.id, seatNo],
        );
      }

      const total = money(UNIT_PRICE_CENTS * input.seats);
      const order = await client.query<{ id: string }>(
        `insert into orders (event_id, status, pnr, client_key, hold_expires_at, total_amount, currency,
                             buyer_first_name, buyer_last_name, buyer_last_name_key, buyer_email,
                             terms_accepted_at, payment_provider, is_demo, paid_at)
         values ($1, 'paid', $2, $3, now() + interval '15 minutes', $4, 'TRY', $5, $6, $7, $8, now(), 'demo', true, now())
         returning id`,
        [
          row.event_id,
          input.pnr,
          randomUUID(),
          total,
          input.buyer.firstName,
          input.buyer.lastName,
          lastNameKey(input.buyer.lastName),
          input.buyer.email,
        ],
      );
      const orderId = order.rows[0]!.id;

      const slots = await client.query<{ id: string }>(
        "select id from table_seat_slots where table_id = $1 order by seat_no limit $2",
        [row.id, input.seats],
      );
      for (const slot of slots.rows) {
        await client.query(
          `insert into tickets (order_id, event_id, table_id, seat_slot_id, status, sale_category, unit_price, qr_token)
           values ($1, $2, $3, $4, 'issued', 'standard', $5, $6)`,
          [orderId, row.event_id, row.id, slot.id, money(UNIT_PRICE_CENTS), `e2e-${randomUUID()}`],
        );
      }
      await client.query("commit");
      return { orderId };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  });
}
