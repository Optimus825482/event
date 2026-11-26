import { describe, expect, it } from "vitest";
import { buildReleaseNotification } from "@/features/seating/notify";

describe("serbest bırakma bildirimi", () => {
  it("serbest bırakma bildirimi sözleşmedeki alanları taşır", () =>
    expect(
      buildReleaseNotification({
        event: { id: "e1", name: "Yılbaşı Galası" },
        actorId: "u1",
        actorName: "Ayşe K.",
        tables: [
          { id: "t2", label: "A2" },
          { id: "t1", label: "A1" },
        ],
      }),
    ).toEqual({
      type: "casino_tables_released",
      audience: "entertainment",
      priority: "medium",
      eventId: "e1",
      createdById: "u1",
      actionUrl: "/events/e1/tables",
      title: "Casino masaları serbest bıraktı: Yılbaşı Galası",
      message: 'Ayşe K., "Yılbaşı Galası" etkinliğinde 2 masayı serbest bıraktı. Bu masaları satışa açabilirsiniz.',
      metadata: { tableIds: ["t1", "t2"], labels: ["A1", "A2"] },
    }));

  it("etiketler Türkçe sayısal sırayla dizilir", () => {
    const n = buildReleaseNotification({
      event: { id: "e1", name: "G" },
      actorId: "u1",
      actorName: "A",
      tables: [
        { id: "t10", label: "A10" },
        { id: "t2", label: "A2" },
        { id: "t9", label: "Ç1" },
        { id: "t8", label: "C1" },
      ],
    });
    expect(n.metadata).toEqual({ tableIds: ["t2", "t10", "t8", "t9"], labels: ["A2", "A10", "C1", "Ç1"] });
  });
});
