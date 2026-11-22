import { describe, expect, it } from "vitest";
import { average, categoryAverages, countdownParts, trendOf } from "@/features/reviews/leader-stats";

describe("lider istatistikleri", () => {
  it("average yuvarlar, boş dizide null", () => {
    expect(average([])).toBeNull();
    expect(average([70, 81])).toBe(76);
  });

  it("trendOf eski ve yeni yarıyı karşılaştırır", () => {
    expect(trendOf([80])).toBeNull();
    expect(trendOf([50, 60, 80, 90])).toBe("up");
    expect(trendOf([90, 85, 60, 50])).toBe("down");
    expect(trendOf([70, 71, 72, 70])).toBe("flat");
  });

  it("categoryAverages boş kategoriyi atlar", () => {
    const base = {
      communication: null,
      punctuality: null,
      teamwork: null,
      customerService: null,
      technicalSkills: null,
      initiative: null,
      appearance: null,
      stressManagement: null,
    };
    const out = categoryAverages([
      { ...base, communication: 5, teamwork: 3 },
      { ...base, communication: 4 },
    ]);
    expect(out.communication).toBe(4.5);
    expect(out.teamwork).toBe(3);
    expect(out.punctuality).toBeNull();
  });

  it("countdownParts gün ve saat verir, geçmişte null", () => {
    const now = new Date("2027-01-01T00:00:00Z");
    expect(countdownParts(new Date("2027-01-03T05:30:00Z"), now)).toEqual({ days: 2, hours: 5 });
    expect(countdownParts(new Date("2026-12-31T00:00:00Z"), now)).toBeNull();
  });
});
