import { describe, expect, it } from "vitest";
import { formatEventWhen } from "@/lib/time-zone";

describe("formatEventWhen", () => {
  it("etkinlik zamanı Kıbrıs saatiyle yazılır (kış, UTC+2)", () =>
    expect(formatEventWhen("2026-12-31T19:00:00Z")).toBe("31 Aralık 2026 Perşembe · 21:00"));
  it("yaz saatinde UTC+3", () =>
    expect(formatEventWhen("2027-07-10T18:30:00Z")).toBe("10 Temmuz 2027 Cumartesi · 21:30"));
});
