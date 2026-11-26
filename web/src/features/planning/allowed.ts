import {
  STAGE_RULES,
  planTransition,
  type PlanningStage,
  type StageRule,
  type StageTransitionKind,
} from "@/domain/planning-stage";
import type { EventStatus } from "@/domain/event-status";
import { can, type PolicyActor } from "@/features/auth/policy";

export type AllowedTransition = { kind: StageTransitionKind; to: PlanningStage };

const KIND_ORDER: readonly StageTransitionKind[] = ["advance", "reopen", "revert"];

/** Tamamlanmış veya iptal edilmiş etkinlikte aşama değişmez. */
export function isStageFrozen(status: EventStatus): boolean {
  return status === "completed" || status === "cancelled";
}

/**
 * Geçişin yetki ve bildirim kuralı: ileri/yeniden açmada hedef aşamanın, geri almada geri alınan
 * (kaynak) aşamanın kuralı. `defined` kuralsızdır; ona ulaşan geçiş yoktur.
 */
export function ruleFor(kind: StageTransitionKind, from: PlanningStage, to: PlanningStage): StageRule | null {
  const key = kind === "revert" ? from : to;
  return key === "defined" ? null : STAGE_RULES[key];
}

/** Aktörün bu aşamada yapabileceği geçişler; sıra: ileri, yeniden aç, geri al. Saf işlevdir. */
export function allowedTransitions(actor: PolicyActor, stage: PlanningStage, status: EventStatus): AllowedTransition[] {
  if (isStageFrozen(status)) return [];
  const result: AllowedTransition[] = [];
  for (const kind of KIND_ORDER) {
    const to = planTransition(stage, kind);
    if (!to) continue;
    const rule = ruleFor(kind, stage, to);
    if (rule && can(actor, rule.module, "edit")) result.push({ kind, to });
  }
  return result;
}
