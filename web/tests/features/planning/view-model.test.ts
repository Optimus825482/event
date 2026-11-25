import { describe, expect, it } from "vitest";
import { actionButtons, historyLine, stageSteps } from "@/features/planning/view-model";
import type { PlanningState } from "@/features/planning/stage-service";

function state(overrides: Partial<PlanningState> = {}): PlanningState {
  return {
    eventId: "e1",
    eventName: "Gala",
    stage: "priced",
    stageChangedAt: null,
    history: [],
    allowed: [],
    blockers: [],
    ...overrides,
  };
}

describe("stageSteps", () => {
  it("casino tahsisi aşamasında dört adım tamam, biri güncel, üçü bekliyor", () => {
    const s = stageSteps("casino_allocated");
    expect(s).toHaveLength(8);
    expect(s.map((x) => x.status)).toEqual([
      "done", "done", "done", "done", "current", "upcoming", "upcoming", "upcoming",
    ]);
    expect(s[4]).toEqual({
      stage: "casino_allocated",
      label: "Casino tahsisi tamam",
      department: "Casino",
      status: "current",
    });
    expect(s[0]?.department).toBeNull();
    expect(s[1]?.department).toBe("Food & Beverage");
  });
});

describe("actionButtons", () => {
  it("satış öncesi ileri + geri, onay metinleri", () => {
    const buttons = actionButtons(
      state({
        allowed: [
          { kind: "advance", to: "on_sale" },
          { kind: "revert", to: "casino_allocated" },
        ],
      }),
    );
    expect(buttons).toEqual([
      {
        kind: "advance",
        to: "on_sale",
        label: "Satışı aç",
        confirm: "Satış açılınca rezervasyonlu masaların yerleşimi kilitlenir. Devam edilsin mi?",
        needsNote: false,
      },
      { kind: "revert", to: "casino_allocated", label: "Geri al", confirm: null, needsNote: true },
    ]);
  });

  it("diğer ileri geçişler aşama etiketiyle adlanır, onay yoktur", () => {
    const [b] = actionButtons(state({ allowed: [{ kind: "advance", to: "layout_ready" }] }));
    expect(b).toMatchObject({ label: "Yerleşim hazır olarak işaretle", confirm: null, needsNote: false });
  });

  it("satışı kapat ve yeniden aç", () => {
    const closed = actionButtons(state({ allowed: [{ kind: "advance", to: "sales_closed" }] }));
    expect(closed[0]).toMatchObject({ label: "Satışı kapat", confirm: "Online satış kapatılsın mı?" });
    const reopen = actionButtons(state({ allowed: [{ kind: "reopen", to: "on_sale" }] }));
    expect(reopen[0]).toMatchObject({ label: "Satışı yeniden aç", needsNote: false });
  });

  it("engeller varken ileri düğmesi yine gösterilir", () => {
    const buttons = actionButtons(
      state({ blockers: ["Yerleşimde en az bir masa olmalı"], allowed: [{ kind: "advance", to: "layout_ready" }] }),
    );
    expect(buttons).toHaveLength(1);
  });

  it("izinli geçiş yoksa boş", () => {
    expect(actionButtons(state())).toEqual([]);
  });
});

describe("historyLine", () => {
  it("kişi, hedef aşama ve Kıbrıs saatiyle biçimlenir", () => {
    const line = historyLine({
      id: "1", from: "defined", to: "layout_ready", kind: "advance",
      actorName: "Ayşe K.", note: null, at: "2026-11-26T12:05:00.000Z",
    });
    expect(line).toEqual({ text: "Ayşe K. · Yerleşim hazır · 26 Kas 14:05", note: null });
  });
  it("kişi yoksa Sistem; geri almada neden ayrı alanda", () => {
    const line = historyLine({
      id: "1", from: "priced", to: "casino_allocated", kind: "revert",
      actorName: null, note: "Fiyat hatalı", at: "2026-11-26T12:05:00.000Z",
    });
    expect(line).toEqual({
      text: "Sistem · Geri alındı: Casino tahsisi tamam · 26 Kas 14:05",
      note: "Fiyat hatalı",
    });
  });
});
