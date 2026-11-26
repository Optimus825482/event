import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
  findLockedChanges,
  loadCommitments,
  type LockedChange,
  type LockTableInput,
  type TableCommitment,
} from "@/features/planning/layout-lock";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { setAllocation } from "../../helpers/seating";

describe("findLockedChanges", () => {
  const A1 = { id: "a1", label: "A1", capacity: 8, x: 100, y: 100, rotation: 0, floor: 1, tableTypeId: "t1" };
  const B1 = { ...A1, id: "b1", label: "B1" };
  const committed = new Map<string, TableCommitment>([
    ["a1", { tableId: "a1", reasons: ["reservation"], minCapacity: 6 }],
  ]);
  it.each<[string, LockTableInput[], LockedChange[]]>([
    ["silme", [B1], [{ tableId: "a1", label: "A1", change: "deleted" }]],
    ["taşıma", [{ ...A1, x: 140 }, B1], [{ tableId: "a1", label: "A1", change: "moved" }]],
    ["dönüş", [{ ...A1, rotation: 90 }, B1], [{ tableId: "a1", label: "A1", change: "moved" }]],
    ["tam tur dönüş taşıma sayılmaz", [{ ...A1, rotation: 360 }, B1], []],
    ["etiket", [{ ...A1, label: "A9" }, B1], [{ tableId: "a1", label: "A1", change: "relabeled" }]],
    [
      "kapasite taahhüdün altına",
      [{ ...A1, capacity: 5 }, B1],
      [{ tableId: "a1", label: "A1", change: "capacity_below_committed" }],
    ],
    ["kapasite artırma serbest", [{ ...A1, capacity: 10 }, B1], []],
    ["kat", [{ ...A1, floor: 2 }, B1], [{ tableId: "a1", label: "A1", change: "floor_changed" }]],
    ["tip", [{ ...A1, tableTypeId: "t2" }, B1], [{ tableId: "a1", label: "A1", change: "type_changed" }]],
    ["taahhütsüz masa silinir", [A1], []],
    ["yeni masa", [A1, B1, { label: "C1", capacity: 4 }], []],
  ])("%s", (_, next, expected) => expect(findLockedChanges([A1, B1], next, committed)).toEqual(expected));
});

describe("loadCommitments", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("loadCommitments: iptal edilmiş rezervasyon masayı dondurmaz", async () => {
    const event = await f.createEvent(db);
    const a1 = await f.createTable(db, event.id, { label: "A1", capacity: 8 });
    const b1 = await f.createTable(db, event.id, { label: "B1", capacity: 8, allocation: "pending" });
    const customer = await f.createCustomer(db);
    await f.createReservation(db, { eventId: event.id, tableId: a1.id, customerId: customer.id, guestCount: 6 });
    await f.createReservation(db, {
      eventId: event.id,
      tableId: b1.id,
      customerId: customer.id,
      guestCount: 4,
      status: "cancelled",
    });

    const commitments = await loadCommitments(db, event.id);

    expect([...commitments.values()]).toEqual([
      { tableId: a1.id, reasons: ["reservation", "casino_allocation"], minCapacity: 6 },
    ]);
  });

  it("loadCommitments: Casino'ya ayrılmış rezervasyonsuz masa sıfır koltukla taahhütlüdür", async () => {
    const event = await f.createEvent(db);
    const a1 = await f.createTable(db, event.id, { label: "A1", capacity: 8, allocation: "casino" });
    const b1 = await f.createTable(db, event.id, { label: "B1", capacity: 8, allocation: "casino" });
    const c1 = await f.createTable(db, event.id, { label: "C1", capacity: 8, allocation: "pending" });
    const d1 = await f.createTable(db, event.id, { label: "D1", capacity: 8, allocation: "pending" });
    const e1 = await f.createTable(db, event.id, { label: "E1", capacity: 8, allocation: "pending" });
    await setAllocation(db, [d1.id], "online");
    await setAllocation(db, [e1.id], "closed");
    const customer = await f.createCustomer(db);
    await f.createReservation(db, { eventId: event.id, tableId: a1.id, customerId: customer.id, guestCount: 6 });

    const commitments = await loadCommitments(db, event.id);

    expect(commitments.get(a1.id)).toEqual({
      tableId: a1.id,
      reasons: ["reservation", "casino_allocation"],
      minCapacity: 6,
    });
    expect(commitments.get(b1.id)).toEqual({ tableId: b1.id, reasons: ["casino_allocation"], minCapacity: 0 });
    for (const id of [c1.id, d1.id, e1.id]) expect(commitments.has(id)).toBe(false);
  });
});
