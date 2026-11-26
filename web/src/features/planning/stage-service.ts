import { desc, eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventStageTransitions, events, users } from "@/db/schema";
import { planTransition, type PlanningStage, type StageTransitionKind } from "@/domain/planning-stage";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { publish } from "@/features/realtime/publish";
import { getEventOrThrow } from "@/features/events/service";
import { insertNotification, type NotificationRow } from "@/features/notifications/service";
import { DomainError } from "@/lib/action";
import { allowedTransitions, isStageFrozen, ruleFor, type AllowedTransition } from "./allowed";
import { buildStageNotification } from "./notify";
import { checkPreconditions } from "./preconditions";
import type { StageTransitionInput } from "./schemas";

const HISTORY_LIMIT = 20;

const MESSAGES = {
  notFound: "Etkinlik bulunamadı",
  frozen: "Tamamlanmış veya iptal edilmiş etkinliğin aşaması değiştirilemez",
  stale: "Aşama başka bir kullanıcı tarafından değiştirildi; sayfayı yenileyin",
  invalid: "Bu aşama geçişi yapılamaz",
} as const;

async function actorName(ex: Db | Tx, actor: Actor): Promise<string> {
  const [row] = await ex.select({ name: users.name }).from(users).where(eq(users.id, actor.id));
  return row?.name ?? actor.username;
}

/**
 * Aşama geçişi (tek işlem). Etkinlik satırı `FOR UPDATE` ile kilitlenir; eşzamanlı ikinci istek
 * kilidi bekler, ardından `expected` artık tutmadığı için conflict alır (aşama atlanmaz, iki kez
 * ilerlenmez). Yetki önkoşuldan önce denetlenir: yetkisiz aktör önkoşul mesajını görmez.
 * Dönen bildirim satırı, işlem bittikten sonra çağıran tarafından yayılır.
 */
export async function transitionStage(
  db: Db,
  actor: Actor,
  input: StageTransitionInput,
): Promise<{ eventId: string; stage: PlanningStage; notification: NotificationRow }> {
  return db.transaction(async (tx) => {
    const [event] = await tx.select().from(events).where(eq(events.id, input.eventId)).for("update");
    if (!event) throw new DomainError("not_found", MESSAGES.notFound);
    if (isStageFrozen(event.status)) throw new DomainError("conflict", MESSAGES.frozen);
    if (event.planningStage !== input.expected) throw new DomainError("conflict", MESSAGES.stale);

    const from = event.planningStage;
    const to = planTransition(from, input.kind);
    const rule = to ? ruleFor(input.kind, from, to) : null;
    if (!to || !rule) throw new DomainError("invalid", MESSAGES.invalid);

    authorize(actor, rule.module, "edit");

    if (input.kind !== "revert") {
      const blockers = await checkPreconditions(tx, event, to);
      if (blockers.length > 0) throw new DomainError("conflict", blockers.join(" "));
    }

    const now = new Date();
    await tx
      .update(events)
      .set({ planningStage: to, stageChangedAt: now, updatedAt: now })
      .where(eq(events.id, event.id));

    // Not yalnızca geri almada anlamlıdır (gerekçe); ileri/yeniden açmada gelen not saklanmaz.
    const note = input.kind === "revert" && input.note ? input.note : undefined;
    await tx.insert(eventStageTransitions).values({
      eventId: event.id,
      fromStage: from,
      toStage: to,
      kind: input.kind,
      actorId: actor.id,
      note: note ?? null,
    });

    if (to === "on_sale" || to === "sales_closed") {
      await publish(tx, { type: "sales.changed", eventId: event.id });
    }

    const notification = await insertNotification(
      tx,
      buildStageNotification({
        event: { id: event.id, name: event.name },
        from,
        to,
        kind: input.kind,
        actorName: await actorName(tx, actor),
        actorId: actor.id,
        ...(note ? { note } : {}),
      }),
    );
    return { eventId: event.id, stage: to, notification };
  });
}

export type StageHistoryItem = {
  id: string;
  from: PlanningStage;
  to: PlanningStage;
  kind: StageTransitionKind;
  actorName: string | null;
  note: string | null;
  at: string;
};

export type PlanningState = {
  eventId: string;
  eventName: string;
  stage: PlanningStage;
  stageChangedAt: string | null;
  history: StageHistoryItem[];
  allowed: AllowedTransition[];
  blockers: string[];
};

/**
 * Planlama paneli durumu. `history` en yeni önce (en fazla 20); `allowed` aktörün yapabildiği
 * geçişler; `blockers` sıradaki ileri hedefin karşılanmamış önkoşulları (aktörün yetkisinden bağımsız).
 */
export async function getPlanningState(ex: Db | Tx, actor: Actor, eventId: string): Promise<PlanningState> {
  authorize(actor, "events", "view");
  const event = await getEventOrThrow(ex, eventId);

  const rows = await ex
    .select({
      id: eventStageTransitions.id,
      from: eventStageTransitions.fromStage,
      to: eventStageTransitions.toStage,
      kind: eventStageTransitions.kind,
      actorName: users.name,
      note: eventStageTransitions.note,
      at: eventStageTransitions.createdAt,
    })
    .from(eventStageTransitions)
    .leftJoin(users, eq(users.id, eventStageTransitions.actorId))
    .where(eq(eventStageTransitions.eventId, event.id))
    .orderBy(desc(eventStageTransitions.createdAt), desc(eventStageTransitions.id))
    .limit(HISTORY_LIMIT);

  const next = planTransition(event.planningStage, "advance");
  const blockers = next && next !== "defined" ? await checkPreconditions(ex, event, next) : [];

  return {
    eventId: event.id,
    eventName: event.name,
    stage: event.planningStage,
    stageChangedAt: event.stageChangedAt?.toISOString() ?? null,
    history: rows.map((r) => ({
      id: r.id,
      from: r.from,
      to: r.to,
      // Sütun CHECK kısıtıyla bu üç değerle sınırlıdır.
      kind: r.kind as StageTransitionKind,
      actorName: r.actorName,
      note: r.note,
      at: r.at.toISOString(),
    })),
    allowed: allowedTransitions(actor, event.planningStage, event.status),
    blockers,
  };
}
