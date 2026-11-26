import { describe, expect, it } from "vitest";
import { defaultPeriod, periodBounds, periodSchema } from "@/features/reports/period";

function firstIssue(input: unknown) {
  const r = periodSchema.safeParse(input);
  if (r.success) return null;
  const issue = r.error.issues[0];
  return issue ? { path: issue.path, message: issue.message } : null;
}

describe("dönem sınırları", () => {
  it("kış: gün sınırı UTC+2", () =>
    expect(periodBounds({ from: "2027-01-01", to: "2027-01-31" })).toEqual({
      start: new Date("2026-12-31T22:00:00Z"),
      endExclusive: new Date("2027-01-31T22:00:00Z"),
    }));
  it("yaz: gün sınırı UTC+3", () =>
    expect(periodBounds({ from: "2027-07-01", to: "2027-07-01" })).toEqual({
      start: new Date("2027-06-30T21:00:00Z"),
      endExclusive: new Date("2027-07-01T21:00:00Z"),
    }));
  it("yaz saatine geçiş günü 23 saattir (28 Mart 2027)", () =>
    expect(periodBounds({ from: "2027-03-28", to: "2027-03-28" })).toEqual({
      start: new Date("2027-03-27T22:00:00Z"),
      endExclusive: new Date("2027-03-28T21:00:00Z"),
    }));
  it("kış saatine dönüş günü 25 saattir (31 Ekim 2027)", () =>
    expect(periodBounds({ from: "2027-10-31", to: "2027-10-31" })).toEqual({
      start: new Date("2027-10-30T21:00:00Z"),
      endExclusive: new Date("2027-10-31T22:00:00Z"),
    }));
  it("varsayılan dönem Kıbrıs takvim yılıdır", () => {
    // 31 Aralık 2026 22:30 UTC, Kıbrıs'ta 1 Ocak 2027 00:30'dur.
    expect(defaultPeriod(new Date("2026-12-31T22:30:00Z"))).toEqual({ from: "2027-01-01", to: "2027-01-01" });
    expect(defaultPeriod(new Date("2027-06-15T10:00:00Z"))).toEqual({ from: "2027-01-01", to: "2027-06-15" });
  });
  it("şema: biçim, sıra ve azami aralık", () => {
    expect(periodSchema.safeParse({ from: "2027-02-30", to: "2027-03-01" }).success).toBe(false);
    expect(periodSchema.safeParse({ from: "01.01.2027", to: "2027-03-01" }).success).toBe(false);
    expect(firstIssue({ from: "01.01.2027", to: "2027-03-01" })).toEqual({
      path: ["from"],
      message: "Geçerli bir tarih girin",
    });
    expect(firstIssue({ from: "2027-03-02", to: "2027-03-01" })).toEqual({
      path: ["to"],
      message: "Bitiş, başlangıçtan önce olamaz",
    });
    expect(firstIssue({ from: "2020-01-01", to: "2027-01-01" })).toEqual({
      path: ["to"],
      message: "Dönem en fazla 5 yıl olabilir",
    });
    expect(periodSchema.safeParse({ from: "2027-01-01", to: "2027-01-01" }).success).toBe(true);
  });
});
