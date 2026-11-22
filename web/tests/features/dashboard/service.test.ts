import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { events, reservations } from "@/db/schema";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { getAdminDashboard, getEventsDashboard } from "@/features/dashboard/service";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

async function makeActor(role: Role): Promise<Actor> {
  const u = await f.createUser(db, { role });
  return { id: u.id, username: u.username, role: u.role, staffId: u.staffId };
}

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);

describe("dashboard service", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  describe("getEventsDashboard", () => {
    it("organizatör yalnızca kendi etkinliklerini sayar", async () => {
      const mine = await makeActor("organizer");
      const other = await makeActor("organizer");
      await f.createEvent(db, { organizerId: mine.id, startsAt: inDays(3) });
      await f.createEvent(db, { organizerId: mine.id, startsAt: inDays(-3), status: "completed" });
      await f.createEvent(db, { organizerId: other.id, startsAt: inDays(4) });

      const own = await getEventsDashboard(db, mine);
      expect(own.totalEvents).toBe(2);
      expect(own.upcomingEvents).toBe(1);
      expect(own.completedEvents).toBe(1);
      expect(own.draftEvents).toBe(1);

      const admin = await getEventsDashboard(db, await makeActor("admin"));
      expect(admin.totalEvents).toBe(3);
    });

    it("geri sayım listesi yalnızca yerleşimi ve ekip ataması olan yaklaşan etkinlikleri getirir", async () => {
      const actor = await makeActor("organizer");
      const ready = await f.createEvent(db, { organizerId: actor.id, startsAt: inDays(2), name: "Hazır" });
      await f.createTable(db, ready.id);
      const person = await f.createStaff(db);
      await f.createAssignment(db, { eventId: ready.id, staffId: person.id });
      const noTeam = await f.createEvent(db, { organizerId: actor.id, startsAt: inDays(1) });
      await f.createTable(db, noTeam.id);
      await f.createEvent(db, { organizerId: actor.id, startsAt: inDays(1) });

      const data = await getEventsDashboard(db, actor);
      expect(data.upcoming.map((e) => e.name)).toEqual(["Hazır"]);
      expect(data.totalStaff).toBe(1);
    });

    it("görüntüleme yetkisi olmayan rolü reddeder", async () => {
      await expect(getEventsDashboard(db, await makeActor("staff"))).rejects.toThrow();
    });
  });

  describe("getAdminDashboard", () => {
    it("toplamları hesaplar", async () => {
      const admin = await makeActor("admin");
      const { event, table, customer } = await f.createBookingParents(db);
      await f.createReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
      await db.update(events).set({ startsAt: inDays(5) });

      const data = await getAdminDashboard(db, admin);
      expect(data.users.total).toBeGreaterThanOrEqual(2);
      expect(data.users.admins).toBe(1);
      expect(data.events.total).toBe(1);
      expect(data.events.upcoming).toBe(1);
      expect(data.reservations.total).toBe(1);
      expect(data.reservations.today).toBe(1);
      expect(data.settings.smtpConfigured).toBe(false);
    });

    it("iptal edilen rezervasyonları saymaz", async () => {
      const admin = await makeActor("admin");
      const { event, table, customer } = await f.createBookingParents(db);
      await f.createReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
      await db.update(reservations).set({ status: "cancelled" });
      expect((await getAdminDashboard(db, admin)).reservations.total).toBe(0);
    });

    it("yönetici olmayanı reddeder", async () => {
      await expect(getAdminDashboard(db, await makeActor("organizer"))).rejects.toThrow();
    });
  });
});
