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
    const b1 = await f.createTable(db, event.id, { label: "B1", capacity: 8 });
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

    expect([...commitments.values()]).toEqual([{ tableId: a1.id, reasons: ["reservation"], minCapacity: 6 }]);
  });
});
