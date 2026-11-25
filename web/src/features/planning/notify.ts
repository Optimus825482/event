import { STAGE_LABELS, type PlanningStage, type StageTransitionKind } from "@/domain/planning-stage";
import type { NewNotification } from "@/features/notifications/service";
import { ruleFor } from "./allowed";

type StageNotificationArgs = {
  event: { id: string; name: string };
  from: PlanningStage;
  to: PlanningStage;
  kind: StageTransitionKind;
  actorName: string;
  actorId: string;
  note?: string;
};

/** Devir teslim bildirimi: sıradaki işin sahibine (geri almada geri alınan aşamanın kitlesine) gider. Saf. */
export function buildStageNotification(args: StageNotificationArgs): NewNotification {
  const { event, from, to, kind, actorName, actorId, note } = args;
  const rule = ruleFor(kind, from, to);
  if (!rule) throw new Error(`aşama kuralı yok: ${kind} ${from} → ${to}`);

  const isRevert = kind === "revert";
  const type = isRevert ? "planning_stage_reverted" : kind === "reopen" ? "sales_opened" : rule.advanceType;
  const title = isRevert ? `Aşama geri alındı: ${event.name}` : `${STAGE_LABELS[to]}: ${event.name}`;
  const message = isRevert
    ? `${actorName}, "${event.name}" etkinliğini "${STAGE_LABELS[from]}" aşamasından "${STAGE_LABELS[to]}" aşamasına geri aldı. Neden: ${note ?? ""}`
    : `${actorName}, "${event.name}" etkinliğini "${STAGE_LABELS[to]}" aşamasına taşıdı.`;
  const high = to === "on_sale" || to === "sales_closed" || kind === "revert" || kind === "reopen";

  return {
    type,
    title,
    message,
    priority: high ? "high" : "medium",
    audience: rule.audience,
    eventId: event.id,
    createdById: actorId,
    actionUrl: `/events/${event.id}`,
    metadata: { from, to, kind },
  };
}
