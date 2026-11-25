import { describe, expect, it } from "vitest";
import { APP_TIME_ZONE, zoneOffsetMs, zonedDayStart, zonedNextDayStart } from "@/lib/time-zone";

const H = 3_600_000;

describe("zoneOffsetMs", () => {
  it("kışın UTC+2, yazın UTC+3 verir", () => {
    expect(zoneOffsetMs(new Date("2027-01-15T12:00:00Z"))).toBe(2 * H);
    expect(zoneOffsetMs(new Date("2027-07-15T12:00:00Z"))).toBe(3 * H);
  });

  it("2027 geçiş günlerinde ofset tam geçiş anında değişir", () => {
    // Mart: 01:00 UTC'de 03:00 -> 04:00 (son pazar = 28 Mart).
    expect(zoneOffsetMs(new Date("2027-03-28T00:59:59Z"))).toBe(2 * H);
    expect(zoneOffsetMs(new Date("2027-03-28T01:00:00Z"))).toBe(3 * H);
    // Ekim: 01:00 UTC'de 04:00 -> 03:00 (son pazar = 31 Ekim).
    expect(zoneOffsetMs(new Date("2027-10-31T00:59:59Z"))).toBe(3 * H);
    expect(zoneOffsetMs(new Date("2027-10-31T01:00:00Z"))).toBe(2 * H);
  });

  it("bilinen bir bölge için çalışır (Istanbul sabit +3)", () => {
    expect(zoneOffsetMs(new Date("2027-01-15T12:00:00Z"), "Europe/Istanbul")).toBe(3 * H);
  });
});

describe("zonedDayStart", () => {
  it("varsayılan bölge Kıbrıs'tır", () => {
    expect(APP_TIME_ZONE).toBe("Asia/Famagusta");
    expect(zonedDayStart(new Date("2027-01-15T12:00:00Z")).toISOString()).toBe("2027-01-14T22:00:00.000Z");
  });

  it("kışın gün başlangıcı UTC+2'dir", () => {
    expect(zonedDayStart(new Date("2027-01-15T12:00:00Z")).toISOString()).toBe("2027-01-14T22:00:00.000Z");
    // 00:30 yerel = 22:30 UTC önceki gün; aynı yerel güne düşer.
    expect(zonedDayStart(new Date("2027-01-14T22:30:00Z")).toISOString()).toBe("2027-01-14T22:00:00.000Z");
    // 23:59 yerel hâlâ aynı gün.
    expect(zonedDayStart(new Date("2027-01-15T21:59:59Z")).toISOString()).toBe("2027-01-14T22:00:00.000Z");
    expect(zonedDayStart(new Date("2027-01-15T22:00:00Z")).toISOString()).toBe("2027-01-15T22:00:00.000Z");
  });

  it("yazın gün başlangıcı UTC+3'tür", () => {
    expect(zonedDayStart(new Date("2027-07-15T12:00:00Z")).toISOString()).toBe("2027-07-14T21:00:00.000Z");
    expect(zonedDayStart(new Date("2027-07-14T21:30:00Z")).toISOString()).toBe("2027-07-14T21:00:00.000Z");
  });

  it("Mart geçiş gününde (23 saatlik gün) doğru başlar", () => {
    // 28 Mart 2027 00:00 yerel hâlâ UTC+2 = 27 Mart 22:00 UTC.
    const start = "2027-03-27T22:00:00.000Z";
    expect(zonedDayStart(new Date("2027-03-28T00:30:00Z")).toISOString()).toBe(start);
    expect(zonedDayStart(new Date("2027-03-28T12:00:00Z")).toISOString()).toBe(start);
    // Gün 21:00 UTC'ye (00:00 UTC+3) kadar sürer: 23 saat.
    expect(zonedDayStart(new Date("2027-03-28T20:59:59Z")).toISOString()).toBe(start);
    expect(zonedDayStart(new Date("2027-03-28T21:00:00Z")).toISOString()).toBe("2027-03-28T21:00:00.000Z");
  });

  it("Ekim geçiş gününde (25 saatlik gün) doğru başlar", () => {
    // 31 Ekim 2027 00:00 yerel hâlâ UTC+3 = 30 Ekim 21:00 UTC.
    const start = "2027-10-30T21:00:00.000Z";
    expect(zonedDayStart(new Date("2027-10-30T21:00:00Z")).toISOString()).toBe(start);
    expect(zonedDayStart(new Date("2027-10-31T00:30:00Z")).toISOString()).toBe(start);
    expect(zonedDayStart(new Date("2027-10-31T12:00:00Z")).toISOString()).toBe(start);
    // Gün 22:00 UTC'ye (00:00 UTC+2) kadar sürer: 25 saat.
    expect(zonedDayStart(new Date("2027-10-31T21:59:59Z")).toISOString()).toBe(start);
    expect(zonedDayStart(new Date("2027-10-31T22:00:00Z")).toISOString()).toBe("2027-10-31T22:00:00.000Z");
  });
});

describe("zonedNextDayStart", () => {
  it("normal günde 24 saat sonrasıdır", () => {
    expect(zonedNextDayStart(new Date("2027-01-15T12:00:00Z")).toISOString()).toBe("2027-01-15T22:00:00.000Z");
    expect(zonedNextDayStart(new Date("2027-07-15T12:00:00Z")).toISOString()).toBe("2027-07-15T21:00:00.000Z");
  });

  it("Mart geçiş gününde 23, Ekim geçiş gününde 25 saat sonradır", () => {
    expect(zonedNextDayStart(new Date("2027-03-28T12:00:00Z")).toISOString()).toBe("2027-03-28T21:00:00.000Z");
    expect(zonedNextDayStart(new Date("2027-10-31T12:00:00Z")).toISOString()).toBe("2027-10-31T22:00:00.000Z");
  });
});
