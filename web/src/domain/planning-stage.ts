import type { Department } from "../features/auth/departments";
import type { Module } from "../features/auth/policy";

/** Etkinliğin planlama aşamaları; sıra ileri akıştır. `status` (taslak/yayında/...) ile bağımsızdır. */
export const PLANNING_STAGES = [
  "defined",
  "layout_ready",
  "staffing_ready",
  "tables_classified",
  "casino_allocated",
  "priced",
  "on_sale",
  "sales_closed",
] as const;
export type PlanningStage = (typeof PLANNING_STAGES)[number];

export const STAGE_LABELS: Record<PlanningStage, string> = {
  defined: "Tanımlandı",
  layout_ready: "Yerleşim hazır",
  staffing_ready: "Personel planı hazır",
  tables_classified: "Masalar sınıflandı",
  casino_allocated: "Casino tahsisi tamam",
  priced: "Fiyatlandı",
  on_sale: "Satışta",
  sales_closed: "Satış kapalı",
};

export const STAGE_TRANSITION_KINDS = ["advance", "revert", "reopen"] as const;
export type StageTransitionKind = (typeof STAGE_TRANSITION_KINDS)[number];

export const STAGE_NOTIFICATION_TYPES = [
  "planning_stage_advanced",
  "planning_stage_reverted",
  "sales_opened",
  "sales_closed",
] as const;

export type StageAudience = "all" | Department;

export type StageRule = {
  /** Aşamayı geçiren departman. */
  department: Department;
  /** Geçiş için gereken modül (`edit` fiili). */
  module: Module;
  /** Bildirim kitlesi. */
  audience: StageAudience;
  /** İleri geçişte gönderilen bildirim türü. */
  advanceType:
    | "venue_layout_completed"
    | "team_organization_completed"
    | "planning_stage_advanced"
    | "sales_opened"
    | "sales_closed";
};

/** Anahtar, ulaşılan (hedef) aşamadır. */
export const STAGE_RULES: Readonly<Record<Exclude<PlanningStage, "defined">, StageRule>> = {
  layout_ready: { department: "fnb", module: "venues", audience: "fnb", advanceType: "venue_layout_completed" },
  staffing_ready: {
    department: "fnb",
    module: "staff",
    audience: "entertainment",
    advanceType: "team_organization_completed",
  },
  tables_classified: {
    department: "entertainment",
    module: "events",
    audience: "casino",
    advanceType: "planning_stage_advanced",
  },
  casino_allocated: {
    department: "casino",
    module: "reservations",
    audience: "entertainment",
    advanceType: "planning_stage_advanced",
  },
  priced: {
    department: "entertainment",
    module: "events",
    audience: "entertainment",
    advanceType: "planning_stage_advanced",
  },
  on_sale: { department: "entertainment", module: "events", audience: "all", advanceType: "sales_opened" },
  sales_closed: { department: "entertainment", module: "events", audience: "all", advanceType: "sales_closed" },
};

/** Geçişin hedef aşamasını verir; geçersizse null. Geri alma yalnızca satış öncesinde, bir adımdır. */
export function planTransition(from: PlanningStage, kind: StageTransitionKind): PlanningStage | null {
  const i = PLANNING_STAGES.indexOf(from);
  if (kind === "advance") return PLANNING_STAGES[i + 1] ?? null;
  if (kind === "revert") {
    return i >= PLANNING_STAGES.indexOf("layout_ready") && i <= PLANNING_STAGES.indexOf("priced")
      ? (PLANNING_STAGES[i - 1] ?? null)
      : null;
  }
  return from === "sales_closed" ? "on_sale" : null;
}

/** Yerleşim kilidi satışta ve satış kapalıyken etkindir. */
export function isLayoutLockedStage(stage: PlanningStage): boolean {
  return stage === "on_sale" || stage === "sales_closed";
}

/** Satışa açık aşama: alan düzenlemesi (masalar + decor) tamamen kilitlidir. */
export function isSaleOpenStage(stage: PlanningStage): boolean {
  return stage === "on_sale";
}
