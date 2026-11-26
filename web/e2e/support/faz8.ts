import { spawnSync } from "node:child_process";
import path from "node:path";

import { E2E_BASE_URL, E2E_DATABASE_URL } from "./constants";
import { withDb } from "./db";

const ROOT = path.resolve(import.meta.dirname, "../..");

export type DoorSeed = {
  eventId: string;
  eventName: string;
  pnr: string;
  buyerFirstName: string;
  buyerLastName: string;
  buyerEmail: string;
  tickets: { ticketId: string; qrPayload: string; tableLabel: string }[];
  reservation: { bookingCode: string; guestName: string; lastName: string; tableLabel: string };
};

/**
 * Tohum betiğini ayrı süreçte çalıştırır. Ortam, `playwright.config.ts`'in web sunucusuna verdiğiyle aynıdır
 * (aynı `BETTER_AUTH_SECRET`/`QR_SIGNING_KEY`); aksi halde QR ve `/masam` imzaları sunucuda doğrulanmaz.
 */
export async function seedDoorEvent(name: string): Promise<DoorSeed> {
  const tsx = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const secret = process.env.E2E_AUTH_SECRET;
  if (!secret) throw new Error("E2E_AUTH_SECRET tanımlı değil");
  const res = spawnSync(process.execPath, [tsx, "e2e/support/faz8-seed.ts", name], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: E2E_BASE_URL,
      PAYMENT_PROVIDER: "demo",
      NODE_ENV: "development",
    },
  });
  if (res.status !== 0) throw new Error(`faz8-seed başarısız (${res.status}): ${res.stderr}`);
  const lines = res.stdout.trim().split(/\r?\n/);
  return JSON.parse(lines[lines.length - 1]!) as DoorSeed;
}

export async function clearFindTableLimits(): Promise<void> {
  await withDb((pool) => pool.query("delete from public_rate_limits where scope like 'find_table_%'"));
}

/** Biletlerin giriş kapıları, oluşturulma sırasıyla (girilmemişse `null`). */
export async function ticketGates(eventId: string): Promise<(number | null)[]> {
  return withDb(async (pool) => {
    const res = await pool.query<{ gate: number | null }>(
      "select check_in_gate as gate from tickets where event_id = $1 order by created_at, id",
      [eventId],
    );
    return res.rows.map((r) => r.gate);
  });
}

export async function expireEvent(eventId: string): Promise<void> {
  await withDb((pool) =>
    pool.query(
      "update events set starts_at = now() - interval '20 hours', ends_at = now() - interval '13 hours' where id = $1",
      [eventId],
    ),
  );
}
