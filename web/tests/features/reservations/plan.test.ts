import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { getReservationPlan } from "@/features/reservations/plan-service";
import { truncateAll } from "../../helpers/db";
import { createReservation } from "../../helpers/factories";
import { actorOf, bookable } from "./fixtures";
import { managerActor, memberActor } from "../../helpers/actors";

describe("getReservationPlan", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("masa durumlarını aktif rezervasyondan türetir (iptal masayı boş bırakır)", async () => {
    const staff = await actorOf(memberActor("casino", { reservations: "vce-", customers: "v---", check_in: "vc--" }));
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

  it("Casino yöneticisi başkasının oluşturduğu etkinliğin haritasını görür; olmayan etkinlik not_found", async () => {
    const creator = await actorOf(managerActor("entertainment"));
    const manager = await actorOf(managerActor("casino"));
    const { event } = await bookable(creator.id);
    await expect(getReservationPlan(db, manager, event.id)).resolves.toMatchObject({ reservations: [] });
    await expect(getReservationPlan(db, manager, crypto.randomUUID())).rejects.toMatchObject({ code: "not_found" });
  });
});
