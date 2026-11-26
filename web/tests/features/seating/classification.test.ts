import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { eventTables, tableSeatSlots } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import * as layoutLock from "@/features/planning/layout-lock";
import { seatingActionDefs } from "@/features/seating/action-defs";
import { classifyTables } from "@/features/seating/classification-service";
import { classifyTablesSchema } from "@/features/seating/schemas";
import { createAction } from "@/lib/action";
import { managerActor, memberActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { setStage } from "../../helpers/planning";
import { openOnline, setAllocation } from "../../helpers/seating";
import { watchEvents } from "../realtime/emitted";

async function setup() {
  const event = await f.createEvent(db);
  const actor = await persistActor(db, managerActor("entertainment"));
  const mk = (label: string, o: Record<string, unknown> = {}) =>
    f.createTable(db, event.id, { label, capacity: 8, allocation: "pending", ...o });
  return { event, actor, mk };
}

async function row(id: string) {
  const [r] = await db.select().from(eventTables).where(eq(eventTables.id, id));
  if (!r) throw new Error("masa yok");
  return r;
}

const slotCount = async (id: string) =>
  (await db.select().from(tableSeatSlots).where(eq(tableSeatSlots.tableId, id))).length;

describe("masa sınıflandırma", () => {
  beforeEach(async () => {
    await truncateAll();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tek masa VIP yapılır ve satılabilir sandalye 6'ya iner", async () => {
    const { event, actor, mk } = await setup();
    const t = await mk("A1");
    const res = await classifyTables(db, actor, {
      eventId: event.id,
      items: [{ tableId: t.id, category: "vip", sellableSeats: 6 }],
    });
    expect(res).toEqual({ updated: 1 });
    expect(await row(t.id)).toMatchObject({ saleCategory: "vip", sellableSeats: 6 });
  });

  it("toplu: üç masa birlikte Premium olur", async () => {
    const { event, actor, mk } = await setup();
    const ts = [await mk("A1"), await mk("A2"), await mk("A3")];
    const res = await classifyTables(db, actor, {
      eventId: event.id,
      items: ts.map((t) => ({ tableId: t.id, category: "premium" as const })),
    });
    expect(res).toEqual({ updated: 3 });
    for (const t of ts) expect((await row(t.id)).saleCategory).toBe("premium");
  });

  it("sellableSeats null kapasitenin tamamına döner; alan verilmezse satılabilir korunur", async () => {
    const { event, actor, mk } = await setup();
    const t = await mk("A1", { sellableSeats: 6 });
    await classifyTables(db, actor, { eventId: event.id, items: [{ tableId: t.id, category: "vip" }] });
    expect(await row(t.id)).toMatchObject({ saleCategory: "vip", sellableSeats: 6 });
    await classifyTables(db, actor, { eventId: event.id, items: [{ tableId: t.id, sellableSeats: null }] });
    expect((await row(t.id)).sellableSeats).toBeNull();
  });

  it("kapasiteyi aşan satılabilir reddedilir ve hiçbir masa değişmez", async () => {
    const { event, actor, mk } = await setup();
    const a1 = await mk("A1");
    const a2 = await mk("A2");
    await expect(
      classifyTables(db, actor, {
        eventId: event.id,
        items: [
          { tableId: a1.id, sellableSeats: 9 },
          { tableId: a2.id, category: "vip" },
        ],
      }),
    ).rejects.toMatchObject({ code: "conflict", message: "Satılabilir sandalye kapasiteyi aşamaz: A1 (kapasite 8)" });
    expect((await row(a2.id)).saleCategory).toBe("standard");
    expect((await row(a1.id)).sellableSeats).toBeNull();
  });

  it("başka etkinliğin masası not_found", async () => {
    const { event, actor } = await setup();
    const other = await f.createEvent(db);
    const foreign = await f.createTable(db, other.id, { label: "X1", allocation: "pending" });
    await expect(
      classifyTables(db, actor, { eventId: event.id, items: [{ tableId: foreign.id, category: "vip" }] }),
    ).rejects.toMatchObject({ code: "not_found", message: "Masa bu etkinlikte bulunamadı" });
    expect((await row(foreign.id)).saleCategory).toBe("standard");
  });

  it("online masada satılabilir değişince yuvalar eşitlenir", async () => {
    const { event, actor, mk } = await setup();
    const t = await mk("A1");
    await db.transaction((tx) => openOnline(tx, event.id, [t.id]));
    expect(await slotCount(t.id)).toBe(8);
    await classifyTables(db, actor, { eventId: event.id, items: [{ tableId: t.id, sellableSeats: 5 }] });
    expect(await slotCount(t.id)).toBe(5);
    await classifyTables(db, actor, { eventId: event.id, items: [{ tableId: t.id, sellableSeats: null }] });
    expect(await slotCount(t.id)).toBe(8);
  });

  it("casino masası da sınıflandırılır; yuva oluşmaz", async () => {
    const { event, actor, mk } = await setup();
    const t = await mk("C1");
    await setAllocation(db, [t.id], "casino");
    await classifyTables(db, actor, { eventId: event.id, items: [{ tableId: t.id, category: "premium" }] });
    expect((await row(t.id)).saleCategory).toBe("premium");
    expect(await slotCount(t.id)).toBe(0);
  });

  it.each(["casino", "fnb"] as const)("%s yöneticisi sınıflandıramaz", async (dept) => {
    const { event, mk } = await setup();
    const t = await mk("A1");
    const other = await persistActor(db, managerActor(dept));
    await expect(
      classifyTables(db, other, { eventId: event.id, items: [{ tableId: t.id, category: "vip" }] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await row(t.id)).saleCategory).toBe("standard");
  });

  it("Entertainment kullanıcısı: edit izniyle sınıflar, yalnızca view ile sınıflayamaz", async () => {
    const { event, mk } = await setup();
    const t = await mk("A1");
    const editor = await persistActor(db, memberActor("entertainment", { ticketing: "v-e-" }));
    const viewer = await persistActor(db, memberActor("entertainment", { ticketing: "v---" }));
    await expect(
      classifyTables(db, viewer, { eventId: event.id, items: [{ tableId: t.id, category: "vip" }] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await row(t.id)).saleCategory).toBe("standard");
    await classifyTables(db, editor, { eventId: event.id, items: [{ tableId: t.id, category: "vip" }] });
    expect((await row(t.id)).saleCategory).toBe("vip");
  });

  it("iptal edilmiş etkinlikte reddedilir", async () => {
    const event = await f.createEvent(db, { status: "cancelled" });
    const actor = await persistActor(db, managerActor("entertainment"));
    const t = await f.createTable(db, event.id, { label: "A1", allocation: "pending" });
    await expect(
      classifyTables(db, actor, { eventId: event.id, items: [{ tableId: t.id, category: "vip" }] }),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "Tamamlanmış veya iptal edilmiş etkinlikte masalar sınıflandırılamaz",
    });
  });

  it("satıştayken bileti olan masanın kategorisi değişmez, satılabilir sayısı ayrı kuraldır", async () => {
    const { event, actor, mk } = await setup();
    const a1 = await mk("A1");
    await setStage(db, event.id, "on_sale");
    vi.spyOn(layoutLock, "loadCommitments").mockResolvedValue(
      new Map([[a1.id, { tableId: a1.id, reasons: ["ticket"], minCapacity: 3 }]]),
    );
    await expect(
      classifyTables(db, actor, { eventId: event.id, items: [{ tableId: a1.id, category: "vip" }] }),
    ).rejects.toMatchObject({ code: "conflict", message: "Bileti satılmış masanın kategorisi değiştirilemez: A1" });
    expect(
      await classifyTables(db, actor, { eventId: event.id, items: [{ tableId: a1.id, sellableSeats: 6 }] }),
    ).toEqual({ updated: 1 });
    await setStage(db, event.id, "priced");
    expect(
      await classifyTables(db, actor, { eventId: event.id, items: [{ tableId: a1.id, category: "vip" }] }),
    ).toEqual({ updated: 1 });
  });

  it("değişmeyen satır sayılmaz ve olay yayılmaz", async () => {
    const { event, actor, mk } = await setup();
    const t = await mk("A1");
    const watch = await watchEvents(event.id);
    try {
      await watch.discardSetup();
      const res = await classifyTables(db, actor, {
        eventId: event.id,
        items: [{ tableId: t.id, category: "standard", sellableSeats: null }],
      });
      expect(res).toEqual({ updated: 0 });
      expect(await watch.settled()).toEqual([]);
    } finally {
      watch.stop();
    }
  });

  it("tek masa değişince seats.changed masa kimliğiyle, çoklu değişimde kimliksiz yayılır", async () => {
    const { event, actor, mk } = await setup();
    const a = await mk("A1");
    const b = await mk("A2");
    const watch = await watchEvents(event.id);
    try {
      await watch.discardSetup();
      await classifyTables(db, actor, { eventId: event.id, items: [{ tableId: a.id, category: "vip" }] });
      await watch.settled();
      expect(watch.events()).toEqual([{ type: "seats.changed", id: a.id }]);
      await classifyTables(db, actor, {
        eventId: event.id,
        items: [
          { tableId: a.id, category: "premium" },
          { tableId: b.id, category: "premium" },
        ],
      });
      await watch.settled();
      expect(watch.events()).toEqual([{ type: "seats.changed", id: a.id }, { type: "seats.changed" }]);
    } finally {
      watch.stop();
    }
  });

  it("eylem: tekrarlı masa ve boş değişiklik şemada reddedilir", async () => {
    const { event, actor, mk } = await setup();
    const t = await mk("A1");
    const run = createAction({ getActor: async () => actor }).defineAction(seatingActionDefs.classify);
    const dup = await run({
      eventId: event.id,
      items: [
        { tableId: t.id, category: "vip" },
        { tableId: t.id, category: "premium" },
      ],
    });
    expect(dup).toMatchObject({ ok: false, code: "invalid" });
    expect(JSON.stringify(dup)).toContain("Masa iki kez gönderildi");
    const empty = await run({ eventId: event.id, items: [{ tableId: t.id }] });
    expect(empty).toMatchObject({ ok: false, code: "invalid" });
    expect(JSON.stringify(empty)).toContain("Değişiklik belirtilmedi");
    expect(classifyTablesSchema.safeParse({ eventId: event.id, items: [] }).success).toBe(false);
    expect((await row(t.id)).saleCategory).toBe("standard");
  });
});
