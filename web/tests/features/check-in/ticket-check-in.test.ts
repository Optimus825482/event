import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { checkInEvents, tickets } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { checkInActionDefs } from "@/features/check-in/action-defs";
import { checkIn } from "@/features/check-in/service";
import { subscribe, type StreamMessage } from "@/features/realtime/hub";
import { closeRealtime, ensureListening } from "@/features/realtime/listener";
import { publish } from "@/features/realtime/publish";
import { signQrToken } from "@/features/reservations/qr-token";
import { createAction } from "@/lib/action";
import { memberActor } from "../../helpers/actors";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { doorActor, ticketedEvent, ticketIdsOf, ticketLog, ticketRow } from "../../helpers/door";
import { createPaidOrder, createPendingHold, expireOrder } from "../../helpers/ticketing";
import { saleEvent } from "../ticketing/fixtures";
import { waitFor } from "../realtime/helpers";
import { actorOf, bookedGuest, expectDomain, key, setEventStatus } from "./fixtures";

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

function as(actor: Actor | null) {
  return createAction({ getActor: async () => actor }).defineAction;
}

describe("bilet bazında giriş", () => {
  let door: Actor;

  beforeAll(async () => {
    await setupTestDb();
    await ensureListening();
  });
  beforeEach(async () => {
    await truncateAll();
    door = await doorActor();
  });
  afterAll(async () => {
    await closeRealtime();
  });

  it("bilet QR'ı yalnızca o bileti içeri alır", async () => {
    const te = await ticketedEvent();
    const [t0, t1, t2] = te.tickets;
    const r = await checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), token: t0!.qrPayload, gate: 2 });
    expect(r).toMatchObject({
      outcome: "checked_in",
      kind: "ticket",
      ticketId: t0!.ticketId,
      reservationId: null,
      pnr: te.order.pnr,
      gate: 2,
      guestCount: 1,
      guestName: "Deniz Yılmaz",
      tableId: t0!.tableId,
      tableLabel: t0!.tableLabel,
      checkedInBy: { id: door.id, username: door.username },
    });
    expect(await ticketRow(t0!.ticketId)).toMatchObject({ checkedInBy: door.id, checkInGate: 2 });
    expect((await ticketRow(t0!.ticketId)).checkedInAt).not.toBeNull();
    for (const other of [t1!, t2!]) expect((await ticketRow(other.ticketId)).checkedInAt).toBeNull();
    expect((await ticketLog(t0!.ticketId)).map((l) => [l.outcome, l.reservationId, l.gate])).toEqual([
      ["checked_in", null, 2],
    ]);
  });

  it("ikinci okutma already_checked_in döner (kim, ne zaman); bilet değişmez", async () => {
    const te = await ticketedEvent();
    const t = te.tickets[0]!;
    const other = await doorActor();
    const first = await checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), token: t.qrPayload, gate: 2 });
    const before = await ticketRow(t.ticketId);
    const again = await checkIn(db, other, { eventId: te.event.id, idempotencyKey: key(), token: t.qrPayload, gate: 3 });
    expect(again).toMatchObject({
      outcome: "already_checked_in",
      checkedInAt: first.checkedInAt,
      checkedInBy: { id: door.id, username: door.username },
      gate: 2,
    });
    expect(await ticketRow(t.ticketId)).toEqual(before);
    const log = await ticketLog(t.ticketId);
    expect(log.map((l) => l.outcome)).toEqual(["checked_in", "already_checked_in"]);
    expect(log.map((l) => l.gate)).toEqual([2, 3]);
  });

  it("aynı anahtarla tekrar: aynı yanıt, tek kayıt, bilet satırı değişmez", async () => {
    const te = await ticketedEvent();
    const t = te.tickets[0]!;
    const input = {
      eventId: te.event.id,
      idempotencyKey: key(),
      token: t.qrPayload,
      gate: 1,
      clientTimestamp: new Date().toISOString(),
    };
    const first = await checkIn(db, door, input);
    const before = await ticketRow(t.ticketId);
    const again = await checkIn(db, door, input);
    expect(again).toEqual(first);
    expect(await ticketRow(t.ticketId)).toEqual(before);
    expect(await ticketLog(t.ticketId)).toHaveLength(1);
  });

  it("tekrar yayın üretmez: tek guest.checked_in (id = bilet) + tek stats.updated", async () => {
    const te = await ticketedEvent();
    const t = te.tickets[0]!;
    const sub = collect(te.event.id);
    try {
      await checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), token: t.qrPayload });
      await checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), token: t.qrPayload });
      await sub.settle();
      expect(sub.events().map((e) => [e.type, e.id])).toEqual([
        ["guest.checked_in", t.ticketId],
        ["stats.updated", undefined],
      ]);
    } finally {
      sub.unsubscribe();
    }
  });

  it("farklı anahtarlı eşzamanlı iki okutma: biri checked_in, diğeri already_checked_in", async () => {
    const te = await ticketedEvent();
    const t = te.tickets[0]!;
    const results = await Promise.all([
      checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), token: t.qrPayload, gate: 1 }),
      checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), token: t.qrPayload, gate: 2 }),
    ]);
    expect(results.map((r) => r.outcome).sort()).toEqual(["already_checked_in", "checked_in"]);
    expect(results[0]!.checkedInAt).toBe(results[1]!.checkedInAt);
  });

  it("bilet kimliğiyle giriş (PNR listesinden)", async () => {
    const te = await ticketedEvent();
    const t = te.tickets[1]!;
    const r = await checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), ticketId: t.ticketId });
    expect(r).toMatchObject({ outcome: "checked_in", kind: "ticket", ticketId: t.ticketId, gate: null });
  });

  it("tutulan (ödenmemiş) bilet reddedilir", async () => {
    const te = await ticketedEvent();
    const hold = await createPendingHold(db, {
      eventId: te.event.id,
      items: [{ tableId: te.tables[1]!.id, quantity: 1 }],
    });
    const [ticketId] = await ticketIdsOf(hold.orderId);
    await expectDomain(
      checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), ticketId: ticketId! }),
      "conflict",
      "Bu biletin ödemesi tamamlanmamış; giriş yapılamaz",
    );
    expect((await ticketRow(ticketId!)).checkedInAt).toBeNull();
    expect((await ticketLog(ticketId!)).map((l) => l.outcome)).toEqual(["invalid_status"]);
  });

  it("süresi dolmuş bilet reddedilir", async () => {
    const te = await ticketedEvent();
    const hold = await createPendingHold(db, {
      eventId: te.event.id,
      items: [{ tableId: te.tables[1]!.id, quantity: 1 }],
    });
    await expireOrder(db, hold.orderId);
    const [ticketId] = await ticketIdsOf(hold.orderId);
    await expectDomain(
      checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), ticketId: ticketId! }),
      "conflict",
      "Bu biletin süresi dolmuş; giriş yapılamaz",
    );
    expect((await ticketRow(ticketId!)).checkedInAt).toBeNull();
  });

  it("reddedilen bilet isteğinin tekrarı saklanan reddi döndürür", async () => {
    const te = await ticketedEvent();
    const hold = await createPendingHold(db, {
      eventId: te.event.id,
      items: [{ tableId: te.tables[1]!.id, quantity: 1 }],
    });
    const [ticketId] = await ticketIdsOf(hold.orderId);
    const input = { eventId: te.event.id, idempotencyKey: key(), ticketId: ticketId! };
    await expectDomain(checkIn(db, door, input), "conflict", "Bu biletin ödemesi tamamlanmamış; giriş yapılamaz");
    await expectDomain(checkIn(db, door, input), "conflict", "Bu biletin ödemesi tamamlanmamış; giriş yapılamaz");
    expect(await ticketLog(ticketId!)).toHaveLength(1);
  });

  it("başka etkinliğin bileti reddedilir", async () => {
    const a = await ticketedEvent();
    const b = await ticketedEvent();
    await expectDomain(
      checkIn(db, door, { eventId: b.event.id, idempotencyKey: key(), token: a.tickets[0]!.qrPayload }),
      "conflict",
      "Bu QR kod başka bir etkinliğe ait",
    );
    expect((await ticketRow(a.tickets[0]!.ticketId)).checkedInAt).toBeNull();
    expect((await ticketLog(a.tickets[0]!.ticketId)).map((l) => l.outcome)).toEqual([]);
    const logged = await db.select({ outcome: checkInEvents.outcome }).from(checkInEvents);
    expect(logged.map((l) => l.outcome)).toEqual(["invalid_status"]);
  });

  it("imzası bozuk bilet belirteci not_found", async () => {
    const te = await ticketedEvent();
    const t = te.tickets[0]!;
    const broken = `${t.qrPayload.slice(0, -2)}${t.qrPayload.endsWith("xx") ? "yy" : "xx"}`;
    await expectDomain(
      checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), token: broken }),
      "not_found",
      "QR kod geçersiz veya rezervasyon bulunamadı",
    );
    expect((await ticketRow(t.ticketId)).checkedInAt).toBeNull();
  });

  it("imzası geçerli ama satırdaki qr_token ile eşleşmeyen belirteç not_found", async () => {
    const te = await ticketedEvent();
    const t = te.tickets[0]!;
    await db.update(tickets).set({ qrToken: `${t.qrPayload}.eski` }).where(eq(tickets.id, t.ticketId));
    await expectDomain(
      checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), token: t.qrPayload }),
      "not_found",
      "QR kod geçersiz veya rezervasyon bulunamadı",
    );
    expect((await ticketRow(t.ticketId)).checkedInAt).toBeNull();
  });

  it("tamamlanmış etkinlikte bilet girişi kabul edilir", async () => {
    const te = await ticketedEvent();
    await setEventStatus(te.event.id, "completed");
    const r = await checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), token: te.tickets[0]!.qrPayload });
    expect(r).toMatchObject({ outcome: "checked_in", kind: "ticket" });
  });

  it("imzası geçerli ama hiçbir rezervasyona ya da bilete ait olmayan belirteç not_found", async () => {
    const te = await ticketedEvent();
    await expectDomain(
      checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), token: signQrToken(randomUUID()) }),
      "not_found",
      "QR kod geçersiz veya rezervasyon bulunamadı",
    );
  });

  it("bilinmeyen bilet kimliği not_found 'Bilet bulunamadı'", async () => {
    const te = await ticketedEvent();
    await expectDomain(
      checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), ticketId: randomUUID() }),
      "not_found",
      "Bilet bulunamadı",
    );
  });

  it("rezervasyon QR'ı hâlâ rezervasyon olarak çözülür", async () => {
    const { event, reservation } = await bookedGuest();
    const r = await checkIn(db, door, { eventId: event.id, idempotencyKey: key(), token: reservation.qrToken });
    expect(r).toMatchObject({ kind: "reservation", reservationId: reservation.id, ticketId: null });
  });

  it("taslak ve iptal edilmiş etkinlikte bilet girişi yapılmaz", async () => {
    const te = await ticketedEvent();
    const t = te.tickets[0]!;
    for (const status of ["draft", "cancelled"] as const) {
      await setEventStatus(te.event.id, status);
      await expectDomain(
        checkIn(db, door, { eventId: te.event.id, idempotencyKey: key(), token: t.qrPayload }),
        "conflict",
      );
    }
    expect((await ticketRow(t.ticketId)).checkedInAt).toBeNull();
  });

  it("check_in:create yetkisi olmayan aktör bilet girişi yapamaz", async () => {
    const te = await ticketedEvent();
    const t = te.tickets[0]!;
    const viewer = await actorOf(memberActor("casino", { check_in: "v---" }));
    const res = await as(viewer)(checkInActionDefs.checkIn)({
      eventId: te.event.id,
      idempotencyKey: key(),
      token: t.qrPayload,
    });
    expect(res).toMatchObject({ ok: false, code: "forbidden" });
    expect((await ticketRow(t.ticketId)).checkedInAt).toBeNull();
  });

  it("bilet girişi yanıtı sandalye numarasını taşır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const paid = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 1, seatNos: [5] }] });
    const qr = paid.tickets[0]!.qrPayload;
    const first = await checkIn(db, door, { eventId: event.id, idempotencyKey: key(), token: qr });
    expect(first.seatNo).toBe(5);
    const second = await checkIn(db, door, { eventId: event.id, idempotencyKey: key(), token: qr });
    expect(second.seatNo).toBe(5);
  });

  it("masa bazlı kipte ve locada bilet girişi yanıtında seatNo null", async () => {
    const tableMode = await saleEvent({ settings: { saleMode: "table" } });
    const tableOrder = await createPaidOrder(db, {
      eventId: tableMode.event.id,
      items: [{ tableId: tableMode.tables[0]!.id, quantity: 8 }],
    });
    const tableRes = await checkIn(db, door, {
      eventId: tableMode.event.id,
      idempotencyKey: key(),
      token: tableOrder.tickets[0]!.qrPayload,
    });
    expect(tableRes.seatNo).toBeNull();

    const locaMode = await saleEvent({ tables: [{ isLoca: true, capacity: 6 }], settings: { locaOnline: true } });
    const locaOrder = await createPaidOrder(db, {
      eventId: locaMode.event.id,
      items: [{ tableId: locaMode.tables[0]!.id, quantity: 6 }],
    });
    const locaRes = await checkIn(db, door, {
      eventId: locaMode.event.id,
      idempotencyKey: key(),
      token: locaOrder.tickets[0]!.qrPayload,
    });
    expect(locaRes.seatNo).toBeNull();
  });
});
