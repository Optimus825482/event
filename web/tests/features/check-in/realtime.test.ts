import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { checkIn, registerWalkIn, updateGuestCount } from "@/features/check-in/service";
import { subscribe, type StreamMessage } from "@/features/realtime/hub";
import { closeRealtime, ensureListening } from "@/features/realtime/listener";
import { publish } from "@/features/realtime/publish";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { createTable } from "../../helpers/factories";
import { waitFor } from "../realtime/helpers";
import { actorOf, bookedGuest, expectDomain, key, setReservationStatus } from "./fixtures";

/** Etkinliğin olaylarını toplar; `settle` bir işaretçi olay yayıp onun gelmesini bekler (commit sırası). */
function collect(eventId: string) {
  const messages: StreamMessage[] = [];
  const unsubscribe = subscribe(eventId, (m) => messages.push(m));
  const events = () => messages.flatMap((m) => (m.kind === "event" && m.event.id !== "isaretci" ? [m.event] : []));
  async function settle() {
    await publish(db, { type: "table.updated", eventId, id: "isaretci" });
    await waitFor(() => messages.some((m) => m.kind === "event" && m.event.id === "isaretci"), 5000, "işaretçi olayı");
  }
  return { events, settle, unsubscribe };
}

describe("check-in canlı yayınları", () => {
  beforeAll(async () => {
    await setupTestDb();
    await ensureListening();
  });
  beforeEach(async () => {
    await truncateAll();
  });
  afterAll(async () => {
    await closeRealtime();
  });

  it("başarılı check-in commit ile guest.checked_in + stats.updated yayar; 'zaten yapıldı' yaymaz", async () => {
    const { event, reservation } = await bookedGuest();
    const door = await actorOf("controller");
    const sub = collect(event.id);
    try {
      await checkIn(db, door, {
        eventId: event.id,
        idempotencyKey: key(),
        token: reservation.qrToken,
      });
      await sub.settle();
      expect(sub.events().map((e) => [e.type, e.id])).toEqual([
        ["guest.checked_in", reservation.id],
        ["stats.updated", undefined],
      ]);

      const before = sub.events().length;
      const again = await checkIn(db, door, {
        eventId: event.id,
        idempotencyKey: key(),
        token: reservation.qrToken,
      });
      expect(again.outcome).toBe("already_checked_in");
      await sub.settle();
      expect(sub.events()).toHaveLength(before);
    } finally {
      sub.unsubscribe();
    }
  });

  it("reddedilen check-in (iptal) ve geri alınan walk-in hiçbir olay yaymaz", async () => {
    const { event, table, reservation } = await bookedGuest();
    const door = await actorOf("controller");
    const sub = collect(event.id);
    try {
      await setReservationStatus(reservation.id, "cancelled");
      await expectDomain(
        checkIn(db, door, {
          eventId: event.id,
          idempotencyKey: key(),
          token: reservation.qrToken,
        }),
        "conflict",
      );
      await setReservationStatus(reservation.id, "confirmed");
      await expectDomain(
        registerWalkIn(db, door, {
          eventId: event.id,
          tableId: table.id,
          guestName: "Dolu",
          guestCount: 1,
        }),
        "conflict",
      );
      await expectDomain(
        updateGuestCount(db, door, {
          eventId: event.id,
          reservationId: reservation.id,
          guestCount: 9,
        }),
        "conflict",
      );
      await sub.settle();
      expect(sub.events()).toEqual([]);
    } finally {
      sub.unsubscribe();
    }
  });

  it("walk-in ve kişi sayısı değişikliği rezervasyon ve istatistik olayları yayar", async () => {
    const { event, reservation } = await bookedGuest();
    const free = await createTable(db, event.id, { capacity: 4 });
    const door = await actorOf("controller");
    const sub = collect(event.id);
    try {
      const walkIn = await registerWalkIn(db, door, {
        eventId: event.id,
        tableId: free.id,
        guestName: "Kapı",
        guestCount: 2,
      });
      await updateGuestCount(db, door, {
        eventId: event.id,
        reservationId: reservation.id,
        guestCount: 3,
      });
      await sub.settle();
      const seen = sub.events().map((e) => `${e.type}:${e.id ?? ""}`);
      expect(seen).toEqual(
        expect.arrayContaining([
          `reservation.changed:${walkIn.reservationId}`,
          `guest.checked_in:${walkIn.reservationId}`,
          `reservation.changed:${reservation.id}`,
          "stats.updated:",
        ]),
      );
    } finally {
      sub.unsubscribe();
    }
  });
});
