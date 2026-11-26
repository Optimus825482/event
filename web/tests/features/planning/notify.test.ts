import { describe, expect, it } from "vitest";
import { buildStageNotification } from "@/features/planning/notify";

const event = { id: "11111111-1111-4111-8111-111111111111", name: "Yılbaşı Galası" };
const actorId = "22222222-2222-4222-8222-222222222222";

describe("buildStageNotification", () => {
  it("yerleşim hazır ileri geçişi F&B'ye orta öncelikli bildirim üretir", () => {
    expect(
      buildStageNotification({ event, from: "defined", to: "layout_ready", kind: "advance", actorName: "Ayşe", actorId }),
    ).toEqual({
      type: "venue_layout_completed",
      title: "Yerleşim hazır: Yılbaşı Galası",
      message: 'Ayşe, "Yılbaşı Galası" etkinliğini "Yerleşim hazır" aşamasına taşıdı.',
      priority: "medium",
      audience: "fnb",
      eventId: event.id,
      createdById: actorId,
      actionUrl: `/events/${event.id}`,
      metadata: { from: "defined", to: "layout_ready", kind: "advance" },
    });
  });

  it("geri alma geri alınan aşamanın kitlesine yüksek öncelikle gider ve nedeni içerir", () => {
    expect(
      buildStageNotification({
        event,
        from: "staffing_ready",
        to: "layout_ready",
        kind: "revert",
        actorName: "Ayşe",
        actorId,
        note: "Masa sayısı değişti",
      }),
    ).toEqual({
      type: "planning_stage_reverted",
      title: "Aşama geri alındı: Yılbaşı Galası",
      message:
        'Ayşe, "Yılbaşı Galası" etkinliğini "Personel planı hazır" aşamasından "Yerleşim hazır" aşamasına geri aldı. Neden: Masa sayısı değişti',
      priority: "high",
      audience: "entertainment",
      eventId: event.id,
      createdById: actorId,
      actionUrl: `/events/${event.id}`,
      metadata: { from: "staffing_ready", to: "layout_ready", kind: "revert" },
    });
  });

  it("yeniden açma herkese yüksek öncelikli sales_opened bildirimi üretir", () => {
    expect(
      buildStageNotification({ event, from: "sales_closed", to: "on_sale", kind: "reopen", actorName: "Ayşe", actorId }),
    ).toEqual({
      type: "sales_opened",
      title: "Satışta: Yılbaşı Galası",
      message: 'Ayşe, "Yılbaşı Galası" etkinliğini "Satışta" aşamasına taşıdı.',
      priority: "high",
      audience: "all",
      eventId: event.id,
      createdById: actorId,
      actionUrl: `/events/${event.id}`,
      metadata: { from: "sales_closed", to: "on_sale", kind: "reopen" },
    });
  });

  it("satışa açma ileri geçişi yüksek önceliklidir", () => {
    const n = buildStageNotification({ event, from: "priced", to: "on_sale", kind: "advance", actorName: "A", actorId });
    expect(n).toMatchObject({ type: "sales_opened", audience: "all", priority: "high" });
  });
});
