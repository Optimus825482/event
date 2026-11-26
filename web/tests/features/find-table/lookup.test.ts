import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { findTableByCode } from "@/features/find-table/lookup";
import type { FindTableLimiters } from "@/features/find-table/rate-limit";
import { verifyFindTableToken } from "@/features/find-table/token";
import { formatPnr } from "@/features/ticketing/pnr";
import { createCustomer } from "../../helpers/factories";
import { truncateAll } from "../../helpers/db";
import { ticketedEvent } from "../../helpers/door";
import { bookedGuest, reservationRow, setEventStatus, setReservationStatus } from "../check-in/fixtures";
import { reservations } from "@/db/schema";

const allowAll = { check: async () => ({ allowed: true as const }) };
const open: FindTableLimiters = { ip: allowAll, code: allowAll };
const ctx = { ip: "203.0.113.7" };

async function setWindow(eventId: string, startsAgoHours: number, endsAgoHours: number | null) {
  const starts = sql`now() - make_interval(hours => ${startsAgoHours})`;
  const ends = endsAgoHours === null ? sql`null` : sql`now() - make_interval(hours => ${endsAgoHours})`;
  await db.update(events).set({ startsAt: starts as never, endsAt: ends as never }).where(eq(events.id, eventId));
}

describe("kod + soyad ile masa arama", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it.each(["Yılmaz", "yilmaz", "YILMAZ", "  Yılmaz  "])("doğru PNR + soyad (%s) sipariş belirteci verir", async (lastName) => {
    const te = await ticketedEvent();
    const found = await findTableByCode(db, { code: te.order.pnr!, lastName }, ctx, { limiters: open });
    expect(verifyFindTableToken(found!.token)).toEqual({ kind: "order", id: te.order.orderId });
  });

  it("PNR tireli ve küçük harfle yazılabilir", async () => {
    const te = await ticketedEvent();
    const found = await findTableByCode(db, { code: formatPnr(te.order.pnr!).toLowerCase(), lastName: "Yılmaz" }, ctx, { limiters: open });
    expect(found).not.toBeNull();
  });

  it("doğru PNR + yanlış soyad null", async () => {
    const te = await ticketedEvent();
    expect(await findTableByCode(db, { code: te.order.pnr!, lastName: "Kaya" }, ctx, { limiters: open })).toBeNull();
  });

  it.each(["", "   ", "!!!"])("doğru kod + boş ya da yalnızca simge soyad (%j) null", async (lastName) => {
    const te = await ticketedEvent();
    expect(await findTableByCode(db, { code: te.order.pnr!, lastName }, ctx, { limiters: open })).toBeNull();
    const g = await bookedGuest();
    const code = (await reservationRow(g.reservation.id)).bookingCode;
    expect(await findTableByCode(db, { code, lastName }, ctx, { limiters: open })).toBeNull();
  });

  it("rezervasyon kodu + soyad: guest_name yoksa müşteri adının son sözcüğü", async () => {
    const g = await bookedGuest();
    await db.update(reservations).set({ guestName: null }).where(eq(reservations.id, g.reservation.id));
    const customer = await createCustomer(db, { fullName: "Zeynep Kaya" });
    await db.update(reservations).set({ customerId: customer.id }).where(eq(reservations.id, g.reservation.id));
    const { bookingCode } = await reservationRow(g.reservation.id);
    const found = await findTableByCode(db, { code: bookingCode, lastName: "kaya" }, ctx, { limiters: open });
    expect(verifyFindTableToken(found!.token)).toEqual({ kind: "reservation", id: g.reservation.id });
    expect(await findTableByCode(db, { code: bookingCode, lastName: "Zeynep" }, ctx, { limiters: open })).toBeNull();
  });

  it("guest_name doluysa onun son sözcüğü geçerlidir", async () => {
    const g = await bookedGuest();
    await db.update(reservations).set({ guestName: "Ali Öztürk" }).where(eq(reservations.id, g.reservation.id));
    const { bookingCode } = await reservationRow(g.reservation.id);
    expect(await findTableByCode(db, { code: bookingCode, lastName: "ozturk" }, ctx, { limiters: open })).not.toBeNull();
    const customerLast = g.customer.fullName.split(" ").at(-1)!;
    expect(await findTableByCode(db, { code: bookingCode, lastName: customerLast }, ctx, { limiters: open })).toBeNull();
  });

  it("soyad anahtarı boş olan kayıt hiçbir girdiyle eşleşmez", async () => {
    const g = await bookedGuest();
    await db.update(reservations).set({ guestName: "123" }).where(eq(reservations.id, g.reservation.id));
    const { bookingCode } = await reservationRow(g.reservation.id);
    expect(await findTableByCode(db, { code: bookingCode, lastName: "123" }, ctx, { limiters: open })).toBeNull();
    expect(await findTableByCode(db, { code: bookingCode, lastName: "" }, ctx, { limiters: open })).toBeNull();
  });

  it.each(["cancelled", "no_show"] as const)("%s rezervasyon null", async (status) => {
    const g = await bookedGuest();
    await db.update(reservations).set({ guestName: "Ali Kaya" }).where(eq(reservations.id, g.reservation.id));
    const { bookingCode } = await reservationRow(g.reservation.id);
    await setReservationStatus(g.reservation.id, status);
    expect(await findTableByCode(db, { code: bookingCode, lastName: "Kaya" }, ctx, { limiters: open })).toBeNull();
  });

  it("paid olmayan (süresi dolmuş) sipariş null", async () => {
    const te = await ticketedEvent();
    await db.execute(sql`update orders set status = 'expired' where id = ${te.order.orderId}`);
    expect(await findTableByCode(db, { code: te.order.pnr!, lastName: "Yılmaz" }, ctx, { limiters: open })).toBeNull();
  });

  it("bilinmeyen kod, biçimsiz kod ve yanlış soyad ayırt edilemez: hepsi null", async () => {
    await ticketedEvent();
    for (const code of ["ZZZZZZZZ", "R222222", "abc", "O0O0O0O0"]) {
      expect(await findTableByCode(db, { code, lastName: "Yılmaz" }, ctx, { limiters: open })).toBeNull();
    }
  });

  it("etkinlik bitişinden 12 saat sonra null; 11 saat sonra hâlâ geçerli", async () => {
    const te = await ticketedEvent();
    await setWindow(te.event.id, 30, 13);
    expect(await findTableByCode(db, { code: te.order.pnr!, lastName: "Yılmaz" }, ctx, { limiters: open })).toBeNull();
    await setWindow(te.event.id, 30, 11);
    expect(await findTableByCode(db, { code: te.order.pnr!, lastName: "Yılmaz" }, ctx, { limiters: open })).not.toBeNull();
  });

  it("ends_at boşsa başlangıç + 12 saat esas alınır", async () => {
    const te = await ticketedEvent();
    await setWindow(te.event.id, 13, null);
    expect(await findTableByCode(db, { code: te.order.pnr!, lastName: "Yılmaz" }, ctx, { limiters: open })).toBeNull();
    await setWindow(te.event.id, 11, null);
    expect(await findTableByCode(db, { code: te.order.pnr!, lastName: "Yılmaz" }, ctx, { limiters: open })).not.toBeNull();
  });

  it("etkinlik başlamadan önce de çalışır", async () => {
    const te = await ticketedEvent();
    await setWindow(te.event.id, -72, null);
    expect(await findTableByCode(db, { code: te.order.pnr!, lastName: "Yılmaz" }, ctx, { limiters: open })).not.toBeNull();
  });

  it.each(["draft", "cancelled"] as const)("%s etkinlikte null", async (status) => {
    const te = await ticketedEvent();
    await setEventStatus(te.event.id, status);
    expect(await findTableByCode(db, { code: te.order.pnr!, lastName: "Yılmaz" }, ctx, { limiters: open })).toBeNull();
  });
});
