import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { ticketCommitments } from "@/features/planning/layout-lock";
import { verifyQrToken } from "@/features/reservations/qr-token";
import {
  availabilitySchema,
  errorBodySchema,
  eventDetailSchema,
  eventsResponseSchema,
  lookupResponseSchema,
  orderResponseSchema,
} from "@/features/sales-api/contract";
import { verifyOrderToken } from "@/features/ticketing/order-token";
import { formatPnr } from "@/features/ticketing/pnr";
import { getOrdersOverview } from "@/features/ticketing/queries";
import { TICKETING_READY } from "@/features/ticketing/ready";
import { getSalesTotals } from "@/features/ticketing/stats";
import { findTicketByQr } from "@/features/ticketing/tickets-read";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { activeTickets, saleEvent } from "../ticketing/fixtures";
import { bodyOf, makeApi, req } from "./fixtures";

const O = "/api/sales/v1/orders";
const IP = "203.0.113.7";
const payBody = {
  buyer: { firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.com" },
  acceptTerms: true,
  payment: { provider: "demo", action: "approve" },
};

describe("satın alma uçtan uca", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("satın alma: listele → ayrıntı → doluluk → tut → öde → e-bilet → PNR ile bul", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const entertainmentManager = await persistActor(db, managerActor("entertainment"));
    const api = makeApi();
    // 1) Etkinlik listede ve ayrıntıda satışa açık görünür.
    const list = eventsResponseSchema.parse(await bodyOf(await api.listEvents(req("GET", "/api/sales/v1/events"))));
    expect(list.events.map((e) => e.id)).toContain(event.id);
    const detail = eventDetailSchema.parse(
      await bodyOf(await api.getEvent(req("GET", `/api/sales/v1/events/${event.id}`), event.id)),
    );
    expect(detail.sale.state).toBe("open");
    expect(detail.plan.tables.find((t) => t.id === a1!.id)).toMatchObject({ sellable: true, seats: 8 });
    // 2) Tutma.
    const hold = orderResponseSchema.parse(
      await bodyOf(
        await api.createOrder(
          req("POST", O, {
            ip: IP,
            body: { eventId: event.id, items: [{ tableId: a1!.id, quantity: 3 }], clientKey: randomUUID() },
          }),
        ),
      ),
    );
    expect(hold).toMatchObject({ status: "pending", total: "4500.00" });
    // 3) Doluluk tutmayı yansıtır (yeni işleyici örneği: önbelleksiz).
    const avail = availabilitySchema.parse(
      await bodyOf(await makeApi().getAvailability(req("GET", `/api/sales/v1/events/${event.id}/availability`), event.id)),
    );
    expect(avail.tables).toEqual([{ id: a1!.id, free: 5, freeSeats: [4, 5, 6, 7, 8] }]);
    // 4) Ödeme (demo onay).
    const paid = orderResponseSchema.parse(
      await bodyOf(await api.payOrder(req("POST", `${O}/${hold.orderToken}/pay`, { ip: IP, body: payBody }), hold.orderToken)),
    );
    expect(paid).toMatchObject({ status: "paid", isDemo: true, demoNotice: "DEMO - gerçek ödeme alınmadı" });
    expect(paid.tickets).toHaveLength(3);
    // 5) Her QR kapıda çözülebilir bir bilete karşılık gelir.
    for (const t of paid.tickets) {
      expect(verifyQrToken(t.qrPayload)).toEqual({ reservationId: t.ticketId });
      expect(await findTicketByQr(db, t.qrPayload)).toMatchObject({
        ticketId: t.ticketId,
        status: "issued",
        tableLabel: "A1",
        pnr: paid.pnr,
      });
    }
    // 6) E-bilet yanıttan sonra bir kez gönderilir.
    await api.runDeferred();
    expect(api.sendEmail).toHaveBeenCalledTimes(1);
    // 7) E-bilet sayfası belirteçle açılır; "biletimi bul" PNR + soyadla aynı siparişe götürür.
    const viaToken = orderResponseSchema.parse(
      await bodyOf(await api.getOrder(req("GET", `${O}/${paid.orderToken}`), paid.orderToken)),
    );
    expect(viaToken.pnr).toBe(paid.pnr);
    const found = lookupResponseSchema.parse(
      await bodyOf(
        await api.lookupOrder(req("POST", `${O}/lookup`, { ip: IP, body: { pnr: formatPnr(paid.pnr!), lastName: "yilmaz" } })),
      ),
    );
    expect(verifyOrderToken(found.orderToken)).toEqual({ orderId: paid.orderId });
    // 8) Çekirdek durumu: yuvalar dolu, toplamlar demo sütununda, iç ekran siparişi gösterir, masa yerleşimde taahhütlü.
    expect((await activeTickets(a1!.id)).filter((t) => t.status === "issued")).toHaveLength(3);
    expect(await getSalesTotals(db, event.id)).toMatchObject({
      issued: 0,
      revenue: "0.00",
      demoIssued: 3,
      demoRevenue: "4500.00",
    });
    expect((await getOrdersOverview(db, entertainmentManager, event.id)).orders[0]).toMatchObject({
      pnr: paid.pnr,
      isDemo: true,
      seatCount: 3,
    });
    expect(await ticketCommitments(db, event.id)).toEqual([{ tableId: a1!.id, reason: "ticket", seats: 3 }]);
  });

  it("ödenmiş sipariş bırakılamaz; tükenen masaya yeni tutma seats_unavailable", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const api = makeApi();
    const hold = orderResponseSchema.parse(
      await bodyOf(
        await api.createOrder(
          req("POST", O, { body: { eventId: event.id, items: [{ tableId: a1!.id, quantity: 3 }], clientKey: randomUUID() } }),
        ),
      ),
    );
    const paid = orderResponseSchema.parse(
      await bodyOf(await api.payOrder(req("POST", `${O}/${hold.orderToken}/pay`, { body: payBody }), hold.orderToken)),
    );
    const del = await api.cancelOrder(req("DELETE", `${O}/${paid.orderToken}`), paid.orderToken);
    expect(del.status).toBe(409);
    expect(errorBodySchema.parse(await del.json()).error.code).toBe("already_paid");

    const full = await api.createOrder(
      req("POST", O, { body: { eventId: event.id, items: [{ tableId: a1!.id, quantity: 6 }], clientKey: randomUUID() } }),
    );
    expect(full.status).toBe(409);
    expect(errorBodySchema.parse(await full.json()).error).toMatchObject({
      code: "seats_unavailable",
      details: { free: 5 },
    });
  });

  it("rota modülleri gerçek işleyiciye bağlıdır: sır tanımsız ortamda 503", async () => {
    expect(process.env.SALES_API_SECRET).toBeUndefined();
    const events = await import("@/app/api/sales/v1/events/route");
    const event = await import("@/app/api/sales/v1/events/[eventId]/route");
    const availability = await import("@/app/api/sales/v1/events/[eventId]/availability/route");
    const create = await import("@/app/api/sales/v1/orders/route");
    const lookup = await import("@/app/api/sales/v1/orders/lookup/route");
    const one = await import("@/app/api/sales/v1/orders/[orderToken]/route");
    const pay = await import("@/app/api/sales/v1/orders/[orderToken]/pay/route");
    const r = (method: string) => new Request("http://localhost/x", { method });
    const eventCtx = { params: Promise.resolve({ eventId: randomUUID() }) };
    const tokenCtx = { params: Promise.resolve({ orderToken: "x" }) };
    const responses = [
      await events.GET(r("GET")),
      await event.GET(r("GET"), eventCtx),
      await availability.GET(r("GET"), eventCtx),
      await create.POST(r("POST")),
      await lookup.POST(r("POST")),
      await one.GET(r("GET"), tokenCtx),
      await one.DELETE(r("DELETE"), tokenCtx),
      await pay.POST(r("POST"), tokenCtx),
    ];
    expect(responses).toHaveLength(8);
    for (const res of responses) {
      expect(res.status).toBe(503);
      expect(errorBodySchema.parse(await res.json()).error.code).toBe("sales_api_disabled");
    }
  });

  it("hazır bayrağı açık", () => expect(TICKETING_READY).toBe(true));
});
