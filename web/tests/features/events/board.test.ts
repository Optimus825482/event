import { describe, expect, it } from "vitest";
import {
  boardTabOf,
  countdownLabel,
  countdownParts,
  eventTypeBadge,
  groupBoard,
  parseBoardTab,
  type BoardEvent,
} from "@/features/events/board";

const NOW = new Date("2030-06-15T09:00:00Z"); // Kıbrıs 12:00 (yaz, UTC+3)

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

describe("boardTabOf gün sınırı (Kıbrıs saati)", () => {
  const started = (iso: string) => ev({ startsAt: new Date(iso), tableCount: 1, assignmentCount: 1 });

  it("yazın (UTC+3) bugünün 00:00'ından önce başlayan etkinlik tamamlanmıştır", () => {
    // 15 Haziran 12:00 yerel; gün başlangıcı 14 Haziran 21:00 UTC.
    expect(boardTabOf(started("2030-06-14T20:59:00Z"), NOW)).toBe("completed");
    expect(boardTabOf(started("2030-06-14T21:00:00Z"), NOW)).toBe("upcoming");
  });

  it("kışın (UTC+2) gün başlangıcı bir saat önce UTC'dedir", () => {
    const winter = new Date("2030-01-15T10:00:00Z"); // yerel 12:00
    // Gün başlangıcı 14 Ocak 22:00 UTC.
    expect(boardTabOf(started("2030-01-14T21:59:00Z"), winter)).toBe("completed");
    expect(boardTabOf(started("2030-01-14T22:00:00Z"), winter)).toBe("upcoming");
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
