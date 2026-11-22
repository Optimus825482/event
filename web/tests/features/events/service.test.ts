import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { EVENT_STATUSES, canTransitionEvent, type EventStatus } from "@/domain/event-status";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import {
  changeEventStatus,
  createEvent,
  deleteEvent,
  getEvent,
  getEventOrThrow,
  listEventTables,
  listEvents,
  totalCapacity,
  updateEvent,
} from "@/features/events/service";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

async function makeActor(role: Role = "organizer"): Promise<Actor> {
  const u = await f.createUser(db, { role });
  return { id: u.id, username: u.username, role: u.role, staffId: u.staffId };
}

function inDays(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

async function expectDomain(promise: Promise<unknown>, code: "conflict" | "not_found") {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
}

describe("events service", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  describe("createEvent", () => {
    it("taslak durumda, organizatör olarak oluşturur", async () => {
      const actor = await makeActor();
      const ev = await createEvent(db, actor, { name: "Gala", startsAt: inDays(5), endsAt: inDays(6) });
      expect(ev.status).toBe("draft");
      expect(ev.organizerId).toBe(actor.id);
      expect(ev.name).toBe("Gala");
    });
  });

  describe("updateEvent", () => {
    it("alanları günceller; boş bırakılan bitiş/açıklama temizlenir", async () => {
      const actor = await makeActor();
      const ev = await createEvent(db, actor, {
        name: "A",
        description: "x",
        startsAt: inDays(5),
        endsAt: inDays(6),
      });
      const updated = await updateEvent(db, actor, { id: ev.id, name: "B", startsAt: inDays(7) });
      expect(updated.name).toBe("B");
      expect(updated.endsAt).toBeNull();
      expect(updated.description).toBeNull();
    });

    it("tamamlanmış etkinlik düzenlenemez", async () => {
      const actor = await makeActor();
      const ev = await f.createEvent(db, { organizerId: actor.id, status: "completed" });
      await expectDomain(updateEvent(db, actor, { id: ev.id, name: "Z", startsAt: inDays(5) }), "conflict");
    });

    it("eşzamanlı tamamlama araya girerse düzenleme conflict olur ve yazılmaz", async () => {
      const actor = await makeActor();
      const ev = await f.createEvent(db, { organizerId: actor.id, status: "active", name: "Eski" });
      let pending: Promise<unknown> = Promise.resolve();
      await db.transaction(async (tx) => {
        await tx.select().from(events).where(eq(events.id, ev.id)).for("update");
        pending = updateEvent(db, actor, { id: ev.id, name: "Yeni", startsAt: inDays(5) }).catch((e: unknown) => e);
        await new Promise((r) => setTimeout(r, 300));
        await tx.update(events).set({ status: "completed" }).where(eq(events.id, ev.id));
      });
      const err = await pending;
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe("conflict");
      const [row] = await db.select().from(events).where(eq(events.id, ev.id));
      expect(row?.name).toBe("Eski");
    });

    it("olmayan etkinlik not_found", async () => {
      const actor = await makeActor();
      await expectDomain(
        updateEvent(db, actor, { id: crypto.randomUUID(), name: "Z", startsAt: inDays(5) }),
        "not_found",
      );
    });
  });

  describe("changeEventStatus geçiş matrisi", () => {
    for (const from of EVENT_STATUSES) {
      for (const to of EVENT_STATUSES) {
        const allowed = canTransitionEvent(from, to);
        it(`${from} -> ${to} ${allowed ? "geçer" : "conflict"}`, async () => {
          const actor = await makeActor();
          const ev = await f.createEvent(db, { organizerId: actor.id, status: from });
          if (allowed) {
            const res = await changeEventStatus(db, actor, { id: ev.id, status: to });
            expect(res.status).toBe(to);
            const [row] = await db.select().from(events).where(eq(events.id, ev.id));
            expect(row?.status).toBe(to);
          } else {
            await expectDomain(changeEventStatus(db, actor, { id: ev.id, status: to }), "conflict");
            const [row] = await db.select().from(events).where(eq(events.id, ev.id));
            expect(row?.status).toBe(from satisfies EventStatus);
          }
        });
      }
    }

    it("completed -> draft reddedilir ve mesaj Türkçedir", async () => {
      const actor = await makeActor();
      const ev = await f.createEvent(db, { organizerId: actor.id, status: "completed" });
      const err = await changeEventStatus(db, actor, { id: ev.id, status: "draft" }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).message).toMatch(/geçilemez/);
    });
  });

  describe("deleteEvent", () => {
    it("rezervasyonsuz taslağı siler", async () => {
      const actor = await makeActor();
      const ev = await f.createEvent(db, { organizerId: actor.id });
      await deleteEvent(db, actor, { id: ev.id });
      const rows = await db.select().from(events).where(eq(events.id, ev.id));
      expect(rows).toHaveLength(0);
    });

    it("taslak olmayan etkinlik silinemez", async () => {
      const actor = await makeActor();
      const ev = await f.createEvent(db, { organizerId: actor.id, status: "published" });
      await expectDomain(deleteEvent(db, actor, { id: ev.id }), "conflict");
    });

    it("rezervasyonu olan etkinlik silinemez", async () => {
      const actor = await makeActor();
      const ev = await f.createEvent(db, { organizerId: actor.id });
      const table = await f.createTable(db, ev.id);
      const customer = await f.createCustomer(db);
      await f.createReservation(db, { eventId: ev.id, tableId: table.id, customerId: customer.id });
      await expectDomain(deleteEvent(db, actor, { id: ev.id }), "conflict");
      const rows = await db.select().from(events).where(eq(events.id, ev.id));
      expect(rows).toHaveLength(1);
    });

    it("iptal edilmiş rezervasyonu olan etkinlik de silinemez", async () => {
      const actor = await makeActor();
      const ev = await f.createEvent(db, { organizerId: actor.id });
      const table = await f.createTable(db, ev.id);
      const customer = await f.createCustomer(db);
      await f.createReservation(db, {
        eventId: ev.id,
        tableId: table.id,
        customerId: customer.id,
        status: "cancelled",
      });
      await expectDomain(deleteEvent(db, actor, { id: ev.id }), "conflict");
    });

    it("olmayan etkinlik not_found", async () => {
      const actor = await makeActor();
      await expectDomain(deleteEvent(db, actor, { id: crypto.randomUUID() }), "not_found");
    });
  });

  describe("sahiplik", () => {
    it("organizatör başkasının etkinliğini göremez, değiştiremez, listede görmez", async () => {
      const owner = await makeActor();
      const other = await makeActor();
      const ev = await f.createEvent(db, { organizerId: owner.id });
      await expectDomain(getEvent(db, other, ev.id), "not_found");
      await expectDomain(changeEventStatus(db, other, { id: ev.id, status: "published" }), "not_found");
      await expectDomain(deleteEvent(db, other, { id: ev.id }), "not_found");
      expect((await listEvents(db, other, {})).total).toBe(0);
      expect((await listEvents(db, owner, {})).total).toBe(1);
    });

    it("admin tüm etkinlikleri görür", async () => {
      const owner = await makeActor();
      const admin = await makeActor("admin");
      await f.createEvent(db, { organizerId: owner.id });
      expect((await listEvents(db, admin, {})).total).toBe(1);
    });
  });

  describe("listEvents / getEvent", () => {
    it("duruma ve ada göre süzer, sayfalar, rezervasyon sayısını verir", async () => {
      const actor = await makeActor();
      await f.createEvent(db, { organizerId: actor.id, name: "Yaz Galası", startsAt: inDays(3) });
      const pub = await f.createEvent(db, {
        organizerId: actor.id,
        name: "Kış Balosu",
        status: "published",
        startsAt: inDays(4),
      });
      const table = await f.createTable(db, pub.id);
      const customer = await f.createCustomer(db);
      await f.createReservation(db, { eventId: pub.id, tableId: table.id, customerId: customer.id });

      expect((await listEvents(db, actor, {})).total).toBe(2);
      const byStatus = await listEvents(db, actor, { status: "published" });
      expect(byStatus.items.map((e) => e.name)).toEqual(["Kış Balosu"]);
      expect(byStatus.items[0]?.reservationCount).toBe(1);
      const bySearch = await listEvents(db, actor, { search: "gala" });
      expect(bySearch.items.map((e) => e.name)).toEqual(["Yaz Galası"]);
      const paged = await listEvents(db, actor, { page: 2, pageSize: 1 });
      expect(paged.items).toHaveLength(1);
      expect(paged.total).toBe(2);
    });

    it("search içindeki LIKE joker karakterleri kaçırılır", async () => {
      const actor = await makeActor();
      await f.createEvent(db, { organizerId: actor.id, name: "Abc" });
      expect((await listEvents(db, actor, { search: "%" })).total).toBe(0);
    });

    it("getEvent kapasite ve rezervasyon özetini verir", async () => {
      const actor = await makeActor();
      const ev = await f.createEvent(db, { organizerId: actor.id });
      await f.createTable(db, ev.id, { capacity: 6 });
      const detail = await getEvent(db, actor, ev.id);
      expect(detail.capacity).toBe(6);
      expect(detail.tableCount).toBe(1);
      expect(detail.reservationCount).toBe(0);
    });
  });

  describe("üretilen yardımcılar", () => {
    it("getEventOrThrow bulur, yoksa not_found", async () => {
      const ev = await f.createEvent(db);
      expect((await getEventOrThrow(db, ev.id)).id).toBe(ev.id);
      await expectDomain(getEventOrThrow(db, crypto.randomUUID()), "not_found");
    });

    it("listEventTables yalnız o etkinliğin masalarını döner; totalCapacity toplar", async () => {
      const a = await f.createEvent(db);
      const b = await f.createEvent(db);
      await f.createTable(db, a.id, { label: "M2", capacity: 4 });
      await f.createTable(db, a.id, { label: "M1", capacity: 10 });
      await f.createTable(db, b.id, { label: "X", capacity: 99 });
      expect((await listEventTables(db, a.id)).map((t) => t.label)).toEqual(["M1", "M2"]);
      expect(await totalCapacity(db, a.id)).toBe(14);
      const empty = await f.createEvent(db);
      expect(await totalCapacity(db, empty.id)).toBe(0);
    });
  });
});
