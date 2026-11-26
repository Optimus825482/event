/**
 * Eski sistemin üç özellik testinin taşınmış hâli (frontend/src/__tests__/check-in/*.property.test.ts).
 * Eski testler kendi içlerinde tanımlı saf işlevleri sınıyordu; burada aynı özellikler gerçek kodla
 * (Zod şemaları, saf istatistik işlevi ve gerçek veritabanı üzerindeki servisler) sınanır.
 * Bilinçli fark: eski "kapasite aşımı onayla geçer" (Property 13.3) spec §13 madde 4 gereği tersine çevrildi.
 */
import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { RESERVATION_STATUSES } from "@/domain/reservation-status";
import { walkInInput } from "@/features/check-in/schemas";
import { eventStats, registerWalkIn, updateGuestCount } from "@/features/check-in/service";
import { guestCountProblem, toEventStats } from "@/features/check-in/stats";
import { setupTestDb } from "../../helpers/db";
import { createCustomer, createEvent, createReservation, createTable } from "../../helpers/factories";
import { actorOf, bookedGuest, expectDomain, reservationRow } from "./fixtures";
import { adminActor, memberActor } from "../../helpers/actors";

const statusArb = fc.constantFrom(...RESERVATION_STATUSES);

beforeAll(async () => {
  await setupTestDb();
});

describe("Property 8: Etkinlik istatistikleri", () => {
  it("saf hesap: kalan = beklenen − giriş, yüzde [0,100], hepsi negatif değil", () => {
    const n = fc.nat({ max: 500 });
    fc.assert(
      fc.property(
        fc.record({
          pending: n,
          confirmed: n,
          checkedIn: n,
          cancelled: n,
          noShow: n,
        }),
        (c) => {
          const s = toEventStats({
            ...c,
            expectedGuests: 0,
            checkedInGuests: 0,
          });
          expect(s.totalExpected).toBe(c.pending + c.confirmed + c.checkedIn);
          expect(s.remaining).toBe(s.totalExpected - s.checkedIn);
          expect(s.checkInPercentage).toBe(s.totalExpected > 0 ? Math.round((c.checkedIn / s.totalExpected) * 100) : 0);
          expect(s.checkInPercentage).toBeGreaterThanOrEqual(0);
          expect(s.checkInPercentage).toBeLessThanOrEqual(100);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("veritabanı: rastgele rezervasyon kümesinde eventStats durum sayılarına ve kişi toplamlarına eşittir", async () => {
    const door = await actorOf(adminActor());
    const customer = await createCustomer(db);
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            status: statusArb,
            guestCount: fc.integer({ min: 1, max: 20 }),
          }),
          { maxLength: 25 },
        ),
        async (rows) => {
          const event = await createEvent(db, { status: "active" });
          for (const row of rows) {
            const table = await createTable(db, event.id, { capacity: 20 });
            await createReservation(db, {
              eventId: event.id,
              tableId: table.id,
              customerId: customer.id,
              ...row,
            });
          }
          const count = (status: string) => rows.filter((r) => r.status === status).length;
          const active = rows.filter(
            (r) => r.status === "pending" || r.status === "confirmed" || r.status === "checked_in",
          );
          const stats = await eventStats(db, door, event.id);
          expect(stats.totalExpected).toBe(active.length);
          expect(stats.checkedIn).toBe(count("checked_in"));
          expect(stats.remaining).toBe(count("pending") + count("confirmed"));
          expect(stats.cancelled).toBe(count("cancelled"));
          expect(stats.noShow).toBe(count("no_show"));
          expect(stats.expectedGuests).toBe(active.reduce((sum, r) => sum + r.guestCount, 0));
          expect(stats.checkedInGuests).toBe(
            rows.filter((r) => r.status === "checked_in").reduce((sum, r) => sum + r.guestCount, 0),
          );
        },
      ),
      { numRuns: 15 },
    );
  });
});

describe("Property 12: Walk-in kaydı doğrulaması", () => {
  const uuidArb = fc.uuid();
  const nameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

  it("boş/boşluk ad, 1'den küçük kişi sayısı ve boş masa reddedilir", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, fc.constantFrom("", "   ", "\t", "\n"), (eventId, tableId, guestName) => {
        const r = walkInInput.safeParse({
          eventId,
          tableId,
          guestName,
          guestCount: 2,
        });
        expect(r.success).toBe(false);
        expect(r.error?.issues.some((i) => i.path[0] === "guestName")).toBe(true);
      }),
    );
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        nameArb,
        fc.integer({ min: -100, max: 0 }),
        (eventId, tableId, guestName, guestCount) => {
          const r = walkInInput.safeParse({
            eventId,
            tableId,
            guestName,
            guestCount,
          });
          expect(r.error?.issues.some((i) => i.path[0] === "guestCount")).toBe(true);
        },
      ),
    );
    fc.assert(
      fc.property(uuidArb, nameArb, fc.constantFrom("", "   "), (eventId, guestName, tableId) => {
        const r = walkInInput.safeParse({
          eventId,
          tableId,
          guestName,
          guestCount: 1,
        });
        expect(r.error?.issues.some((i) => i.path[0] === "tableId")).toBe(true);
      }),
    );
  });

  it("geçerli veri geçer, ad kırpılır, telefon isteğe bağlıdır", () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        nameArb,
        fc.integer({ min: 1, max: 20 }),
        fc.option(fc.stringMatching(/^05[0-9]{9}$/), { nil: undefined }),
        (eventId, tableId, guestName, guestCount, guestPhone) => {
          const r = walkInInput.safeParse({
            eventId,
            tableId,
            guestName: `  ${guestName}  `,
            guestCount,
            guestPhone,
          });
          expect(r.success).toBe(true);
          expect(r.data?.guestName).toBe(guestName.trim());
          expect(r.data?.guestPhone).toBe(guestPhone);
        },
      ),
    );
  });

  it("veritabanı: başarılı walk-in 'checked_in' ve oluşturma anındaki giriş zamanıyla yazılır; dolu masa reddedilir", async () => {
    const door = await actorOf(memberActor("casino", { check_in: "vc--" }));
    await fc.assert(
      fc.asyncProperty(nameArb, fc.integer({ min: 1, max: 10 }), async (guestName, guestCount) => {
        const { event, table } = await bookedGuest();
        const free = await createTable(db, event.id, {
          capacity: guestCount + 5,
        });
        const before = Date.now();
        const result = await registerWalkIn(db, door, {
          eventId: event.id,
          tableId: free.id,
          guestName,
          guestCount,
        });
        expect(result.outcome).toBe("checked_in");
        expect(result.guestName).toBe(guestName.trim());
        const at = Date.parse(result.checkedInAt);
        expect(at).toBeGreaterThanOrEqual(before - 1000);
        expect(at).toBeLessThanOrEqual(Date.now() + 1000);
        expect((await reservationRow(result.reservationId!)).status).toBe("checked_in");

        await expectDomain(
          registerWalkIn(db, door, {
            eventId: event.id,
            tableId: table.id,
            guestName,
            guestCount: 1,
          }),
          "conflict",
          "Bu masa için aktif bir rezervasyon var",
        );
      }),
      { numRuns: 8 },
    );
  });
});

describe("Property 13: Kişi sayısı / masa kapasitesi", () => {
  it("1..kapasite kabul edilir; kapasite aşımı ve 1'den küçük değer her zaman reddedilir (onayla da geçmez)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), fc.integer({ min: -100, max: 100 }), (capacity, guestCount) => {
        const problem = guestCountProblem(guestCount, capacity);
        if (guestCount >= 1 && guestCount <= capacity) expect(problem).toBeNull();
        else if (guestCount < 1) expect(problem).toBe("Kişi sayısı en az 1 olmalıdır");
        else expect(problem).toBe(`Kişi sayısı (${guestCount}) masa kapasitesini (${capacity}) aşıyor`);
        // Belirleyicilik.
        expect(guestCountProblem(guestCount, capacity)).toBe(problem);
      }),
      { numRuns: 300 },
    );
  });

  it("veritabanı: updateGuestCount servis kararı saf kuralla aynıdır ve reddedilen değer yazılmaz", async () => {
    const door = await actorOf(memberActor("casino", { check_in: "vc--" }));
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 20 }),
        async (capacity, guestCount) => {
          const { event, reservation } = await bookedGuest();
          const table = await createTable(db, event.id, { capacity });
          const customer = await createCustomer(db);
          const target = await createReservation(db, {
            eventId: event.id,
            tableId: table.id,
            customerId: customer.id,
            guestCount: 1,
          });
          const problem = guestCountProblem(guestCount, capacity);
          const update = updateGuestCount(db, door, {
            eventId: event.id,
            reservationId: target.id,
            guestCount,
          });
          if (problem === null) {
            expect(await update).toEqual({
              reservationId: target.id,
              guestCount,
            });
          } else {
            await expectDomain(update, "conflict", problem);
            expect((await reservationRow(target.id)).guestCount).toBe(1);
          }
          expect((await reservationRow(reservation.id)).guestCount).toBe(2);
        },
      ),
      { numRuns: 15 },
    );
  });
});
