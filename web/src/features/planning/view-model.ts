import {
  PLANNING_STAGES,
  STAGE_LABELS,
  STAGE_RULES,
  type PlanningStage,
  type StageTransitionKind,
} from "@/domain/planning-stage";
import { DEPARTMENT_LABELS } from "@/features/auth/departments";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import type { PlanningState, StageHistoryItem } from "./stage-service";

export type StepView = {
  stage: PlanningStage;
  label: string;
  /** Aşamayı geçiren departman; `defined` için null. */
  department: string | null;
  status: "done" | "current" | "upcoming";
};

/** Adım çubuğu: `PLANNING_STAGES` sırasında sekiz öğe. */
export function stageSteps(stage: PlanningStage): StepView[] {
  const currentIndex = PLANNING_STAGES.indexOf(stage);
  return PLANNING_STAGES.map((s, i) => ({
    stage: s,
    label: STAGE_LABELS[s],
    department: s === "defined" ? null : DEPARTMENT_LABELS[STAGE_RULES[s].department],
    status: i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming",
  }));
}

export type ActionButton = {
  kind: StageTransitionKind;
  to: PlanningStage;
  label: string;
  confirm: string | null;
  needsNote: boolean;
};

const CONFIRMS: Partial<Record<PlanningStage, string>> = {
  on_sale: "Satış açılınca rezervasyonlu masaların yerleşimi kilitlenir. Devam edilsin mi?",
  sales_closed: "Online satış kapatılsın mı?",
};

function labelFor(kind: StageTransitionKind, to: PlanningStage): string {
  if (kind === "revert") return "Geri al";
  if (kind === "reopen") return "Satışı yeniden aç";
  if (to === "on_sale") return "Satışı aç";
  if (to === "sales_closed") return "Satışı kapat";
  return `${STAGE_LABELS[to]} olarak işaretle`;
}

/**
 * İzinli geçişlerden düğmeler. Engeller doluysa ileri düğmesi yine döner: karar sunucuda verilir
 * (tek doğruluk kaynağı), panel yalnızca engelleri listeler.
 */
export function actionButtons(state: PlanningState): ActionButton[] {
  return state.allowed.map(({ kind, to }) => ({
    kind,
    to,
    label: labelFor(kind, to),
    confirm: kind === "advance" ? (CONFIRMS[to] ?? null) : null,
    needsNote: kind === "revert",
  }));
}

const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: APP_TIME_ZONE,
});

/** Geçmiş kaydı satırı: "Ayşe K. · Yerleşim hazır · 26 Kas 14:05"; geri almada neden ayrıca döner. */
export function historyLine(item: StageHistoryItem): { text: string; note: string | null } {
  const target = STAGE_LABELS[item.to];
  const what =
    item.kind === "revert"
      ? `Geri alındı: ${target}`
      : item.kind === "reopen"
        ? "Satış yeniden açıldı"
        : target;
  const when = dateTimeFormat.format(new Date(item.at));
  return { text: `${item.actorName ?? "Sistem"} · ${what} · ${when}`, note: item.note };
}
