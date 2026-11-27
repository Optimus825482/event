import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { db } from "@/db/client";
import { artists, eventSiteContent, events, tableGroupTables, tableSeatSlots, tableTypes } from "@/db/schema";
import {
  availabilitySchema,
  eventDetailSchema,
  eventsResponseSchema,
  type errorBodySchema,
} from "@/features/sales-api/contract";
import { truncateAll } from "../../helpers/db";
import { createCustomer, createReservation, createTable, createTableGroup } from "../../helpers/factories";
import { createPaidOrder, createPendingHold, expireOrder } from "../../helpers/ticketing";
import { saleEvent } from "../ticketing/fixtures";
import { bodyOf, makeApi, req, TEST_SECRET } from "./fixtures";

type SalesErrorBody = z.infer<typeof errorBodySchema>;

describe("satış API okuma uçları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("sırsız ya da yanlış sırlı istek her okuma ucunda 401 alır ve veritabanına dokunmaz", async () => {
    const spyDb = new Proxy(db, {
      get() {
        throw new Error("veritabanına dokunuldu");
      },
    });
    const guarded = makeApi({ db: spyDb as typeof db });
    const id = randomUUID();
    for (const auth of [null, "Bearer yanlis", `Bearer ${TEST_SECRET}x`]) {
      for (const res of [
        await guarded.listEvents(req("GET", "/api/sales/v1/events", { auth })),
        await guarded.getEvent(req("GET", `/api/sales/v1/events/${id}`, { auth }), id),
        await guarded.getAvailability(req("GET", `/api/sales/v1/events/${id}/availability`, { auth }), id),
      ]) {
        expect(res.status).toBe(401);
        expect((await bodyOf<SalesErrorBody>(res)).error.code).toBe("unauthorized");
      }
    }
  });

  it("sunucuda sır tanımsızsa her uç 503 sales_api_disabled", async () => {
    const api = makeApi({ secret: undefined });
    const id = randomUUID();
    for (const res of [
      await api.listEvents(req("GET", "/api/sales/v1/events")),
      await api.getEvent(req("GET", `/x/${id}`), id),
      await api.getAvailability(req("GET", `/x/${id}/availability`), id),
    ]) {
      expect(res.status).toBe(503);
      expect((await bodyOf<SalesErrorBody>(res)).error.code).toBe("sales_api_disabled");
    }
  });

  it("etkinlik listesi yalnızca satıştaki/satışı kapanmış yayımlanmış etkinlikleri döner", async () => {
    const e1 = (await saleEvent({ tables: [{ category: "standard" }, { label: "V1", category: "vip" }] })).event;
    const e2 = (await saleEvent({ stage: "sales_closed", status: "active" })).event;
    await saleEvent({ stage: "priced" });
    await saleEvent({ status: "draft" });
    await saleEvent({ status: "cancelled" });
    await db.update(events).set({ startsAt: new Date("2027-01-10T18:00:00Z") }).where(eq(events.id, e1.id));
    await db.update(events).set({ startsAt: new Date("2027-02-10T18:00:00Z") }).where(eq(events.id, e2.id));

    const res = await makeApi().listEvents(req("GET", "/api/sales/v1/events"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=30");
    const body = eventsResponseSchema.parse(await res.json());
    expect(body.events.map((e) => e.id)).toEqual([e1.id, e2.id]);
    expect(body.events[0]).toMatchObject({ name: e1.name, currency: "TRY", minPrice: "1500.00", saleState: "open" });
    expect(body.events[1]?.saleState).toBe("closed");
  });

  it("sağlayıcı kapalıyken satış durumu closed", async () => {
    await saleEvent();
    const res = await makeApi({ provider: () => null }).listEvents(req("GET", "/api/sales/v1/events"));
    const body = eventsResponseSchema.parse(await res.json());
    expect(body.events[0]?.saleState).toBe("closed");
  });

  async function detailEvent(settings: { sharedTables?: boolean } = {}) {
    const { event, tables } = await saleEvent({
      tables: [
        { label: "A1", capacity: 8, sellableSeats: 6, category: "standard" },
        { label: "L1", capacity: 6, category: "vip", isLoca: true },
      ],
      settings: { locaOnline: true, ...settings },
    });
    const c1 = await createTable(db, event.id, { label: "C1", capacity: 8, allocation: "casino", saleCategory: "premium" });
    await createTable(db, event.id, { label: "P1", capacity: 8, allocation: "pending", saleCategory: "premium" });
    const customer = await createCustomer(db);
    await createReservation(db, {
      eventId: event.id,
      tableId: c1.id,
      customerId: customer.id,
      guestName: "Gizli Misafir",
      guestPhone: "05321112233",
    });
    const [type] = await db.insert(tableTypes).values({ name: "Tip", color: "#112233" }).returning();
    if (!type) throw new Error("masa tipi eklenemedi");
    const a1 = tables[0];
    if (!a1) throw new Error("masa yok");
    const group = await createTableGroup(db, event.id, { name: "Ekip Gizli" });
    await db.insert(tableGroupTables).values({ eventId: event.id, tableGroupId: group.id, tableId: a1.id });
    return { event, a1 };
  }

  it("etkinlik ayrıntısı: fiyatlar, satış ayarları, plan; tahsis türü ve kişisel veri sızmaz", async () => {
    const { event } = await detailEvent();
    const res = await makeApi().getEvent(req("GET", `/api/sales/v1/events/${event.id}`), event.id);
    expect(res.status).toBe(200);
    const text = await res.clone().text();
    const detail = eventDetailSchema.parse(await res.json());
    expect(detail.prices).toEqual([
      { category: "standard", label: "Standart", price: "1500.00" },
      { category: "vip", label: "VIP", price: "4000.00" },
    ]);
    expect(detail.minPrice).toBe("1500.00");
    expect(detail.sale).toMatchObject({ state: "open", holdMinutes: 10, maxSeatsPerOrder: 12, blockSingleLeftover: true, demo: true });
    const byLabel = Object.fromEntries(detail.plan.tables.map((t) => [t.label, t]));
    expect(byLabel.A1).toMatchObject({ sellable: true, category: "standard", seats: 6, wholeOnly: false });
    expect(byLabel.L1).toMatchObject({ sellable: true, category: "vip", seats: 6, wholeOnly: true, isLoca: true });
    for (const label of ["C1", "P1"]) {
      expect(byLabel[label]).toMatchObject({ sellable: false, category: null, seats: null, wholeOnly: false });
    }
    for (const leak of ["Gizli Misafir", "05321112233", "casino", "allocation", "pending", "group", "Ekip Gizli"]) {
      expect(text).not.toContain(leak);
    }
  });

  it("paylaşımlı masa kapalıyken tüm satılabilir masalar wholeOnly", async () => {
    const { event } = await detailEvent({ sharedTables: false });
    const res = await makeApi().getEvent(req("GET", `/x/${event.id}`), event.id);
    const detail = eventDetailSchema.parse(await res.json());
    const sellable = detail.plan.tables.filter((t) => t.sellable);
    expect(sellable.length).toBe(2);
    expect(sellable.every((t) => t.wholeOnly)).toBe(true);
  });

  it("görünmeyen, olmayan ya da uuid olmayan etkinlik 404 event_not_found", async () => {
    const { event } = await saleEvent({ stage: "priced" });
    for (const id of [event.id, randomUUID(), "abc"]) {
      const detail = await makeApi().getEvent(req("GET", `/x/${id}`), id);
      expect(detail.status).toBe(404);
      expect((await bodyOf<SalesErrorBody>(detail)).error.code).toBe("event_not_found");
      const avail = await makeApi().getAvailability(req("GET", `/x/${id}/availability`), id);
      expect(avail.status).toBe(404);
      expect((await bodyOf<SalesErrorBody>(avail)).error.code).toBe("event_not_found");
    }
  });

  it("doluluk yalnızca online masaları ve boş sayıyı döner; tutma ve satış düşer, süresi dolan geri gelir", async () => {
    const { event, tables } = await saleEvent({ tables: [{ capacity: 8 }] });
    const a1 = tables[0];
    if (!a1) throw new Error("masa yok");
    await createTable(db, event.id, { label: "C1", capacity: 8, allocation: "casino" });
    await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1.id, quantity: 3 }] });
    const h = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1.id, quantity: 2 }] });
    const path = `/api/sales/v1/events/${event.id}/availability`;
    const res = await makeApi().getAvailability(req("GET", path), event.id);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const first = availabilitySchema.parse(await res.json());
    expect(first.tables).toEqual([{ id: a1.id, free: 3, freeSeats: [6, 7, 8] }]);
    await expireOrder(db, h.orderId);
    const fresh = availabilitySchema.parse(await (await makeApi().getAvailability(req("GET", path), event.id)).json());
    expect(fresh.tables).toEqual([{ id: a1.id, free: 5, freeSeats: [4, 5, 6, 7, 8] }]);
  });

  it("doluluk etkinlik başına 2 sn önbelleklenir; süre dolunca yenilenir", async () => {
    const { event, tables } = await saleEvent({ tables: [{ capacity: 8 }] });
    const a1 = tables[0];
    if (!a1) throw new Error("masa yok");
    let t = 0;
    const api = makeApi({ now: () => t });
    const path = `/api/sales/v1/events/${event.id}/availability`;
    const free = async () =>
      availabilitySchema.parse(await (await api.getAvailability(req("GET", path), event.id)).json()).tables[0]?.free;
    expect(await free()).toBe(8);
    const at = availabilitySchema.parse(await (await api.getAvailability(req("GET", path), event.id)).json()).at;
    expect(at).toBe(new Date(0).toISOString());
    await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1.id, quantity: 2 }] });
    t = 1999;
    expect(await free()).toBe(8);
    t = 2000;
    expect(await free()).toBe(6);
  });

  it("rota dosyaları yalnızca GET dışa aktarır ve işleyiciye bağlıdır", async () => {
    const list = await import("@/app/api/sales/v1/events/route");
    const detail = await import("@/app/api/sales/v1/events/[eventId]/route");
    const avail = await import("@/app/api/sales/v1/events/[eventId]/availability/route");
    for (const mod of [list, detail, avail]) expect(Object.keys(mod).sort()).toEqual(["GET", "dynamic", "runtime"]);
    const res = await list.GET(new Request("http://localhost/api/sales/v1/events"));
    expect(res.status).toBe(503);
    expect((await bodyOf<SalesErrorBody>(res)).error.code).toBe("sales_api_disabled");
    const id = randomUUID();
    const ctx = { params: Promise.resolve({ eventId: id }) };
    expect((await detail.GET(new Request(`http://localhost/x/${id}`), ctx)).status).toBe(503);
    expect((await avail.GET(new Request(`http://localhost/x/${id}/availability`), ctx)).status).toBe(503);
  });

  it("liste ve ayrıntı yanıtları sözleşme şemasından geçer", async () => {
    const { event } = await detailEvent();
    const listRes = await makeApi().listEvents(req("GET", "/api/sales/v1/events"));
    const detailRes = await makeApi().getEvent(req("GET", `/api/sales/v1/events/${event.id}`), event.id);
    const listBody = await listRes.json();
    const detailBody = await detailRes.json();
    expect(() => eventsResponseSchema.parse(listBody)).not.toThrow();
    expect(() => eventDetailSchema.parse(detailBody)).not.toThrow();
  });

  it("kart: kapak, sanatçı görseli ve demo işareti", async () => {
    const coverPath = "event/3f2b0c1e-0000-4000-8000-000000000001.webp";
    const artistPath = "artist/3f2b0c1e-0000-4000-8000-000000000002.webp";
    const [artist] = await db
      .insert(artists)
      .values({ name: "Sanatçı A", nameKey: "SANATÇI A", image: artistPath })
      .returning();
    const { event: e1 } = await saleEvent();
    await db
      .update(events)
      .set({ coverImage: coverPath, artistId: artist!.id, isDemo: true })
      .where(eq(events.id, e1.id));

    const { event: e2 } = await saleEvent();
    await db.update(events).set({ coverImage: "invalid/path.png" }).where(eq(events.id, e2.id));

    const res = await makeApi().listEvents(req("GET", "/api/sales/v1/events"));
    const body = eventsResponseSchema.parse(await res.json());
    const card1 = body.events.find((e) => e.id === e1.id);
    const card2 = body.events.find((e) => e.id === e2.id);
    expect(card1).toMatchObject({ coverImage: coverPath, artistImage: artistPath, isDemo: true });
    expect(card2).toMatchObject({ coverImage: null, artistImage: null, isDemo: false });
  });

  it("ayrıntı: site içeriği satırı yokken tüm alanlar null, satış şekli seat", async () => {
    const { event } = await saleEvent();
    const res = await makeApi().getEvent(req("GET", `/x/${event.id}`), event.id);
    const detail = eventDetailSchema.parse(await res.json());
    expect(detail.site).toEqual({
      heroImage: null,
      summary: null,
      doorsOpenAt: null,
      ageLimit: null,
      dressCode: null,
      sightlineSet: null,
    });
    expect(detail.sale.mode).toBe("seat");
  });

  it("ayrıntı: site içeriği ve bilinmeyen sahne görüşü seti", async () => {
    const heroPath = "event/3f2b0c1e-0000-4000-8000-000000000003.webp";
    const doors = new Date("2027-03-01T17:30:00.000Z");
    const { event: e1 } = await saleEvent();
    await db.insert(eventSiteContent).values({
      eventId: e1.id,
      heroImage: heroPath,
      summary: "Gala gecesi",
      doorsOpenAt: doors,
      ageLimit: "18+",
      dressCode: "Şık",
      sightlineSet: "diamond",
    });
    const d1 = eventDetailSchema.parse(
      await (await makeApi().getEvent(req("GET", `/x/${e1.id}`), e1.id)).json(),
    );
    expect(d1.site).toEqual({
      heroImage: heroPath,
      summary: "Gala gecesi",
      doorsOpenAt: doors.toISOString(),
      ageLimit: "18+",
      dressCode: "Şık",
      sightlineSet: "diamond",
    });

    const { event: e2 } = await saleEvent();
    await db.insert(eventSiteContent).values({ eventId: e2.id, sightlineSet: "x" });
    const d2 = eventDetailSchema.parse(
      await (await makeApi().getEvent(req("GET", `/x/${e2.id}`), e2.id)).json(),
    );
    expect(d2.site.sightlineSet).toBeNull();
  });

  it("ayrıntı: masa kapasitesi ve yuva numaraları; satılamaz masada boş", async () => {
    const { event } = await detailEvent();
    const res = await makeApi().getEvent(req("GET", `/x/${event.id}`), event.id);
    const detail = eventDetailSchema.parse(await res.json());
    const byLabel = Object.fromEntries(detail.plan.tables.map((t) => [t.label, t]));
    expect(byLabel.A1).toMatchObject({ capacity: 8, seats: 6, seatNos: [1, 2, 3, 4, 5, 6] });
    expect(byLabel.C1).toMatchObject({ capacity: 8, seats: null, seatNos: [] });
  });

  it("masa bazlı kipte tüm satılabilir masalar wholeOnly", async () => {
    const { event } = await saleEvent({
      tables: [{ label: "A1", capacity: 8 }],
      settings: { sharedTables: true, saleMode: "table" } as Record<string, unknown>,
    });
    const res = await makeApi().getEvent(req("GET", `/x/${event.id}`), event.id);
    const detail = eventDetailSchema.parse(await res.json());
    expect(detail.sale.mode).toBe("table");
    const sellable = detail.plan.tables.filter((t) => t.sellable);
    expect(sellable.every((t) => t.wholeOnly)).toBe(true);
  });

  it("doluluk boş sandalye numaralarını verir ve free ile tutarlıdır", async () => {
    const { event, tables } = await saleEvent({ tables: [{ capacity: 8 }] });
    const a1 = tables[0]!;
    const h = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1.id, quantity: 2 }] });
    let t = 0;
    const api = makeApi({ now: () => t });
    const path = `/api/sales/v1/events/${event.id}/availability`;
    const first = availabilitySchema.parse(await (await api.getAvailability(req("GET", path), event.id)).json());
    expect(first.tables[0]).toEqual({ id: a1.id, free: 6, freeSeats: [3, 4, 5, 6, 7, 8] });
    for (const row of first.tables) expect(row.free).toBe(row.freeSeats.length);

    await expireOrder(db, h.orderId);
    t = 3000;
    const fresh = availabilitySchema.parse(await (await api.getAvailability(req("GET", path), event.id)).json());
    expect(fresh.tables[0]).toEqual({ id: a1.id, free: 8, freeSeats: [1, 2, 3, 4, 5, 6, 7, 8] });
  });

  it("yuva numaralarında boşluk olabilir", async () => {
    const { event, tables } = await saleEvent({ tables: [{ capacity: 4 }] });
    const a1 = tables[0]!;
    await db
      .delete(tableSeatSlots)
      .where(eq(tableSeatSlots.tableId, a1.id))
      .then(async () => {
        await db.insert(tableSeatSlots).values([
          { eventId: event.id, tableId: a1.id, seatNo: 1 },
          { eventId: event.id, tableId: a1.id, seatNo: 3 },
          { eventId: event.id, tableId: a1.id, seatNo: 4 },
        ]);
      });
    const detail = eventDetailSchema.parse(
      await (await makeApi().getEvent(req("GET", `/x/${event.id}`), event.id)).json(),
    );
    expect(detail.plan.tables[0]?.seatNos).toEqual([1, 3, 4]);
    const avail = availabilitySchema.parse(
      await (await makeApi().getAvailability(req("GET", `/x/${event.id}/availability`), event.id)).json(),
    );
    expect(avail.tables[0]).toEqual({ id: a1.id, free: 3, freeSeats: [1, 3, 4] });
  });
});
