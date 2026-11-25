import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventTables, venueTemplates } from "@/db/schema";
import { applyVenueTemplate, saveLayout } from "@/features/venue/service";
import { DomainError } from "@/lib/action";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

const decor = { width: 1200, height: 800, elements: [] };

async function setup() {
  const actor = await persistActor(db, managerActor("entertainment"));
  const event = await f.createEvent(db, { organizerId: actor.id });
  const big = await f.createTable(db, event.id, { label: "A1", capacity: 8, x: 0, y: 0 });
  const other = await f.createTable(db, event.id, { label: "A2", capacity: 6, x: 60, y: 0 });
  const customer = await f.createCustomer(db);
  return { actor, event, big, other, customer };
}

async function caught(promise: Promise<unknown>): Promise<DomainError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  return err as DomainError;
}

const asInput = (t: { id: string; label: string; capacity: number; x: number; y: number }) => ({
  id: t.id,
  label: t.label,
  capacity: t.capacity,
  x: t.x,
  y: t.y,
});

async function capacities(eventId: string) {
  const rows = await db.select().from(eventTables).where(eq(eventTables.eventId, eventId));
  return Object.fromEntries(rows.map((r) => [r.label, r.capacity]));
}

describe("yerleşim kaydı: kapasite küçültme koruması", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it.each(["pending", "confirmed", "checked_in"] as const)(
    "%s rezervasyonun kişi sayısının altına inmek conflict verir ve hiçbir şey yazılmaz",
    async (status) => {
      const { actor, event, big, other, customer } = await setup();
      await f.createReservation(db, { eventId: event.id, tableId: big.id, customerId: customer.id, guestCount: 6, status });
      const err = await caught(
        saveLayout(db, actor, {
          eventId: event.id,
          tables: [asInput({ ...big, capacity: 5 }), asInput({ ...other, capacity: 2, label: "A2" })],
          decor,
        }),
      );
      expect(err.code).toBe("conflict");
      expect(err.message).toContain('"A1"');
      expect(err.message).not.toContain('"A2"');
      expect(await capacities(event.id)).toEqual({ A1: 8, A2: 6 });
    },
  );

  it("birden çok masa varsa hepsinin etiketini listeler", async () => {
    const { actor, event, big, other, customer } = await setup();
    await f.createReservation(db, { eventId: event.id, tableId: big.id, customerId: customer.id, guestCount: 7 });
    const second = await f.createCustomer(db);
    await f.createReservation(db, { eventId: event.id, tableId: other.id, customerId: second.id, guestCount: 6 });
    const err = await caught(
      saveLayout(db, actor, {
        eventId: event.id,
        tables: [asInput({ ...big, capacity: 4 }), asInput({ ...other, capacity: 4 })],
        decor,
      }),
    );
    expect(err.message).toContain('"A1"');
    expect(err.message).toContain('"A2"');
  });

  it("iptal / gelmedi rezervasyon küçültmeyi engellemez; tam eşitlik de serbesttir", async () => {
    const { actor, event, big, other, customer } = await setup();
    await f.createReservation(db, { eventId: event.id, tableId: big.id, customerId: customer.id, guestCount: 6, status: "cancelled" });
    const second = await f.createCustomer(db);
    await f.createReservation(db, { eventId: event.id, tableId: other.id, customerId: second.id, guestCount: 6 });
    await saveLayout(db, actor, {
      eventId: event.id,
      tables: [asInput({ ...big, capacity: 2 }), asInput({ ...other, capacity: 6 })],
      decor,
    });
    expect(await capacities(event.id)).toEqual({ A1: 2, A2: 6 });
  });

  it("kapasiteyi artırmak her zaman serbesttir", async () => {
    const { actor, event, big, other, customer } = await setup();
    await f.createReservation(db, { eventId: event.id, tableId: big.id, customerId: customer.id, guestCount: 8 });
    await saveLayout(db, actor, {
      eventId: event.id,
      tables: [asInput({ ...big, capacity: 10 }), asInput(other)],
      decor,
    });
    expect(await capacities(event.id)).toEqual({ A1: 10, A2: 6 });
  });

  it("applyVenueTemplate rezervasyonlu masayı kapasitesiyle korur (küçültme yolu yok)", async () => {
    const { actor, event, big, customer } = await setup();
    await f.createReservation(db, { eventId: event.id, tableId: big.id, customerId: customer.id, guestCount: 8 });
    const [template] = await db
      .insert(venueTemplates)
      .values({
        name: "Küçük",
        isPublic: true,
        createdById: actor.id,
        layoutData: {
          version: 1,
          tables: [{ label: "A1", capacity: 2, tableTypeId: null, x: 5, y: 5, rotation: 0, isLoca: false }],
          decor,
        },
      })
      .returning();
    if (!template) throw new Error("şablon yok");
    const res = await applyVenueTemplate(db, actor, { eventId: event.id, templateId: template.id });
    expect(res.keptLabels).toEqual(["A1"]);
    expect((await capacities(event.id)).A1).toBe(8);
  });
});
