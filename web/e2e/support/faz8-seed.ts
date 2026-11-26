/**
 * Faz 8 E2E tohumu: `tsx` ile ayrı süreçte çalışır (bkz. `faz8.ts`), JSON'u standart çıktının son satırına yazar.
 * Ortam (DATABASE_URL, BETTER_AUTH_SECRET, QR_SIGNING_KEY, PAYMENT_PROVIDER) web sunucusununkiyle aynıdır.
 * Kullanım: tsx e2e/support/faz8-seed.ts <etkinlik-adı>
 */
import { eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { events, reservations } from "@/db/schema";
import { createReservation } from "@/features/reservations/service";
import { managerActor, persistActor } from "../../tests/helpers/actors";
import { ticketedEvent } from "../../tests/helpers/door";
import { createCustomer, createTable } from "../../tests/helpers/factories";

async function main(): Promise<void> {
  const name = process.argv[2];
  if (!name) throw new Error("etkinlik adı gerekli");
  const te = await ticketedEvent();
  await db.update(events).set({ name }).where(eq(events.id, te.event.id));

  // Aynı etkinlikte Casino'ya tahsisli C1 masası ve "Zeynep Kaya" adına rezervasyon.
  const organizer = await persistActor(db, managerActor("casino"));
  const table = await createTable(db, te.event.id, { label: "C1", capacity: 4, allocation: "casino" });
  const customer = await createCustomer(db, { fullName: "Zeynep Kaya" });
  const created = await createReservation(db, organizer, {
    eventId: te.event.id,
    tableId: table.id,
    guestCount: 2,
    customerId: customer.id,
  });
  const [row] = await db.select().from(reservations).where(eq(reservations.id, created.id));
  if (!row) throw new Error("rezervasyon okunamadı");

  const out = {
    eventId: te.event.id,
    eventName: name,
    pnr: te.order.pnr!,
    buyerFirstName: te.buyer.firstName,
    buyerLastName: te.buyer.lastName,
    buyerEmail: te.buyer.email,
    tickets: te.tickets.map((t) => ({ ticketId: t.ticketId, qrPayload: t.qrPayload, tableLabel: t.tableLabel })),
    reservation: { bookingCode: row.bookingCode, guestName: "Zeynep Kaya", lastName: "Kaya", tableLabel: "C1" },
  };
  console.log(JSON.stringify(out));
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
