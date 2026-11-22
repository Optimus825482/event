import { describe, expect, it } from "vitest";
import {
  boardTabOf,
  countdownLabel,
  countdownParts,
  eventTypeBadge,
  groupBoard,
  istanbulDayStart,
  parseBoardTab,
  type BoardEvent,
} from "@/features/events/board";

const NOW = new Date("2030-06-15T09:00:00Z"); // İstanbul 12:00

function ev(over: Partial<BoardEvent> = {}): BoardEvent {
  return {
    id: "e1",
    name: "Etkinlik",
    description: null,
    status: "published",
    startsAt: new Date("2030-06-20T17:00:00Z"),
    endsAt: null,
    eventType: null,
    reservationEnabled: true,
    reservationCount: 0,
    tableCount: 0,
    assignmentCount: 0,
    ...over,
  };
}

describe("istanbulDayStart", () => {
  it("İstanbul gün başlangıcını (UTC+3) verir", () => {
    expect(istanbulDayStart(NOW).toISOString()).toBe("2030-06-14T21:00:00.000Z");
    // 00:30 İstanbul = 21:30 UTC önceki gün; aynı İstanbul gününe düşer.
    expect(istanbulDayStart(new Date("2030-06-14T21:30:00Z")).toISOString()).toBe("2030-06-14T21:00:00.000Z");
  });
});

describe("boardTabOf / groupBoard", () => {
  it("hazırlığı eksik gelecek etkinlik planlamadadır", () => {
    expect(boardTabOf(ev({ tableCount: 3 }), NOW)).toBe("planning");
    expect(boardTabOf(ev({ assignmentCount: 2 }), NOW)).toBe("planning");
    expect(boardTabOf(ev(), NOW)).toBe("planning");
  });

  it("alan ve ekip hazırsa gelecek sekmesindedir", () => {
    expect(boardTabOf(ev({ tableCount: 3, assignmentCount: 2 }), NOW)).toBe("upcoming");
  });

  it("bugünkü etkinlik (saati geçmiş olsa bile) tamamlanana gitmez", () => {
    const today = ev({ startsAt: new Date("2030-06-15T00:00:00Z") });
    expect(boardTabOf(today, NOW)).toBe("planning");
  });

  it("dünden önceki, tamamlanmış ve iptal edilmiş etkinlikler tamamlananadır", () => {
    expect(boardTabOf(ev({ startsAt: new Date("2030-06-14T10:00:00Z"), tableCount: 1, assignmentCount: 1 }), NOW)).toBe("completed");
    expect(boardTabOf(ev({ status: "completed" }), NOW)).toBe("completed");
    expect(boardTabOf(ev({ status: "cancelled" }), NOW)).toBe("completed");
  });

  it("gruplar sayımları ve sıralamayı verir", () => {
    const groups = groupBoard(
      [
        ev({ id: "b", startsAt: new Date("2030-07-01T10:00:00Z") }),
        ev({ id: "a", startsAt: new Date("2030-06-18T10:00:00Z") }),
        ev({ id: "old1", status: "completed", startsAt: new Date("2030-05-01T10:00:00Z") }),
        ev({ id: "old2", status: "completed", startsAt: new Date("2030-06-01T10:00:00Z") }),
      ],
      NOW,
    );
    expect(groups.planning.map((e) => e.id)).toEqual(["a", "b"]);
    expect(groups.upcoming).toHaveLength(0);
    expect(groups.completed.map((e) => e.id)).toEqual(["old2", "old1"]);
  });
});

describe("countdown", () => {
  it("saat, yarın ve gün biçimleri", () => {
    expect(countdownLabel(new Date("2030-06-15T14:30:00Z"), NOW)).toBe("5 saat");
    expect(countdownLabel(new Date("2030-06-16T12:00:00Z"), NOW)).toBe("Yarın");
    expect(countdownLabel(new Date("2030-06-27T09:00:00Z"), NOW)).toBe("12 gün");
    expect(countdownLabel(new Date("2030-06-15T08:00:00Z"), NOW)).toBeNull();
  });

  it("gün/saat/dakika parçaları", () => {
    expect(countdownParts(new Date("2030-06-17T10:15:00Z"), NOW)).toEqual({ days: 2, hours: 1, minutes: 15 });
    expect(countdownParts(NOW, NOW)).toBeNull();
  });
});

describe("parseBoardTab / eventTypeBadge", () => {
  it("bilinmeyen sekme planlamaya düşer", () => {
    expect(parseBoardTab("upcoming")).toBe("upcoming");
    expect(parseBoardTab("x")).toBe("planning");
    expect(parseBoardTab(undefined)).toBe("planning");
  });

  it("bilinen türler renk alır, bilinmeyenler nötr kalır, boş tür Diğer olur", () => {
    expect(eventTypeBadge("Konser").color).toContain("purple");
    expect(eventTypeBadge("konser").color).toContain("purple");
    expect(eventTypeBadge("Gala").color).toContain("slate");
    expect(eventTypeBadge(null).label).toBe("Diğer");
  });
});
