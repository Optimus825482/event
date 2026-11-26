import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/notifications/publish", () => ({ publishNotifications: vi.fn(async () => {}) }));

import { db } from "@/db/client";
import { events, notifications } from "@/db/schema";
import type { PlanningStage } from "@/domain/planning-stage";
import { ForbiddenError } from "@/features/auth/errors";
import type { Actor } from "@/features/auth/session";
import { publishNotifications } from "@/features/notifications/publish";
import { planningActionDefs } from "@/features/planning/action-defs";
import { stageTransitionSchema } from "@/features/planning/schemas";
import { getPlanningState, transitionStage } from "@/features/planning/stage-service";
import { createAction, DomainError } from "@/lib/action";
import { adminActor, managerActor, noAccessActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { listTransitions, setStage } from "../../helpers/planning";

async function eventWithTable(o: Parameters<typeof f.createEvent>[1] = {}) {
  const event = await f.createEvent(db, o);
  await f.createTable(db, event.id);
  return event;
}

async function stageOf(eventId: string): Promise<PlanningStage> {
  const [row] = await db.select({ stage: events.planningStage }).from(events).where(eq(events.id, eventId));
  return row!.stage;
}

async function notificationsOf(eventId: string) {
  return db.select().from(notifications).where(eq(notifications.eventId, eventId));
}

async function expectDomain(promise: Promise<unknown>, code: DomainError["code"], message: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DomainError);
  expect(error).toMatchObject({ code, message });
}

async function expectNothingWritten(eventId: string, stage: PlanningStage) {
  expect(await stageOf(eventId)).toBe(stage);
  expect(await listTransitions(db, eventId)).toHaveLength(0);
  expect(await notificationsOf(eventId)).toHaveLength(0);
}

describe("transitionStage", () => {
  let fnb: Actor;
  let ent: Actor;

  beforeEach(async () => {
    await truncateAll();
    fnb = await persistActor(db, managerActor("fnb"));
    ent = await persistActor(db, managerActor("entertainment"));
  });

  it("ileri ve yeniden açma geçişlerinde gelen not saklanmaz; yalnızca geri almada saklanır", async () => {
    const event = await eventWithTable();
    await transitionStage(db, fnb, { eventId: event.id, expected: "defined", kind: "advance", note: "gizli not" });
    expect((await listTransitions(db, event.id))[0]?.note).toBeNull();

    const closed = await eventWithTable({ status: "published" });
    await setStage(db, closed.id, "sales_closed");
    await transitionStage(db, ent, { eventId: closed.id, expected: "sales_closed", kind: "reopen", note: "gizli not" });
    expect((await listTransitions(db, closed.id))[0]?.note).toBeNull();
    const [notification] = await notificationsOf(closed.id);
    expect(notification?.message).not.toContain("gizli not");

    await setStage(db, event.id, "staffing_ready");
    await transitionStage(db, fnb, { eventId: event.id, expected: "staffing_ready", kind: "revert", note: "Masa sayısı değişti" });
    expect((await listTransitions(db, event.id))[0]?.note).toBe("Masa sayısı değişti");
  });

  it("F&B yöneticisi yerleşimi hazır işaretler; tek geçmiş satırı ve F&B kitleli tek bildirim", async () => {
    const event = await eventWithTable();
    const result = await transitionStage(db, fnb, { eventId: event.id, expected: "defined", kind: "advance" });

    expect(result).toMatchObject({ eventId: event.id, stage: "layout_ready" });
    expect(result.notification).toMatchObject({ type: "venue_layout_completed", audience: "fnb", eventId: event.id });
    expect(await stageOf(event.id)).toBe("layout_ready");
    const [row] = await db.select({ at: events.stageChangedAt }).from(events).where(eq(events.id, event.id));
    expect(row?.at).toBeInstanceOf(Date);

    const transitions = await listTransitions(db, event.id);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({ fromStage: "defined", toStage: "layout_ready", kind: "advance", actorId: fnb.id });

    const rows = await notificationsOf(event.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "venue_layout_completed", audience: "fnb", eventId: event.id });
  });

  it("Entertainment yöneticisi yerleşimi hazır işaretleyemez", async () => {
    const event = await eventWithTable();
    await expect(
      transitionStage(db, ent, { eventId: event.id, expected: "defined", kind: "advance" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expectNothingWritten(event.id, "defined");
  });

  it("masasız etkinlikte yerleşim hazır → conflict 'Yerleşimde en az bir masa olmalı'", async () => {
    const event = await f.createEvent(db);
    await expectDomain(
      transitionStage(db, fnb, { eventId: event.id, expected: "defined", kind: "advance" }),
      "conflict",
      "Yerleşimde en az bir masa olmalı",
    );
    await expectNothingWritten(event.id, "defined");
  });

  it("yetkisiz aktör önkoşul mesajı görmez", async () => {
    const event = await f.createEvent(db);
    const casino = await persistActor(db, managerActor("casino"));
    await expect(
      transitionStage(db, casino, { eventId: event.id, expected: "defined", kind: "advance" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("beklenen aşama güncel değilse conflict ve hiçbir şey yazılmaz", async () => {
    const event = await eventWithTable();
    await setStage(db, event.id, "layout_ready");
    await expectDomain(
      transitionStage(db, fnb, { eventId: event.id, expected: "defined", kind: "advance" }),
      "conflict",
      "Aşama başka bir kullanıcı tarafından değiştirildi; sayfayı yenileyin",
    );
    await expectNothingWritten(event.id, "layout_ready");
  });

  it("olmayan etkinlik → not_found", async () => {
    await expectDomain(
      transitionStage(db, fnb, { eventId: crypto.randomUUID(), expected: "defined", kind: "advance" }),
      "not_found",
      "Etkinlik bulunamadı",
    );
  });

  it("eşzamanlı iki ilerletme: biri başarılı, diğeri conflict; tek bildirim", async () => {
    const event = await eventWithTable();
    const other = await persistActor(db, managerActor("fnb"));
    const results = await Promise.allSettled([
      transitionStage(db, fnb, { eventId: event.id, expected: "defined", kind: "advance" }),
      transitionStage(db, other, { eventId: event.id, expected: "defined", kind: "advance" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ code: "conflict" });
    expect(await stageOf(event.id)).toBe("layout_ready");
    expect(await listTransitions(db, event.id)).toHaveLength(1);
    expect(await notificationsOf(event.id)).toHaveLength(1);
  });

  it("geri alma nedeni zorunlu", () => {
    const base = { eventId: crypto.randomUUID(), expected: "staffing_ready" };
    for (const note of ["  ", undefined]) {
      const parsed = stageTransitionSchema.safeParse({ ...base, kind: "revert", note });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues).toContainEqual(
          expect.objectContaining({ path: ["note"], message: "Geri alma nedeni gerekli" }),
        );
      }
    }
    expect(stageTransitionSchema.safeParse({ ...base, kind: "advance" }).success).toBe(true);
  });

  it("geri alma önceki aşamaya döner, bildirim geri alınan aşamanın kitlesine gider", async () => {
    const event = await eventWithTable();
    await setStage(db, event.id, "staffing_ready");
    const result = await transitionStage(db, fnb, {
      eventId: event.id,
      expected: "staffing_ready",
      kind: "revert",
      note: "Masa sayısı değişti",
    });

    expect(result.stage).toBe("layout_ready");
    expect(await stageOf(event.id)).toBe("layout_ready");
    expect(result.notification).toMatchObject({ type: "planning_stage_reverted", audience: "entertainment" });
    const [transition] = await listTransitions(db, event.id);
    expect(transition).toMatchObject({
      fromStage: "staffing_ready",
      toStage: "layout_ready",
      kind: "revert",
      note: "Masa sayısı değişti",
    });
  });

  it("satıştaki etkinlik geri alınamaz → invalid 'Bu aşama geçişi yapılamaz'", async () => {
    const event = await eventWithTable({ status: "published" });
    await setStage(db, event.id, "on_sale");
    await expectDomain(
      transitionStage(db, ent, { eventId: event.id, expected: "on_sale", kind: "revert", note: "Neden" }),
      "invalid",
      "Bu aşama geçişi yapılamaz",
    );
    await expectNothingWritten(event.id, "on_sale");
  });

  it("taslak etkinlikte satış açılamaz → conflict 'Satış yalnızca yayımlanmış ya da aktif etkinlikte açılabilir'", async () => {
    const event = await eventWithTable();
    await setStage(db, event.id, "priced");
    await expectDomain(
      transitionStage(db, ent, { eventId: event.id, expected: "priced", kind: "advance" }),
      "conflict",
      "Satış yalnızca yayımlanmış ya da aktif etkinlikte açılabilir",
    );
    await expectNothingWritten(event.id, "priced");
  });

  it("iptal edilmiş etkinlikte aşama değişmez → conflict; bildirim yok", async () => {
    const event = await eventWithTable({ status: "cancelled" });
    await expectDomain(
      transitionStage(db, fnb, { eventId: event.id, expected: "defined", kind: "advance" }),
      "conflict",
      "Tamamlanmış veya iptal edilmiş etkinliğin aşaması değiştirilemez",
    );
    await expectNothingWritten(event.id, "defined");
  });

  it("satış kapalıyken yeniden açma: on_sale, herkese sales_opened", async () => {
    const event = await eventWithTable({ status: "active" });
    await setStage(db, event.id, "sales_closed");
    const result = await transitionStage(db, ent, { eventId: event.id, expected: "sales_closed", kind: "reopen" });

    expect(result.stage).toBe("on_sale");
    expect(result.notification).toMatchObject({ type: "sales_opened", audience: "all", priority: "high" });
    const [transition] = await listTransitions(db, event.id);
    expect(transition).toMatchObject({ fromStage: "sales_closed", toStage: "on_sale", kind: "reopen" });
  });

  it("personel planı hazır önkoşulu: masa grubu yoksa conflict 'En az bir masa grubu oluşturulmalı'", async () => {
    const event = await eventWithTable();
    await setStage(db, event.id, "layout_ready");
    await expectDomain(
      transitionStage(db, fnb, { eventId: event.id, expected: "layout_ready", kind: "advance" }),
      "conflict",
      "En az bir masa grubu oluşturulmalı",
    );
    await f.createTableGroup(db, event.id);
    const result = await transitionStage(db, fnb, { eventId: event.id, expected: "layout_ready", kind: "advance" });
    expect(result.stage).toBe("staffing_ready");
    expect(result.notification).toMatchObject({ type: "team_organization_completed", audience: "entertainment" });
  });
});

describe("getPlanningState", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("getPlanningState: geçmiş en yeni önce, aktörün izinli geçişleri ve engeller", async () => {
    const fnb = await persistActor(db, managerActor("fnb"));
    const empty = await f.createEvent(db, { name: "Yılbaşı Galası" });
    const state = await getPlanningState(db, fnb, empty.id);
    expect(state).toMatchObject({
      eventId: empty.id,
      eventName: "Yılbaşı Galası",
      stage: "defined",
      stageChangedAt: null,
      history: [],
      allowed: [{ kind: "advance", to: "layout_ready" }],
      blockers: ["Yerleşimde en az bir masa olmalı"],
    });

    await expect(getPlanningState(db, noAccessActor(), empty.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getPlanningState(db, fnb, crypto.randomUUID())).rejects.toMatchObject({ code: "not_found" });
  });

  it("geçmiş en yeni önce sıralanır ve aktör adını taşır", async () => {
    const admin = await persistActor(db, adminActor());
    const event = await eventWithTable();
    await f.createTableGroup(db, event.id);
    await transitionStage(db, admin, { eventId: event.id, expected: "defined", kind: "advance" });
    await transitionStage(db, admin, { eventId: event.id, expected: "layout_ready", kind: "advance" });
    await transitionStage(db, admin, {
      eventId: event.id,
      expected: "staffing_ready",
      kind: "revert",
      note: "Masa sayısı değişti",
    });

    const state = await getPlanningState(db, admin, event.id);
    expect(state.stage).toBe("layout_ready");
    expect(state.stageChangedAt).not.toBeNull();
    expect(state.history.map((h) => [h.kind, h.from, h.to])).toEqual([
      ["revert", "staffing_ready", "layout_ready"],
      ["advance", "layout_ready", "staffing_ready"],
      ["advance", "defined", "layout_ready"],
    ]);
    expect(state.history[0]).toMatchObject({ note: "Masa sayısı değişti", actorName: expect.any(String) });
    expect(typeof state.history[0]?.at).toBe("string");
    expect(state.blockers).toEqual([]);
    expect(state.allowed).toEqual([
      { kind: "advance", to: "staffing_ready" },
      { kind: "revert", to: "defined" },
    ]);
  });
});

describe("transitionStageAction", () => {
  beforeEach(async () => {
    await truncateAll();
    vi.mocked(publishNotifications).mockClear();
  });

  function actionFor(actor: Actor | null) {
    const { defineAction } = createAction({ getActor: async () => actor });
    return defineAction(planningActionDefs.transition);
  }

  it("eylem: başarılı geçişte bildirim yayılır", async () => {
    const fnb = await persistActor(db, managerActor("fnb"));
    const event = await eventWithTable();
    const result = await actionFor(fnb)({ eventId: event.id, expected: "defined", kind: "advance" });

    expect(result).toEqual({ ok: true, data: { eventId: event.id, stage: "layout_ready" } });
    expect(publishNotifications).toHaveBeenCalledTimes(1);
    const [rows] = vi.mocked(publishNotifications).mock.calls[0]!;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ audience: "fnb", type: "venue_layout_completed" });
  });

  it("eylem: yetkisiz ve hatalı geçişte bildirim yayılmaz", async () => {
    const event = await eventWithTable();
    expect(await actionFor(noAccessActor())({ eventId: event.id, expected: "defined", kind: "advance" })).toMatchObject({
      ok: false,
      code: "forbidden",
    });
    const ent = await persistActor(db, managerActor("entertainment"));
    expect(await actionFor(ent)({ eventId: event.id, expected: "defined", kind: "advance" })).toMatchObject({
      ok: false,
      code: "forbidden",
    });
    const fnb = await persistActor(db, managerActor("fnb"));
    expect(await actionFor(fnb)({ eventId: event.id, expected: "layout_ready", kind: "advance" })).toMatchObject({
      ok: false,
      code: "conflict",
    });
    expect(publishNotifications).not.toHaveBeenCalled();
  });
});
