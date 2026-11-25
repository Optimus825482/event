import { describe, expect, it } from "vitest";
import {
  isLayoutLockedStage,
  PLANNING_STAGES,
  planTransition,
  STAGE_LABELS,
  STAGE_RULES,
} from "@/domain/planning-stage";

describe("planlama aşamaları", () => {
  it("sözlük ve etiketler sabittir", () => {
    expect(PLANNING_STAGES).toEqual([
      "defined",
      "layout_ready",
      "staffing_ready",
      "tables_classified",
      "casino_allocated",
      "priced",
      "on_sale",
      "sales_closed",
    ]);
    expect(STAGE_LABELS).toEqual({
      defined: "Tanımlandı",
      layout_ready: "Yerleşim hazır",
      staffing_ready: "Personel planı hazır",
      tables_classified: "Masalar sınıflandı",
      casino_allocated: "Casino tahsisi tamam",
      priced: "Fiyatlandı",
      on_sale: "Satışta",
      sales_closed: "Satış kapalı",
    });
  });

  it("kurallar tablodaki gibidir", () => {
    expect(STAGE_RULES).toEqual({
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
    });
  });

  it.each([
    ["defined", "advance", "layout_ready"],
    ["priced", "advance", "on_sale"],
    ["on_sale", "advance", "sales_closed"],
    ["sales_closed", "advance", null],
    ["defined", "revert", null],
    ["layout_ready", "revert", "defined"],
    ["priced", "revert", "casino_allocated"],
    ["on_sale", "revert", null],
    ["sales_closed", "revert", null],
    ["sales_closed", "reopen", "on_sale"],
    ["priced", "reopen", null],
    ["on_sale", "reopen", null],
  ] as const)("planTransition(%s, %s) = %s", (from, kind, to) => {
    expect(planTransition(from, kind)).toBe(to);
  });

  it("kilit yalnızca satışta ve satış kapalıyken", () => {
    expect(PLANNING_STAGES.filter(isLayoutLockedStage)).toEqual(["on_sale", "sales_closed"]);
  });
});
