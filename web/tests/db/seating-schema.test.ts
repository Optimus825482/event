import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Tx } from "@/db/client";
import {
  eventSaleSettings,
  eventSeatPrices,
  eventTables,
  notifications,
  reservations,
  tableSeatSlots,
  userPermissions,
} from "@/db/schema";
import { pgConstraintOf } from "@/lib/pg-error";
import {
  createBookingParents,
  createCustomer,
  createEvent,
  createReservation,
  createTable,
  createUser,
  pgErrorCode,
} from "../helpers/factories";
import { inRollback } from "./isolation";

/**
 * İşlemi bir kayıt noktası içinde çalıştırır; verilen SQLSTATE ile (ve verildiyse o kısıt adıyla)
 * reddedildiğini doğrular.
 */
async function expectPgError(
  tx: Tx,
  code: string,
  op: (sp: Tx) => Promise<unknown>,
  constraint?: string,
): Promise<void> {
  let caught: unknown;
  try {
    await tx.transaction(async (sp) => {
      await op(sp);
    });
  } catch (err) {
    caught = err;
  }
  expect(caught, `beklenen hata ${code} fırlatılmadı`).toBeDefined();
  expect(pgErrorCode(caught)).toBe(code);
  if (constraint) expect(pgConstraintOf(caught)).toBe(constraint);
}

const SELLABLE = "event_tables_sellable_within_capacity";
const CASINO_FK = "reservations_casino_table_fk";
const SLOT_FK = "table_seat_slots_online_table_fk";

describe("şema: masa kategorisi ve tahsis", () => {
  it("masa varsayılanları: standard, satılabilir null, pending", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const [row] = await tx.insert(eventTables).values({ eventId: event.id, label: "A1", capacity: 8 }).returning();
      expect(row).toMatchObject({ saleCategory: "standard", sellableSeats: null, allocation: "pending" });
    });
  });

  it("satılabilir sandalye kapasiteyi aşamaz", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      await expectPgError(tx, "23514", (sp) => createTable(sp, event.id, { capacity: 8, sellableSeats: 9 }), SELLABLE);
      await expectPgError(tx, "23514", (sp) => createTable(sp, event.id, { capacity: 8, sellableSeats: 0 }), SELLABLE);
      expect((await createTable(tx, event.id, { capacity: 8, sellableSeats: 8 })).sellableSeats).toBe(8);
      expect((await createTable(tx, event.id, { capacity: 8, sellableSeats: null })).sellableSeats).toBeNull();
    });
  });

  it("kategori ve tahsis yalnızca sözlük değerlerini alır", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      await expectPgError(
        tx,
        "23514",
        (sp) =>
          sp.execute(
            sql`insert into event_tables (event_id, label, capacity, sale_category) values (${event.id}, 'X1', 8, 'gold')`,
          ),
        "event_tables_sale_category_valid",
      );
      await expectPgError(
        tx,
        "23514",
        (sp) =>
          sp.execute(
            sql`insert into event_tables (event_id, label, capacity, allocation) values (${event.id}, 'X2', 8, 'sold')`,
          ),
        "event_tables_allocation_valid",
      );
    });
  });
});

describe("şema: Casino rezervasyonu tahsisli masaya bağlıdır", () => {
  it("etkin rezervasyon yalnızca casino masada olabilir", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const customer = await createCustomer(tx);
      const table = await createTable(tx, event.id, { allocation: "pending" });
      const base = { eventId: event.id, tableId: table.id, customerId: customer.id };
      await expectPgError(tx, "23503", (sp) => createReservation(sp, { ...base, status: "confirmed" }), CASINO_FK);
      const cancelled = await createReservation(tx, { ...base, status: "cancelled" });
      expect(cancelled.status).toBe("cancelled");
    });
  });

  it("pending masadaki iptal rezervasyon etkinleştirilemez", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const customer = await createCustomer(tx);
      const table = await createTable(tx, event.id, { allocation: "pending" });
      const r = await createReservation(tx, {
        eventId: event.id,
        tableId: table.id,
        customerId: customer.id,
        status: "cancelled",
      });
      await expectPgError(
        tx,
        "23503",
        (sp) => sp.update(reservations).set({ status: "confirmed" }).where(eq(reservations.id, r.id)),
        CASINO_FK,
      );
    });
  });

  it("etkin rezervasyonlu masa casino'dan çıkamaz; iptalden sonra çıkar", async () => {
    await inRollback(async (tx) => {
      const { event, table, customer } = await createBookingParents(tx);
      const r = await createReservation(tx, { eventId: event.id, tableId: table.id, customerId: customer.id });
      await expectPgError(
        tx,
        "23503",
        (sp) => sp.update(eventTables).set({ allocation: "pending" }).where(eq(eventTables.id, table.id)),
        CASINO_FK,
      );
      await tx.update(reservations).set({ status: "cancelled" }).where(eq(reservations.id, r.id));
      const [moved] = await tx
        .update(eventTables)
        .set({ allocation: "pending" })
        .where(eq(eventTables.id, table.id))
        .returning();
      expect(moved?.allocation).toBe("pending");
    });
  });

  it("allocation_lock üretilmiş sütundur", async () => {
    await inRollback(async (tx) => {
      const { event, table, customer } = await createBookingParents(tx);
      const base = { eventId: event.id, tableId: table.id, customerId: customer.id };
      const confirmed = await createReservation(tx, { ...base, status: "confirmed" });
      const cancelled = await createReservation(tx, { ...base, status: "cancelled" });
      const noShow = await createReservation(tx, { ...base, status: "no_show" });
      expect(confirmed.allocationLock).toBe("casino");
      expect(cancelled.allocationLock).toBeNull();
      expect(noShow.allocationLock).toBeNull();
      await expectPgError(tx, "428C9", (sp) =>
        sp.execute(sql`update reservations set allocation_lock = 'casino' where id = ${cancelled.id}`),
      );
    });
  });

  it("booking_code kendiliğinden üretilir ve tekildir", async () => {
    await inRollback(async (tx) => {
      const { event, table, customer } = await createBookingParents(tx);
      const first = await createReservation(tx, { eventId: event.id, tableId: table.id, customerId: customer.id });
      expect(first.bookingCode).toMatch(/^R[2-9A-HJ-NP-Z]{6}$/);
      const other = await createTable(tx, event.id);
      await expectPgError(
        tx,
        "23505",
        (sp) =>
          createReservation(sp, {
            eventId: event.id,
            tableId: other.id,
            customerId: customer.id,
            bookingCode: first.bookingCode,
          }),
        "reservations_booking_code_uq",
      );
    });
  });
});

describe("şema: sandalye yuvaları", () => {
  it("yuva yalnızca online masada bulunur", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const casino = await createTable(tx, event.id, { allocation: "casino" });
      const online = await createTable(tx, event.id, { allocation: "online" });
      await expectPgError(
        tx,
        "23503",
        (sp) => sp.insert(tableSeatSlots).values({ eventId: event.id, tableId: casino.id, seatNo: 1 }),
        SLOT_FK,
      );
      await expectPgError(
        tx,
        "23514",
        (sp) =>
          sp.execute(
            sql`insert into table_seat_slots (event_id, table_id, allocation, seat_no) values (${event.id}, ${online.id}, 'casino', 1)`,
          ),
        "table_seat_slots_allocation_online",
      );
      await expectPgError(
        tx,
        "23514",
        (sp) => sp.insert(tableSeatSlots).values({ eventId: event.id, tableId: online.id, seatNo: 0 }),
        "table_seat_slots_seat_no_positive",
      );
      const [slot] = await tx
        .insert(tableSeatSlots)
        .values({ eventId: event.id, tableId: online.id, seatNo: 1 })
        .returning();
      expect(slot?.allocation).toBe("online");
    });
  });

  it("yuvası olan masa online'dan çıkamaz; yuvalar silinince çıkar", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const table = await createTable(tx, event.id, { allocation: "online" });
      await tx.insert(tableSeatSlots).values({ eventId: event.id, tableId: table.id, seatNo: 1 });
      await expectPgError(
        tx,
        "23503",
        (sp) => sp.update(eventTables).set({ allocation: "pending" }).where(eq(eventTables.id, table.id)),
        SLOT_FK,
      );
      await tx.delete(tableSeatSlots).where(eq(tableSeatSlots.tableId, table.id));
      const [moved] = await tx
        .update(eventTables)
        .set({ allocation: "pending" })
        .where(eq(eventTables.id, table.id))
        .returning();
      expect(moved?.allocation).toBe("pending");
    });
  });

  it("masa silinince yuvaları da silinir; aynı masada sıra numarası tekildir", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const table = await createTable(tx, event.id, { allocation: "online" });
      await tx.insert(tableSeatSlots).values([
        { eventId: event.id, tableId: table.id, seatNo: 1 },
        { eventId: event.id, tableId: table.id, seatNo: 2 },
      ]);
      await expectPgError(
        tx,
        "23505",
        (sp) => sp.insert(tableSeatSlots).values({ eventId: event.id, tableId: table.id, seatNo: 2 }),
        "table_seat_slots_table_seat_uq",
      );
      await tx.delete(eventTables).where(eq(eventTables.id, table.id));
      const left = await tx.select().from(tableSeatSlots).where(eq(tableSeatSlots.tableId, table.id));
      expect(left).toHaveLength(0);
    });
  });
});

describe("şema: satış ayarları ve fiyatlar", () => {
  it("satış ayarı varsayılanları ve aralıkları", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const [row] = await tx.insert(eventSaleSettings).values({ eventId: event.id }).returning();
      expect(row).toMatchObject({
        sharedTables: true,
        blockSingleLeftover: true,
        locaOnline: false,
        holdMinutes: 10,
        maxSeatsPerOrder: 12,
        currency: "TRY",
        saleStartsAt: null,
        saleEndsAt: null,
      });

      const other = await createEvent(tx);
      const insert = (v: Partial<typeof eventSaleSettings.$inferInsert>) => (sp: Tx) =>
        sp.insert(eventSaleSettings).values({ eventId: other.id, ...v });
      await expectPgError(tx, "23514", insert({ holdMinutes: 4 }), "event_sale_settings_hold_minutes_range");
      await expectPgError(tx, "23514", insert({ holdMinutes: 31 }), "event_sale_settings_hold_minutes_range");
      await expectPgError(tx, "23514", insert({ maxSeatsPerOrder: 0 }), "event_sale_settings_max_seats_range");
      await expectPgError(tx, "23514", insert({ maxSeatsPerOrder: 51 }), "event_sale_settings_max_seats_range");
      const at = new Date("2027-01-01T10:00:00Z");
      await expectPgError(
        tx,
        "23514",
        insert({ saleStartsAt: at, saleEndsAt: at }),
        "event_sale_settings_window_valid",
      );
      await expectPgError(tx, "23505", (sp) => sp.insert(eventSaleSettings).values({ eventId: event.id }));
    });
  });

  it("fiyat satırı kuralları", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const [row] = await tx.insert(eventSeatPrices).values({ eventId: event.id, category: "standard" }).returning();
      expect(row).toMatchObject({ coefficient: "1.000", finalPrice: null, recommendedPrice: null });

      await expectPgError(
        tx,
        "23514",
        (sp) => sp.execute(sql`insert into event_seat_prices (event_id, category) values (${event.id}, 'gold')`),
        "event_seat_prices_category_valid",
      );
      await expectPgError(
        tx,
        "23514",
        (sp) => sp.insert(eventSeatPrices).values({ eventId: event.id, category: "vip", finalPrice: "0" }),
        "event_seat_prices_final_positive",
      );
      await expectPgError(
        tx,
        "23514",
        (sp) => sp.insert(eventSeatPrices).values({ eventId: event.id, category: "vip", recommendedPrice: "-1" }),
        "event_seat_prices_recommended_non_negative",
      );
      await expectPgError(
        tx,
        "23514",
        (sp) => sp.insert(eventSeatPrices).values({ eventId: event.id, category: "vip", coefficient: "0" }),
        "event_seat_prices_coefficient_positive",
      );
      await expectPgError(tx, "23505", (sp) =>
        sp.insert(eventSeatPrices).values({ eventId: event.id, category: "standard" }),
      );
    });
  });
});

describe("şema: enum eklemeleri", () => {
  it("yeni enum değerleri veritabanındadır", async () => {
    await inRollback(async (tx) => {
      const [n] = await tx
        .insert(notifications)
        .values({ type: "casino_tables_released", title: "Masalar bırakıldı", message: "Deneme" })
        .returning();
      expect(n?.type).toBe("casino_tables_released");

      const user = await createUser(tx);
      const rows = await tx
        .insert(userPermissions)
        .values((["ticketing", "finance", "archive"] as const).map((module) => ({ userId: user.id, module })))
        .returning();
      expect(rows.map((r) => r.module).sort()).toEqual(["archive", "finance", "ticketing"]);
    });
  });
});
