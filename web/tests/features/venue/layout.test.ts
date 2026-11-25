import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { assignmentTables, eventTables, events, tableGroupTables, tableTypes } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { listEventTables, totalCapacity } from "@/features/events/service";
import type { TableInput } from "@/features/venue/schemas";
import { getVenueLayout, saveLayout } from "@/features/venue/service";
import { DomainError } from "@/lib/action";
import { pgCodeOf } from "@/lib/pg-error";
import { adminActor, managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

async function makeActor(actor: Actor = managerActor("fnb")): Promise<Actor> {
  return persistActor(db, actor);
}

async function caught(promise: Promise<unknown>): Promise<DomainError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  return err as DomainError;
}

function grid(count: number, prefix = "M"): TableInput[] {
  return Array.from({ length: count }, (_, i) => ({
    label: `${prefix}${i + 1}`,
    capacity: 8,
    x: (i % 20) * 60,
    y: Math.floor(i / 20) * 60,
  }));
}

const decor = {
  width: 1600,
  height: 900,
  elements: [{ id: "stage-1", kind: "stage" as const, x: 10, y: 10, width: 300, height: 80, label: "Sahne" }],
};

async function setup(actor?: Actor) {
  actor = await makeActor(actor);
  const event = await f.createEvent(db, { organizerId: actor.id });
  return { actor, event };
}

describe("saveLayout", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("200 masalık yerleşimi tek seferde kaydeder; kapasite ve dekor senkron", async () => {
    const { actor, event } = await setup();
    const result = await saveLayout(db, actor, { eventId: event.id, tables: grid(200), decor });
    expect(result.tables).toHaveLength(200);
    expect(result.totalCapacity).toBe(1600);
    const [row] = await db.select().from(events).where(eq(events.id, event.id));
    expect(row?.totalCapacity).toBe(1600);
    expect(row?.layoutDecor).toMatchObject({ width: 1600, elements: [{ id: "stage-1", label: "Sahne" }] });
    expect(await totalCapacity(db, event.id)).toBe(1600);
  });

  it("200 masalık kayıt atomik: tek hatalı masa tümünü geri alır", async () => {
    const { actor, event } = await setup();
    const first = await saveLayout(db, actor, { eventId: event.id, tables: grid(200), decor });
    const moved = first.tables.map((t) => ({ ...t, x: t.x + 5 }));
    const badType = crypto.randomUUID();
    const input = [...moved, { label: "Yeni", capacity: 4, x: 0, y: 0, tableTypeId: badType }];
    const err = await caught(saveLayout(db, actor, { eventId: event.id, tables: input, decor: { elements: [] } }));
    expect(err.code).toBe("not_found");
    const after = await listEventTables(db, event.id);
    expect(after).toHaveLength(200);
    const byId = new Map(first.tables.map((t) => [t.id, t.x]));
    for (const t of after) expect(t.x).toBe(byId.get(t.id));
    const [row] = await db.select().from(events).where(eq(events.id, event.id));
    expect(row?.layoutDecor).toMatchObject({ elements: [{ id: "stage-1" }] });
  });

  it("id'ye göre fark alır: günceller, ekler, siler", async () => {
    const { actor, event } = await setup();
    const first = await saveLayout(db, actor, { eventId: event.id, tables: grid(3), decor });
    const [a, b] = first.tables;
    if (!a || !b) throw new Error("masa yok");
    const res = await saveLayout(db, actor, {
      eventId: event.id,
      tables: [
        { id: a.id, label: "A1", capacity: 10, x: 100, y: 200, rotation: 45, isLoca: true },
        { id: b.id, label: b.label, capacity: b.capacity, x: b.x, y: b.y },
        { label: "Yeni", capacity: 2, x: 5, y: 5 },
      ],
      decor,
    });
    expect(res.tables.map((t) => t.label).sort()).toEqual(["A1", "M2", "Yeni"]);
    const updated = res.tables.find((t) => t.id === a.id);
    expect(updated).toMatchObject({ label: "A1", capacity: 10, x: 100, y: 200, rotation: 45, isLoca: true });
    expect(res.totalCapacity).toBe(10 + 8 + 2);
  });

  it("etiket takası (M1<->M2) tekillik kısıtına takılmaz", async () => {
    const { actor, event } = await setup();
    const first = await saveLayout(db, actor, { eventId: event.id, tables: grid(2), decor });
    const swapped = first.tables.map((t) => ({ ...t, label: t.label === "M1" ? "M2" : "M1" }));
    const res = await saveLayout(db, actor, { eventId: event.id, tables: swapped, decor });
    const before = new Map(first.tables.map((t) => [t.id, t.label]));
    for (const t of res.tables) expect(t.label).not.toBe(before.get(t.id));
  });

  it("silinen masanın etiketi yeni masaya verilebilir", async () => {
    const { actor, event } = await setup();
    await saveLayout(db, actor, { eventId: event.id, tables: grid(1), decor });
    const res = await saveLayout(db, actor, { eventId: event.id, tables: [{ label: "M1", capacity: 4, x: 1, y: 1 }], decor });
    expect(res.tables).toHaveLength(1);
    expect(res.tables[0]?.capacity).toBe(4);
  });

  it("rezervasyonlu masa silinmek istenirse tümü reddedilir, etiketler mesajda, hiçbir şey yazılmaz", async () => {
    const { actor, event } = await setup();
    const first = await saveLayout(db, actor, { eventId: event.id, tables: grid(3), decor });
    const [m1, m2, m3] = first.tables;
    if (!m1 || !m2 || !m3) throw new Error("masa yok");
    const customer = await f.createCustomer(db);
    await f.createReservation(db, { eventId: event.id, tableId: m1.id, customerId: customer.id, status: "cancelled" });
    await f.createReservation(db, { eventId: event.id, tableId: m2.id, customerId: customer.id });

    const err = await caught(
      saveLayout(db, actor, {
        eventId: event.id,
        tables: [{ ...m3, x: 999 }, { label: "Yeni", capacity: 4, x: 0, y: 0 }],
        decor: { elements: [] },
      }),
    );
    expect(err.code).toBe("conflict");
    expect(err.message).toContain(m1.label);
    expect(err.message).toContain(m2.label);
    expect(err.message).not.toContain(m3.label);

    const after = await listEventTables(db, event.id);
    expect(after.map((t) => t.label)).toEqual(["M1", "M2", "M3"]);
    expect(after.find((t) => t.id === m3.id)?.x).toBe(m3.x);
    const [row] = await db.select().from(events).where(eq(events.id, event.id));
    expect(row?.totalCapacity).toBe(24);
    expect(row?.layoutDecor).toMatchObject({ elements: [{ id: "stage-1" }] });
  });

  it("personel ataması veya masa grubu olan masa da silinemez", async () => {
    const { actor, event } = await setup();
    const first = await saveLayout(db, actor, { eventId: event.id, tables: grid(2), decor });
    const [m1, m2] = first.tables;
    if (!m1 || !m2) throw new Error("masa yok");
    const staffRow = await f.createStaff(db);
    const assignment = await f.createAssignment(db, { eventId: event.id, staffId: staffRow.id });
    await db.insert(assignmentTables).values({ eventId: event.id, assignmentId: assignment.id, tableId: m1.id });
    const group = await f.createTableGroup(db, event.id);
    await db.insert(tableGroupTables).values({ eventId: event.id, tableGroupId: group.id, tableId: m2.id });

    const err = await caught(saveLayout(db, actor, { eventId: event.id, tables: [], decor }));
    expect(err.code).toBe("conflict");
    expect(err.message).toContain("M1");
    expect(err.message).toContain("M2");
    expect(await listEventTables(db, event.id)).toHaveLength(2);
  });

  it("rezervasyonlu masa taşınabilir ve yeniden etiketlenebilir", async () => {
    const { actor, event } = await setup();
    const first = await saveLayout(db, actor, { eventId: event.id, tables: grid(1), decor });
    const m1 = first.tables[0];
    if (!m1) throw new Error("masa yok");
    const customer = await f.createCustomer(db);
    await f.createReservation(db, { eventId: event.id, tableId: m1.id, customerId: customer.id });
    const res = await saveLayout(db, actor, {
      eventId: event.id,
      tables: [{ ...m1, label: "VIP-1", x: 300 }],
      decor,
    });
    expect(res.tables[0]).toMatchObject({ id: m1.id, label: "VIP-1", x: 300 });
  });

  it("yinelenen etiket (büyük/küçük harf ve boşluk duyarsız) reddedilir, hiçbir şey yazılmaz", async () => {
    const { actor, event } = await setup();
    const err = await caught(
      saveLayout(db, actor, {
        eventId: event.id,
        tables: [
          { label: "A1", capacity: 4, x: 0, y: 0 },
          { label: " a1 ", capacity: 4, x: 50, y: 0 },
        ],
        decor,
      }),
    );
    expect(err.code).toBe("conflict");
    expect(err.message).toContain("A1");
    expect(await listEventTables(db, event.id)).toHaveLength(0);
  });

  it("kapasite 0 reddedilir", async () => {
    const { actor, event } = await setup();
    const err = await caught(
      saveLayout(db, actor, { eventId: event.id, tables: [{ label: "A1", capacity: 0, x: 0, y: 0 }], decor }),
    );
    expect(err.code).toBe("conflict");
    expect(err.message).toContain("A1");
    expect(await listEventTables(db, event.id)).toHaveLength(0);
  });

  it("başka etkinliğin masa kimliği not_found", async () => {
    const { actor, event } = await setup();
    const other = await f.createEvent(db, { organizerId: actor.id });
    const foreign = await f.createTable(db, other.id);
    const err = await caught(
      saveLayout(db, actor, { eventId: event.id, tables: [{ ...foreign, label: "X" }], decor }),
    );
    expect(err.code).toBe("not_found");
    const [still] = await db.select().from(eventTables).where(eq(eventTables.id, foreign.id));
    expect(still?.label).toBe(foreign.label);
  });

  it("tamamlanmış ve iptal edilmiş etkinlikte yerleşim değiştirilemez", async () => {
    const actor = await makeActor();
    for (const status of ["completed", "cancelled"] as const) {
      const event = await f.createEvent(db, { organizerId: actor.id, status });
      const err = await caught(saveLayout(db, actor, { eventId: event.id, tables: grid(1), decor }));
      expect(err.code).toBe("conflict");
    }
  });

  it("başka bir F&B yöneticisi ve admin başkasının oluşturduğu etkinliğe kaydeder", async () => {
    const { event } = await setup();
    const other = await makeActor(managerActor("fnb"));
    expect((await saveLayout(db, other, { eventId: event.id, tables: grid(1), decor })).tables).toHaveLength(1);
    const admin = await makeActor(adminActor());
    const res = await saveLayout(db, admin, { eventId: event.id, tables: grid(1), decor });
    expect(res.tables).toHaveLength(1);
  });

  it("masa tipini kaydeder; dönüşü 0-360 aralığına indirger", async () => {
    const { actor, event } = await setup();
    const [type] = await db.insert(tableTypes).values({ name: "VIP", capacity: 12 }).returning();
    const res = await saveLayout(db, actor, {
      eventId: event.id,
      tables: [{ label: "V1", capacity: 12, x: 0, y: 0, rotation: -90, tableTypeId: type?.id ?? null }],
      decor,
    });
    expect(res.tables[0]).toMatchObject({ tableTypeId: type?.id, rotation: 270 });
  });
});

describe("masa nitelikleri", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  const attrs = { isVip: true, isPinned: true, size: 62.5, floor: 4, sortNumber: 17 };

  it("eklenirken ve güncellenirken kaydedilir; getVenueLayout aynısını döner", async () => {
    const { actor, event } = await setup();
    const created = await saveLayout(db, actor, {
      eventId: event.id,
      tables: [
        { label: "A", capacity: 4, x: 1, y: 2, ...attrs },
        { label: "B", capacity: 4, x: 3, y: 4 },
      ],
      decor,
    });
    const a = created.tables.find((t) => t.label === "A");
    const b = created.tables.find((t) => t.label === "B");
    expect(a).toMatchObject(attrs);
    expect(b).toMatchObject({ isVip: false, isPinned: false, size: null, floor: 1, sortNumber: null });

    const updated = await saveLayout(db, actor, {
      eventId: event.id,
      tables: [
        { id: a?.id, label: "A", capacity: 4, x: 1, y: 2, isVip: false, isPinned: false, size: null, floor: 2, sortNumber: null },
        { id: b?.id, label: "B", capacity: 4, x: 3, y: 4, ...attrs },
      ],
      decor,
    });
    expect(updated.tables.find((t) => t.label === "A")).toMatchObject({ isVip: false, isPinned: false, size: null, floor: 2, sortNumber: null });
    expect(updated.tables.find((t) => t.label === "B")).toMatchObject(attrs);

    const loaded = await getVenueLayout(db, actor, event.id);
    expect(loaded.tables.find((t) => t.label === "B")).toMatchObject(attrs);
  });

  it("yükle → kaydet döngüsü nitelikleri kaybetmez", async () => {
    const { actor, event } = await setup();
    await saveLayout(db, actor, { eventId: event.id, tables: [{ label: "A", capacity: 4, x: 0, y: 0, ...attrs }], decor });
    const loaded = (await getVenueLayout(db, actor, event.id)).tables[0];
    if (!loaded) throw new Error("masa yok");
    const again = await saveLayout(db, actor, {
      eventId: event.id,
      tables: [
        {
          id: loaded.id,
          label: loaded.label,
          capacity: loaded.capacity,
          x: loaded.x,
          y: loaded.y,
          isVip: loaded.isVip,
          isPinned: loaded.isPinned,
          size: loaded.size,
          floor: loaded.floor,
          sortNumber: loaded.sortNumber,
        },
      ],
      decor,
    });
    expect(again.tables[0]).toMatchObject({ id: loaded.id, ...attrs });
  });

  it("kat 1..9 dışı servis katmanında reddedilir, hiçbir şey yazılmaz", async () => {
    const { actor, event } = await setup();
    for (const floor of [0, 10, 2.5]) {
      const err = await caught(
        saveLayout(db, actor, { eventId: event.id, tables: [{ label: "A", capacity: 4, x: 0, y: 0, floor }], decor }),
      );
      expect(err.code).toBe("conflict");
      expect(err.message).toContain("Kat 1 ile 9 arasında");
    }
    expect(await listEventTables(db, event.id)).toHaveLength(0);
  });

  it("veritabanı kısıtı kat 1..9 dışını reddeder (23514)", async () => {
    const { event } = await setup();
    const insert = (floor: number) =>
      db.insert(eventTables).values({ eventId: event.id, label: `K${floor}`, capacity: 4, floor });
    for (const bad of [0, 10]) {
      const err: unknown = await insert(bad).then(
        () => null,
        (e: unknown) => e,
      );
      expect(pgCodeOf(err)).toBe("23514");
    }
    await expect(insert(9)).resolves.toBeDefined();
    await expect(insert(1)).resolves.toBeDefined();
  });
});

describe("getVenueLayout", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("masaları, dekoru, kullanımdaki masaları ve düzenlenebilirliği döner", async () => {
    const { actor, event } = await setup();
    const saved = await saveLayout(db, actor, { eventId: event.id, tables: grid(2), decor });
    const m1 = saved.tables[0];
    if (!m1) throw new Error("masa yok");
    const customer = await f.createCustomer(db);
    await f.createReservation(db, { eventId: event.id, tableId: m1.id, customerId: customer.id });
    const layout = await getVenueLayout(db, actor, event.id);
    expect(layout.tables).toHaveLength(2);
    expect(layout.decor.width).toBe(1600);
    expect(layout.lockedTableIds).toEqual([m1.id]);
    expect(layout.editable).toBe(true);
    expect(layout.totalCapacity).toBe(16);
  });

  it("bozuk dekor JSON'u boş dekora düşer", async () => {
    const { actor, event } = await setup();
    await db.update(events).set({ layoutDecor: { placedTables: "x" } }).where(eq(events.id, event.id));
    const layout = await getVenueLayout(db, actor, event.id);
    expect(layout.decor.elements).toEqual([]);
  });

  it("olmayan etkinlik not_found", async () => {
    const { actor } = await setup();
    expect((await caught(getVenueLayout(db, actor, crypto.randomUUID()))).code).toBe("not_found");
  });
});
