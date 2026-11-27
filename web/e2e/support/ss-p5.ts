import { withDb } from "./db";

export async function demoEventCount(): Promise<number> {
  return withDb(async (pool) => {
    const res = await pool.query<{ n: string }>("select count(*)::text as n from events where is_demo = true");
    return Number(res.rows[0]?.n ?? "0");
  });
}

export async function salesDemoFlag(): Promise<boolean> {
  return withDb(async (pool) => {
    const res = await pool.query<{ sales_demo_enabled: boolean }>(
      "select sales_demo_enabled from system_settings limit 1",
    );
    return res.rows[0]?.sales_demo_enabled ?? false;
  });
}

export async function clearDemo(): Promise<void> {
  await withDb(async (pool) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const evRes = await client.query<{ id: string }>("select id from events where is_demo = true for update");
      const ids = evRes.rows.map((r) => r.id);
      if (ids.length > 0) {
        await client.query(
          "delete from check_in_events where ticket_id in (select id from tickets where event_id = any($1::uuid[])) or reservation_id in (select id from reservations where event_id = any($1::uuid[]))",
          [ids],
        );
        await client.query(
          "delete from payment_attempts where order_id in (select id from orders where event_id = any($1::uuid[]))",
          [ids],
        );
        await client.query("delete from tickets where event_id = any($1::uuid[])", [ids]);
        await client.query("delete from orders where event_id = any($1::uuid[])", [ids]);
        await client.query("delete from reservations where event_id = any($1::uuid[])", [ids]);
        await client.query("delete from event_archives where event_id = any($1::uuid[])", [ids]);
        await client.query("delete from notifications where event_id = any($1::uuid[])", [ids]);
        await client.query("delete from events where id = any($1::uuid[]) and is_demo = true", [ids]);
      }
      await client.query(
        "update artists set is_demo = false where is_demo = true and (exists (select 1 from events e where e.artist_id = artists.id) or exists (select 1 from event_archives a where a.artist_id = artists.id))",
      );
      await client.query("delete from artists where is_demo = true");
      await client.query("update system_settings set sales_demo_enabled = false");
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  });
}
