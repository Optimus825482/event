import { describe, expect, it } from "vitest";
import { planHolds, summarize } from "../../scripts/load-lib.mjs";

const base = { initialFree: { a: 8, b: 8 }, finalFree: { a: 4, b: 8 }, availabilityHits: 10, durationMs: 30_000, pollTotal: 30_000, pollErrors: 0 };
const okHold = (tableId: string, quantity: number) => ({ tableId, quantity, status: 201, code: null });

describe("load-lib", () => {
  it("temiz koşu geçer", () =>
    expect(summarize({ ...base, holds: [okHold("a", 2), okHold("a", 2), { tableId: "a", quantity: 6, status: 409, code: "seats_unavailable" }] }))
      .toMatchObject({ ok: true, violations: [], held: 4, rejectedByCode: { seats_unavailable: 1 } }));
  it("çifte satışı yakalar", () =>
    expect(summarize({ ...base, finalFree: { a: 0, b: 8 }, holds: [okHold("a", 6), okHold("a", 4)] }).violations).toContain("çifte satış: a"));
  it("doluluk tutarsızlığını yakalar", () =>
    expect(summarize({ ...base, finalFree: { a: 6, b: 8 }, holds: [okHold("a", 4)] }).violations).toContain("doluluk tutarsız: a"));
  it("beklenmeyen yanıtı yakalar", () =>
    expect(summarize({ ...base, finalFree: { a: 8, b: 8 }, holds: [{ tableId: "a", quantity: 2, status: 500, code: null }] }).violations).toContain("beklenmeyen yanıt: 500 null"));
  it("çekirdeğe giden doluluk isteği 2 saniyede 1'i aşarsa ihlaldir", () => {
    expect(summarize({ ...base, holds: [okHold("a", 4)], availabilityHits: 16 }).ok).toBe(true);
    expect(summarize({ ...base, holds: [okHold("a", 4)], availabilityHits: 17 }).violations).toContain("çekirdeğe giden doluluk isteği sınırı aştı");
  });
  it("sorgulama hata oranı %1'i aşarsa ihlaldir", () =>
    expect(summarize({ ...base, holds: [okHold("a", 4)], pollErrors: 301 }).violations).toContain("sorgulama hata oranı %1'i aştı"));
  it("planHolds: her tutma ayrı IP ve anahtar taşır, adet 2–4", () => {
    const plan = planHolds({ tables: [{ id: "a", free: 10 }, { id: "b", free: 10 }], count: 300, random: Math.random });
    expect(plan).toHaveLength(300);
    expect(new Set(plan.map((p) => p.clientIp)).size).toBe(300);
    expect(new Set(plan.map((p) => p.clientKey)).size).toBe(300);
    expect(plan.every((p) => p.quantity >= 2 && p.quantity <= 4)).toBe(true);
  });
});
