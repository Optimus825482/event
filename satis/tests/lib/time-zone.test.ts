import { describe, expect, it } from "vitest";
import {
  dateKeyOf,
  formatEventDate,
  formatEventTime,
  formatEventWhen,
  formatMonthTitle,
  todayKey,
} from "@/lib/time-zone";

describe("formatEventWhen", () => {
  it("etkinlik zamanı Kıbrıs saatiyle yazılır (kış, UTC+2)", () =>
    expect(formatEventWhen("2026-12-31T19:00:00Z")).toBe("31 Aralık 2026 Perşembe · 21:00"));
  it("yaz saatinde UTC+3", () =>
    expect(formatEventWhen("2027-07-10T18:30:00Z")).toBe("10 Temmuz 2027 Cumartesi · 21:30"));
  it("gün anahtarı Kıbrıs saatine göredir: UTC 22:30 ertesi güne düşer", () =>
    expect(dateKeyOf("2027-01-15T22:30:00.000Z")).toBe("2027-01-16"));
  it("yaz saatinde UTC 20:59 aynı gün, 21:00 ertesi gün", () => {
    expect(dateKeyOf("2027-07-10T20:59:00Z")).toBe("2027-07-10");
    expect(dateKeyOf("2027-07-10T21:00:00Z")).toBe("2027-07-11");
  });
  it("tarih ve saat ayrı biçimlenir", () => {
    expect(formatEventDate("2027-01-15T18:00:00.000Z")).toBe("15 Ocak 2027 Cuma");
    expect(formatEventTime("2027-01-15T18:00:00.000Z")).toBe("20:00");
  });
  it("ay başlığı", () => expect(formatMonthTitle(2027, 1)).toBe("Ocak 2027"));
  it("bugünün anahtarı verilen ana göre hesaplanır", () =>
    expect(todayKey(new Date("2026-12-31T22:30:00Z"))).toBe("2027-01-01"));
});
