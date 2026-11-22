import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { eventActionDefs } from "@/features/events/action-defs";
import { createEventSchema, updateEventSchema } from "@/features/events/schemas";
import { createAction } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

async function makeActor(role: Role): Promise<Actor> {
  const u = await f.createUser(db, { role });
  return { id: u.id, username: u.username, role: u.role, staffId: u.staffId };
}

function actionsFor(actor: Actor | null) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return {
    create: defineAction(eventActionDefs.create),
    update: defineAction(eventActionDefs.update),
    changeStatus: defineAction(eventActionDefs.changeStatus),
    remove: defineAction(eventActionDefs.remove),
  };
}

function inDays(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

describe("events actions", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("staff rolü etkinlik oluşturamaz", async () => {
    const actor = await makeActor("staff");
    const res = await actionsFor(actor).create({ name: "X", startsAt: inDays(3) });
    expect(res).toMatchObject({ ok: false, code: "forbidden" });
    expect(await db.select().from(events)).toHaveLength(0);
  });

  it("organizatör oluşturur", async () => {
    const actor = await makeActor("organizer");
    const res = await actionsFor(actor).create({ name: "X", startsAt: inDays(3).toISOString() });
    expect(res.ok).toBe(true);
    expect(await db.select().from(events)).toHaveLength(1);
  });

  it("bitiş <= başlangıç invalid ve endsAt alanında hata verir", async () => {
    const actor = await makeActor("organizer");
    const start = inDays(3);
    for (const end of [start, new Date(start.getTime() - 3_600_000)]) {
      const res = await actionsFor(actor).create({
        name: "X",
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      });
      expect(res).toMatchObject({ ok: false, code: "invalid" });
      if (!res.ok) expect(res.fieldErrors?.endsAt?.length).toBeGreaterThan(0);
    }
    expect(await db.select().from(events)).toHaveLength(0);
  });

  it("geçmişte başlangıç oluşturmada invalid", async () => {
    const actor = await makeActor("organizer");
    const res = await actionsFor(actor).create({ name: "X", startsAt: inDays(-1).toISOString() });
    expect(res).toMatchObject({ ok: false, code: "invalid" });
    if (!res.ok) expect(res.fieldErrors?.startsAt?.length).toBeGreaterThan(0);
  });

  it("güncellemede geçmiş başlangıca izin verilir, bitiş <= başlangıç yine invalid", async () => {
    const actor = await makeActor("organizer");
    const ev = await f.createEvent(db, { organizerId: actor.id });
    const past = inDays(-2);
    const ok = await actionsFor(actor).update({ id: ev.id, name: "Y", startsAt: past.toISOString() });
    expect(ok.ok).toBe(true);
    const bad = await actionsFor(actor).update({
      id: ev.id,
      name: "Y",
      startsAt: past.toISOString(),
      endsAt: past.toISOString(),
    });
    expect(bad).toMatchObject({ ok: false, code: "invalid" });
  });

  it("geçersiz geçiş conflict olarak döner", async () => {
    const actor = await makeActor("organizer");
    const ev = await f.createEvent(db, { organizerId: actor.id, status: "completed" });
    const res = await actionsFor(actor).changeStatus({ id: ev.id, status: "draft" });
    expect(res).toMatchObject({ ok: false, code: "conflict" });
  });

  it("rezervasyonlu etkinlik silme conflict döner", async () => {
    const actor = await makeActor("organizer");
    const ev = await f.createEvent(db, { organizerId: actor.id });
    const table = await f.createTable(db, ev.id);
    const customer = await f.createCustomer(db);
    await f.createReservation(db, { eventId: ev.id, tableId: table.id, customerId: customer.id });
    const res = await actionsFor(actor).remove({ id: ev.id });
    expect(res).toMatchObject({ ok: false, code: "conflict" });
  });

  it("oturumsuz çağrı unauthenticated", async () => {
    const res = await actionsFor(null).remove({ id: crypto.randomUUID() });
    expect(res).toMatchObject({ ok: false, code: "unauthenticated" });
  });
});

describe("events schemas", () => {
  it("boş ad reddedilir; ad kırpılır", () => {
    expect(createEventSchema.safeParse({ name: "  ", startsAt: inDays(1) }).success).toBe(false);
    const ok = createEventSchema.safeParse({ name: "  Gala ", startsAt: inDays(1) });
    expect(ok.success && ok.data.name).toBe("Gala");
  });

  it("boş string bitiş/açıklama yok sayılır", () => {
    const res = updateEventSchema.safeParse({
      id: crypto.randomUUID(),
      name: "A",
      startsAt: inDays(1),
      endsAt: "",
      description: "",
    });
    expect(res.success && res.data.endsAt).toBeUndefined();
  });
});
