import { describe, expect, it } from "vitest";
import { EVENT_STATUSES, canTransitionEvent } from "@/domain/event-status";
import { EVENT_TRANSITION_ACTIONS, transitionConfirmation } from "@/features/events/labels";

describe("etkinlik durum geçişi düğme metinleri", () => {
  it("her durum için fiil biçiminde bir eylem metni vardır (\"… yap\" yok)", () => {
    expect(Object.keys(EVENT_TRANSITION_ACTIONS).sort()).toEqual([...EVENT_STATUSES].sort());
    for (const status of EVENT_STATUSES) {
      const label = EVENT_TRANSITION_ACTIONS[status].label;
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/\byap$/);
    }
  });

  it("beklenen Türkçe fiiller", () => {
    expect(EVENT_TRANSITION_ACTIONS.published.label).toBe("Yayınla");
    expect(EVENT_TRANSITION_ACTIONS.active.label).toBe("Başlat");
    expect(EVENT_TRANSITION_ACTIONS.completed.label).toBe("Tamamla");
    expect(EVENT_TRANSITION_ACTIONS.cancelled.label).toBe("İptal et");
    expect(EVENT_TRANSITION_ACTIONS.draft.label).toBe("Taslağa al");
  });

  it("geri dönüşü olmayan hedefler (tamamla, iptal et) onay ister; diğerleri istemez", () => {
    for (const status of EVENT_STATUSES) {
      const needs = transitionConfirmation(status) !== null;
      expect(needs).toBe(status === "completed" || status === "cancelled");
    }
    const cancel = transitionConfirmation("cancelled");
    expect(cancel?.description).toMatch(/geri alınamaz/);
  });

  it("ulaşılabilir her geçişin bir metni vardır", () => {
    for (const from of EVENT_STATUSES) {
      for (const to of EVENT_STATUSES) {
        if (canTransitionEvent(from, to)) expect(EVENT_TRANSITION_ACTIONS[to].label).toBeTruthy();
      }
    }
  });
});
