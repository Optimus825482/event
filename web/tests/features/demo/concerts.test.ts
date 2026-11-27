import { describe, expect, it } from "vitest";
import { DEMO_CONCERTS, concertTimes, demoPrices } from "@/features/demo/concerts";
import { dateToZonedWallClock } from "@/lib/time-zone";

describe("demo konser verisi", () => {
  it("beş konser tablodaki sırayla ve ofsetlerle tanımlıdır", () => {
    expect(DEMO_CONCERTS.map((c) => [c.key, c.dayOffset, c.time, c.doors, c.basePrice])).toEqual([
      ["selcuk", 8, "22:00", "20:00", 6500],
      ["levent", 15, "22:00", "20:00", 7500],
      ["serkan", 34, "22:30", "20:30", 11000],
      ["ziynet", 36, "22:00", "20:00", 9000],
      ["kirac", 50, "22:00", "20:00", 8500],
    ]);
    expect(DEMO_CONCERTS.find((c) => c.key === "levent")?.name).toBe("Levent Yüksel · Aralık Galası");
  });

  it("tarih Kıbrıs gününe göre ofsetlenir; saatler Kıbrıs duvar saatidir", () => {
    const now = new Date("2026-11-27T21:30:00Z"); // Kıbrıs'ta 27 Kasım 23:30
    const levent = DEMO_CONCERTS[1]!;
    const t = concertTimes(now, levent);
    expect(dateToZonedWallClock(t.startsAt)).toBe("2026-12-12T22:00");
    expect(dateToZonedWallClock(t.doorsOpenAt)).toBe("2026-12-12T20:00");
    expect(t.endsAt.getTime() - t.startsAt.getTime()).toBe(3 * 3600_000);
  });

  it("gün sınırında Kıbrıs günü esas alınır", () => {
    const t = concertTimes(new Date("2026-11-27T22:30:00Z"), DEMO_CONCERTS[1]!);
    expect(dateToZonedWallClock(t.startsAt)).toBe("2026-12-13T22:00");
  });

  it.each([
    [6500, "6500.00", "12025.00", "18200.00"],
    [11000, "11000.00", "20350.00", "30800.00"],
    [8500, "8500.00", "15725.00", "23800.00"],
  ])("demoPrices(%i)", (base, standard, premium, vip) => {
    expect(demoPrices(base)).toEqual({ standard, premium, vip });
  });
});
