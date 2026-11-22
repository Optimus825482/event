import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { withPermissions } from "@/features/auth/permissions";
import { getReservationPlan } from "@/features/reservations/plan-service";
import { truncateAll } from "../../helpers/db";
import { createReservation } from "../../helpers/factories";
import { actorOf, bookable } from "./fixtures";

describe("getReservationPlan", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("masa durumlarını aktif rezervasyondan türetir (iptal masayı boş bırakır)", async () => {
    const staff = await withPermissions(await actorOf("staff"));
    const { event, table, customer } = await bookable();
    await createReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id, status: "cancelled" });
    const before = await getReservationPlan(db, staff, event.id);
    expect(before.statuses[table.id]).toBe("free");
    await createReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id, status: "checked_in" });
    const after = await getReservationPlan(db, staff, event.id);
    expect(after.statuses[table.id]).toBe("checked_in");
    expect(after.reservations).toHaveLength(2);
    expect(after.plan.tables.map((t) => t.id)).toEqual([table.id]);
  });

  it("organizatör başkasının etkinliğinin haritasını göremez; kendisininkini görür", async () => {
    const owner = await actorOf("organizer");
    const other = await withPermissions(await actorOf("organizer"));
    const { event } = await bookable(owner.id);
    await expect(getReservationPlan(db, other, event.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(getReservationPlan(db, await withPermissions(owner), event.id)).resolves.toMatchObject({ reservations: [] });
  });
});
