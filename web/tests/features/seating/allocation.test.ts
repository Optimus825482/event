import { asc, eq, inArray, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/notifications/publish", () => ({ publishNotifications: vi.fn(async () => {}) }));

import { db } from "@/db/client";
import { eventTables, notifications, reservations, tableSeatSlots } from "@/db/schema";
import type { TableAllocation } from "@/domain/seating";
import { ForbiddenError } from "@/features/auth/errors";
import type { Actor } from "@/features/auth/session";
import { publishNotifications } from "@/features/notifications/publish";
import { createReservation } from "@/features/reservations/service";
import { seatingActionDefs } from "@/features/seating/action-defs";
import { allocateToCasino, releaseFromCasino, setSaleAllocation } from "@/features/seating/allocation-service";
import { allocationInputSchema, saleAllocationSchema } from "@/features/seating/schemas";
import { createAction, DomainError } from "@/lib/action";
import { adminActor, managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { openOnline, setSaleSettings } from "../../helpers/seating";
import { watchEvents } from "../realtime/emitted";

const CLOSED_EVENT = "Tamamlanmış veya iptal edilmiş etkinlikte masa tahsisi değiştirilemez";

async function setup(o: Parameters<typeof f.createEvent>[1] = {}) {
  const event = await f.createEvent(db, { status: "published", ...o });
  const casino = await persistActor(db, managerActor("casino"));
  const ent = await persistActor(db, managerActor("entertainment"));
  const mk = (label: string, allocation: TableAllocation = "pending", extra: Record<string, unknown> = {}) =>
    f.createTable(db, event.id, { label, capacity: 8, allocation, ...extra });
  return { event, casino, ent, mk };
}

async function allocationOf(id: string): Promise<TableAllocation> {
  const [r] = await db.select({ a: eventTables.allocation }).from(eventTables).where(eq(eventTables.id, id));
  if (!r) throw new Error("masa yok");
  return r.a;
}

const slotsOf = async (id: string) =>
  db
    .select({ id: tableSeatSlots.id })
    .from(tableSeatSlots)
    .where(eq(tableSeatSlots.tableId, id))
    .orderBy(asc(tableSeatSlots.seatNo));

/** Bu test veritabanında bir oturum kilit beklemeye girene dek bekler (sabit uyku yerine). */
async function untilLockWait(timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const r = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from pg_stat_activity
          where datname = current_database() and wait_event_type = 'Lock'`,
    );
    if ((r.rows[0]?.n ?? 0) > 0) return;
    if (Date.now() > deadline) throw new Error(`kilit beklemesi ${timeoutMs} ms içinde görülmedi`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const notificationsOf = (eventId: string) =>
  db.select().from(notifications).where(eq(notifications.eventId, eventId));

describe("Casino tahsisi", () => {
  beforeEach(async () => {
    await truncateAll();
    vi.mocked(publishNotifications).mockClear();
  });

  it("Casino yöneticisi beklemedeki masaları ayırır", async () => {
    const { event, casino, mk } = await setup();
    const a1 = await mk("A1");
    const a2 = await mk("A2");
    expect(await allocateToCasino(db, casino, { eventId: event.id, tableIds: [a1.id, a2.id] })).toEqual({
      updated: 2,
    });
    expect(await allocationOf(a1.id)).toBe("casino");
    expect(await allocationOf(a2.id)).toBe("casino");
  });

  it("online ya da kapalı masa Casino'ya ayrılamaz; hiçbir masa değişmez", async () => {
    const { event, casino, mk } = await setup();
    const a1 = await mk("A1");
    const a2 = await mk("A2", "online");
    const a3 = await mk("A3", "closed");
    await expect(allocateToCasino(db, casino, { eventId: event.id, tableIds: [a1.id, a2.id] })).rejects.toMatchObject({
      code: "conflict",
      message: "Yalnızca beklemedeki masalar Casino'ya ayrılabilir: A2",
    });
    expect(await allocationOf(a1.id)).toBe("pending");
    await expect(
      allocateToCasino(db, casino, { eventId: event.id, tableIds: [a3.id, a1.id, a2.id] }),
    ).rejects.toMatchObject({ message: "Yalnızca beklemedeki masalar Casino'ya ayrılabilir: A2, A3" });
    expect(await allocationOf(a1.id)).toBe("pending");
  });

  it("başka etkinliğin masası not_found", async () => {
    const { event, casino } = await setup();
    const other = await f.createEvent(db);
    const foreign = await f.createTable(db, other.id, { label: "X1", allocation: "pending" });
    await expect(allocateToCasino(db, casino, { eventId: event.id, tableIds: [foreign.id] })).rejects.toMatchObject({
      code: "not_found",
      message: "Masa bu etkinlikte bulunamadı",
    });
    expect(await allocationOf(foreign.id)).toBe("pending");
  });

  it.each(["entertainment", "fnb"] as const)(
    "Entertainment ve F&B yöneticisi Casino'ya ayıramaz, serbest bırakamaz (%s)",
    async (dept) => {
      const { event, mk } = await setup();
      const p = await mk("A1");
      const c = await mk("C1", "casino");
      const other = await persistActor(db, managerActor(dept));
      await expect(allocateToCasino(db, other, { eventId: event.id, tableIds: [p.id] })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(releaseFromCasino(db, other, { eventId: event.id, tableIds: [c.id] })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(await allocationOf(p.id)).toBe("pending");
      expect(await allocationOf(c.id)).toBe("casino");
    },
  );

  it("rezervasyonsuz masa serbest kalır ve Entertainment'a bildirim yazılır", async () => {
    const { event, casino, mk } = await setup();
    const a1 = await mk("A1", "casino");
    const res = await releaseFromCasino(db, casino, { eventId: event.id, tableIds: [a1.id] });
    expect(res.updated).toBe(1);
    expect(res.notification).toMatchObject({ type: "casino_tables_released", audience: "entertainment" });
    expect(await allocationOf(a1.id)).toBe("pending");
    const rows = await notificationsOf(event.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "casino_tables_released",
      audience: "entertainment",
      eventId: event.id,
      createdById: casino.id,
      actionUrl: `/events/${event.id}/tables`,
      metadata: { tableIds: [a1.id], labels: ["A1"] },
    });
  });

  it("etkin rezervasyonlu masa serbest bırakılamaz; hiçbiri değişmez, bildirim yazılmaz", async () => {
    const { event, casino, mk } = await setup();
    const a1 = await mk("A1", "casino");
    const a2 = await mk("A2", "casino");
    const customer = await f.createCustomer(db);
    await f.createReservation(db, { eventId: event.id, tableId: a1.id, customerId: customer.id, status: "confirmed" });
    await expect(
      releaseFromCasino(db, casino, { eventId: event.id, tableIds: [a1.id, a2.id] }),
    ).rejects.toMatchObject({ code: "conflict", message: "Etkin rezervasyonu olan masalar serbest bırakılamaz: A1" });
    expect(await allocationOf(a1.id)).toBe("casino");
    expect(await allocationOf(a2.id)).toBe("casino");
    expect(await notificationsOf(event.id)).toHaveLength(0);
  });

  it("iptal ve gelmedi rezervasyonu serbest bırakmayı engellemez", async () => {
    const { event, casino, mk } = await setup();
    const a1 = await mk("A1", "casino");
    const a2 = await mk("A2", "casino");
    const customer = await f.createCustomer(db);
    await f.createReservation(db, { eventId: event.id, tableId: a1.id, customerId: customer.id, status: "cancelled" });
    await f.createReservation(db, { eventId: event.id, tableId: a2.id, customerId: customer.id, status: "no_show" });
    const res = await releaseFromCasino(db, casino, { eventId: event.id, tableIds: [a1.id, a2.id] });
    expect(res.updated).toBe(2);
    expect(await allocationOf(a1.id)).toBe("pending");
    expect(await allocationOf(a2.id)).toBe("pending");
  });

  it("casino olmayan masa serbest bırakılamaz", async () => {
    const { event, casino, mk } = await setup();
    const a1 = await mk("A1", "casino");
    const a3 = await mk("A3", "online");
    await expect(
      releaseFromCasino(db, casino, { eventId: event.id, tableIds: [a1.id, a3.id] }),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "Yalnızca Casino'ya ayrılmış masalar serbest bırakılabilir: A3",
    });
    expect(await allocationOf(a1.id)).toBe("casino");
    expect(await notificationsOf(event.id)).toHaveLength(0);
  });

  it("eşzamanlı rezervasyon ve serbest bırakma tutarsızlık bırakmaz", async () => {
    const { event, casino, mk } = await setup();
    const admin = await persistActor(db, adminActor());
    for (let round = 0; round < 6; round += 1) {
      const table = await mk(`R${round}`, "casino");
      const customer = await f.createCustomer(db);
      const results = await Promise.allSettled([
        createReservation(db, admin, {
          eventId: event.id,
          tableId: table.id,
          guestCount: 2,
          customerId: customer.id,
        }),
        releaseFromCasino(db, casino, { eventId: event.id, tableIds: [table.id] }),
      ]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(DomainError);
      expect((rejected[0]?.reason as DomainError).code).toBe("conflict");

      const active = await db
        .select({ id: reservations.id })
        .from(reservations)
        .where(inArray(reservations.tableId, [table.id]));
      const allocation = await allocationOf(table.id);
      if (active.length > 0) {
        expect(allocation).toBe("casino");
        expect((rejected[0]?.reason as DomainError).message).toBe(
          "Etkin rezervasyonu olan masalar serbest bırakılamaz: " + table.label,
        );
      } else {
        expect(allocation).toBe("pending");
      }
    }
  });

  it("masayı tutan rezervasyon işlemi bitene dek serbest bırakma bekler ve rezervasyonu görür", async () => {
    const { event, casino, mk } = await setup();
    const a1 = await mk("A1", "casino");
    const customer = await f.createCustomer(db);
    let pending: Promise<unknown> | undefined;
    await db.transaction(async (tx) => {
      // createReservation ile aynı kilit: masa FOR SHARE, ardından ekleme.
      await tx.select({ id: eventTables.id }).from(eventTables).where(eq(eventTables.id, a1.id)).for("share");
      await f.createReservation(tx, { eventId: event.id, tableId: a1.id, customerId: customer.id });
      pending = releaseFromCasino(db, casino, { eventId: event.id, tableIds: [a1.id] }).then(
        () => null,
        (e: unknown) => e,
      );
      await untilLockWait();
    });
    const error = await pending;
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({
      code: "conflict",
      message: "Etkin rezervasyonu olan masalar serbest bırakılamaz: A1",
    });
    expect(await allocationOf(a1.id)).toBe("casino");
    expect(await notificationsOf(event.id)).toHaveLength(0);
  });

  it("tamamlanmış etkinlikte üç işlev de reddedilir", async () => {
    const { event, casino, ent, mk } = await setup({ status: "completed" });
    const p = await mk("A1");
    const c = await mk("C1", "casino");
    await expect(allocateToCasino(db, casino, { eventId: event.id, tableIds: [p.id] })).rejects.toMatchObject({
      code: "conflict",
      message: CLOSED_EVENT,
    });
    await expect(releaseFromCasino(db, casino, { eventId: event.id, tableIds: [c.id] })).rejects.toMatchObject({
      code: "conflict",
      message: CLOSED_EVENT,
    });
    await expect(
      setSaleAllocation(db, ent, { eventId: event.id, tableIds: [p.id], allocation: "online" }),
    ).rejects.toMatchObject({ code: "conflict", message: CLOSED_EVENT });
    expect(await allocationOf(p.id)).toBe("pending");
    expect(await allocationOf(c.id)).toBe("casino");
  });

  it("allocation.changed: tek masada kimlikli, toplu işlemde kimliksiz tek olay", async () => {
    const { event, casino, ent, mk } = await setup();
    const a1 = await mk("A1");
    const a2 = await mk("A2");
    const a3 = await mk("A3");
    const watch = await watchEvents(event.id);
    try {
      await watch.discardSetup();
      await allocateToCasino(db, casino, { eventId: event.id, tableIds: [a1.id] });
      await allocateToCasino(db, casino, { eventId: event.id, tableIds: [a2.id, a3.id] });
      await releaseFromCasino(db, casino, { eventId: event.id, tableIds: [a1.id, a2.id] });
      await setSaleAllocation(db, ent, { eventId: event.id, tableIds: [a1.id], allocation: "closed" });
      await watch.settled();
      expect(watch.events()).toEqual([
        { type: "allocation.changed", id: a1.id },
        { type: "allocation.changed" },
        { type: "allocation.changed" },
        { type: "allocation.changed", id: a1.id },
      ]);
    } finally {
      watch.stop();
    }
  });
});

describe("satış tahsisi", () => {
  beforeEach(async () => {
    await truncateAll();
    vi.mocked(publishNotifications).mockClear();
  });

  it("online yapılan masada effectiveSellable kadar yuva oluşur", async () => {
    const { event, ent, mk } = await setup();
    const a1 = await mk("A1", "pending", { sellableSeats: 6 });
    const a2 = await mk("A2", "closed");
    expect(
      await setSaleAllocation(db, ent, { eventId: event.id, tableIds: [a1.id, a2.id], allocation: "online" }),
    ).toEqual({ updated: 2 });
    expect(await allocationOf(a1.id)).toBe("online");
    expect(await allocationOf(a2.id)).toBe("online");
    expect(await slotsOf(a1.id)).toHaveLength(6);
    expect(await slotsOf(a2.id)).toHaveLength(8);
  });

  it("online'dan çıkarılan masanın yuvaları silinir", async () => {
    const { event, ent, mk } = await setup();
    const a1 = await mk("A1");
    const a2 = await mk("A2");
    await db.transaction((tx) => openOnline(tx, event.id, [a1.id, a2.id]));
    expect(await slotsOf(a1.id)).toHaveLength(8);
    await setSaleAllocation(db, ent, { eventId: event.id, tableIds: [a1.id], allocation: "closed" });
    expect(await allocationOf(a1.id)).toBe("closed");
    expect(await slotsOf(a1.id)).toHaveLength(0);
    await setSaleAllocation(db, ent, { eventId: event.id, tableIds: [a2.id], allocation: "pending" });
    expect(await allocationOf(a2.id)).toBe("pending");
    expect(await slotsOf(a2.id)).toHaveLength(0);
    // Kapalıdan beklemeye: yuva yoktur, yine de durum değişir.
    expect(
      await setSaleAllocation(db, ent, { eventId: event.id, tableIds: [a1.id], allocation: "pending" }),
    ).toEqual({ updated: 1 });
  });

  it("casino masanın satış durumu değiştirilemez", async () => {
    const { event, ent, mk } = await setup();
    const a1 = await mk("A1", "casino");
    const a2 = await mk("A2");
    await expect(
      setSaleAllocation(db, ent, { eventId: event.id, tableIds: [a2.id, a1.id], allocation: "online" }),
    ).rejects.toMatchObject({ code: "conflict", message: "Casino'ya ayrılmış masaların satış durumu değiştirilemez: A1" });
    expect(await allocationOf(a1.id)).toBe("casino");
    expect(await allocationOf(a2.id)).toBe("pending");
    expect(await slotsOf(a2.id)).toHaveLength(0);
  });

  it("locaOnline kapalıyken loca online yapılamaz; açılınca yapılır", async () => {
    const { event, ent, mk } = await setup();
    const l1 = await mk("L1", "pending", { isLoca: true });
    const a1 = await mk("A1");
    await expect(
      setSaleAllocation(db, ent, { eventId: event.id, tableIds: [a1.id, l1.id], allocation: "online" }),
    ).rejects.toMatchObject({ code: "conflict", message: "Localar bu etkinlikte online satışa kapalı: L1" });
    expect(await allocationOf(a1.id)).toBe("pending");
    expect(await allocationOf(l1.id)).toBe("pending");

    // Ayar kapalıyken de loca kapatılabilir ve beklemeye alınabilir.
    await setSaleAllocation(db, ent, { eventId: event.id, tableIds: [l1.id], allocation: "closed" });
    expect(await allocationOf(l1.id)).toBe("closed");
    await setSaleAllocation(db, ent, { eventId: event.id, tableIds: [l1.id], allocation: "pending" });
    expect(await allocationOf(l1.id)).toBe("pending");

    await setSaleSettings(db, event.id, { locaOnline: true });
    expect(
      await setSaleAllocation(db, ent, { eventId: event.id, tableIds: [a1.id, l1.id], allocation: "online" }),
    ).toEqual({ updated: 2 });
    expect(await allocationOf(l1.id)).toBe("online");
    expect(await slotsOf(l1.id)).toHaveLength(8);
  });

  it("Casino yöneticisi satışa açamaz", async () => {
    const { event, casino, mk } = await setup();
    const a1 = await mk("A1");
    await expect(
      setSaleAllocation(db, casino, { eventId: event.id, tableIds: [a1.id], allocation: "online" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await allocationOf(a1.id)).toBe("pending");
  });

  it("zaten aynı durumdaki masa sayılmaz", async () => {
    const { event, ent, mk } = await setup();
    const a1 = await mk("A1");
    await db.transaction((tx) => openOnline(tx, event.id, [a1.id]));
    const before = await slotsOf(a1.id);
    const watch = await watchEvents(event.id);
    try {
      await watch.discardSetup();
      expect(
        await setSaleAllocation(db, ent, { eventId: event.id, tableIds: [a1.id], allocation: "online" }),
      ).toEqual({ updated: 0 });
      expect(await watch.settled()).toEqual([]);
    } finally {
      watch.stop();
    }
    expect(await slotsOf(a1.id)).toEqual(before);
  });

  it("şema: tekrarlanan masa kimlikleri tekilleştirilir; boş seçim ve geçersiz tahsis reddedilir", async () => {
    const id = "6f1f7f3e-1b2c-4d5e-8f90-123456789abc";
    const eventId = "0b7a6c52-9d1e-4f3a-b2c4-abcdef012345";
    expect(allocationInputSchema.parse({ eventId, tableIds: [id, id] }).tableIds).toEqual([id]);
    expect(allocationInputSchema.safeParse({ eventId, tableIds: [] }).success).toBe(false);
    expect(saleAllocationSchema.safeParse({ eventId, tableIds: [id], allocation: "casino" }).success).toBe(false);
    expect(saleAllocationSchema.parse({ eventId, tableIds: [id, id], allocation: "online" })).toEqual({
      eventId,
      tableIds: [id],
      allocation: "online",
    });
  });
});

describe("tahsis eylemleri", () => {
  beforeEach(async () => {
    await truncateAll();
    vi.mocked(publishNotifications).mockClear();
  });

  const as = (actor: Actor) => createAction({ getActor: async () => actor }).defineAction;
  const run = (actor: Actor, key: "allocateToCasino" | "releaseFromCasino" | "setSaleAllocation") =>
    key === "setSaleAllocation"
      ? as(actor)(seatingActionDefs.setSaleAllocation)
      : as(actor)(seatingActionDefs[key]);

  it("eylem: serbest bırakma bildirimi işlemden sonra yayılır; reddedilen istekte yayılmaz", async () => {
    const { event, casino, mk } = await setup();
    const a1 = await mk("A1", "casino");
    const a2 = await mk("A2", "online");
    const release = run(casino, "releaseFromCasino");

    expect(await release({ eventId: event.id, tableIds: [a1.id] })).toEqual({ ok: true, data: { updated: 1 } });
    expect(publishNotifications).toHaveBeenCalledTimes(1);
    const [rows] = vi.mocked(publishNotifications).mock.calls[0]!;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ audience: "entertainment", type: "casino_tables_released" });

    vi.mocked(publishNotifications).mockClear();
    expect(await release({ eventId: event.id, tableIds: [a2.id] })).toMatchObject({ ok: false, code: "conflict" });
    expect(publishNotifications).not.toHaveBeenCalled();
  });

  it("eylem: Casino'ya ayırma ve satış tahsisi sayıyı döndürür", async () => {
    const { event, casino, ent, mk } = await setup();
    const a1 = await mk("A1");
    const a2 = await mk("A2");
    expect(await run(casino, "allocateToCasino")({ eventId: event.id, tableIds: [a1.id, a1.id] })).toEqual({
      ok: true,
      data: { updated: 1 },
    });
    expect(
      await run(ent, "setSaleAllocation")({ eventId: event.id, tableIds: [a2.id], allocation: "online" }),
    ).toEqual({ ok: true, data: { updated: 1 } });
    expect(await run(casino, "setSaleAllocation")({ eventId: event.id, tableIds: [a2.id], allocation: "closed" }))
      .toMatchObject({ ok: false, code: "forbidden" });
    expect(await allocationOf(a2.id)).toBe("online");
  });
});
