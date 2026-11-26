import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { db } from "@/db/client";
import { events, tableGroupTables, tableTypes } from "@/db/schema";
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
    for (const leak of ["Gizli Misafir", "05321112233", "casino", "allocation", "pending", "group", "capacity", "Ekip Gizli"]) {
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
    expect(first.tables).toEqual([{ id: a1.id, free: 3 }]);
    await expireOrder(db, h.orderId);
    const fresh = availabilitySchema.parse(await (await makeApi().getAvailability(req("GET", path), event.id)).json());
    expect(fresh.tables).toEqual([{ id: a1.id, free: 5 }]);
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
});
