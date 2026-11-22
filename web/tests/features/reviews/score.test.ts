import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  RATING_KEYS,
  RATING_WEIGHTS,
  computeScore,
  ratingBand,
  type RatingKey,
  type Ratings,
} from "@/features/reviews/score";

const KEYS = [...RATING_KEYS];

function all(value: number): Ratings {
  return Object.fromEntries(KEYS.map((k) => [k, value])) as Ratings;
}

/** Σ(puan × ağırlık) tam sayı toplamı olan bir puanlama bulur (computeScore'dan bağımsız). */
function ratingsWithWeightedSum(target: number): Ratings {
  const order = KEYS;
  const best = new Map<string, number[] | null>();
  function search(i: number, remaining: number): number[] | null {
    if (i === order.length) return remaining === 0 ? [] : null;
    const memo = `${i}:${remaining}`;
    const cached = best.get(memo);
    if (cached !== undefined) return cached;
    const weight = RATING_WEIGHTS[order[i] as RatingKey];
    let found: number[] | null = null;
    for (let r = 5; r >= 0 && found === null; r -= 1) {
      if (r * weight > remaining) continue;
      const rest = search(i + 1, remaining - r * weight);
      if (rest) found = [r, ...rest];
    }
    best.set(memo, found);
    return found;
  }
  const picked = search(0, target);
  if (!picked) throw new Error(`ağırlıklı toplam ${target} üretilemedi`);
  return Object.fromEntries(order.map((k, i) => [k, picked[i]])) as Ratings;
}

describe("ağırlıklar", () => {
  it("sırayla 15/15/15/20/10/10/5/10 ve toplam 100", () => {
    expect(KEYS.map((k) => RATING_WEIGHTS[k])).toEqual([15, 15, 15, 20, 10, 10, 5, 10]);
    expect(KEYS.reduce((sum, k) => sum + RATING_WEIGHTS[k], 0)).toBe(100);
  });
});

describe("computeScore", () => {
  it("hepsi 5 → 100, hepsi 0 → 0, hepsi 3 → 60", () => {
    expect(computeScore(all(5))).toBe(100);
    expect(computeScore(all(0))).toBe(0);
    expect(computeScore(all(3))).toBe(60);
  });

  it("boş girdi 0 döner", () => {
    expect(computeScore({})).toBe(0);
  });

  it("verilmeyen kategoriler paydadan da çıkar (eski davranış)", () => {
    expect(computeScore({ communication: 5, customerService: 5 })).toBe(100);
    expect(computeScore({ communication: 5, customerService: 0 })).toBe(43); // 15/35
    expect(computeScore({ communication: 5, punctuality: null, teamwork: undefined })).toBe(100);
  });

  it("ağırlık farkı: iletişim 5 + müşteri hizmeti 0, müşteri hizmeti 5 + iletişim 0'dan yüksektir", () => {
    const a = computeScore({ ...all(0), communication: 5 });
    const b = computeScore({ ...all(0), customerService: 5 });
    expect(a).toBe(15);
    expect(b).toBe(20);
  });

  it("property: puan her zaman [0,100] tam sayıdır", () => {
    const rating = fc.integer({ min: 0, max: 5 });
    const ratings = fc.record(
      Object.fromEntries(KEYS.map((k) => [k, fc.option(rating, { nil: undefined })])) as Record<
        RatingKey,
        fc.Arbitrary<number | undefined>
      >,
    );
    fc.assert(
      fc.property(ratings, (r) => {
        const s = computeScore(r);
        return Number.isInteger(s) && s >= 0 && s <= 100;
      }),
    );
  });

  it("property: her puan kategorisinde monoton (artan puan skoru düşürmez)", () => {
    const rating = fc.integer({ min: 0, max: 5 });
    const full = fc.record(Object.fromEntries(KEYS.map((k) => [k, rating])) as Record<RatingKey, fc.Arbitrary<number>>);
    fc.assert(
      fc.property(full, fc.constantFrom(...KEYS), fc.integer({ min: 0, max: 4 }), (r, key, low) => {
        const lower = computeScore({ ...r, [key]: low });
        const higher = computeScore({ ...r, [key]: low + 1 });
        return higher >= lower;
      }),
    );
  });

  it("property: kısmi puanlamada da (varlık kümesi sabit) monoton", () => {
    const rating = fc.integer({ min: 0, max: 5 });
    const partial = fc.record(
      Object.fromEntries(KEYS.map((k) => [k, fc.option(rating, { nil: undefined })])) as Record<
        RatingKey,
        fc.Arbitrary<number | undefined>
      >,
    );
    fc.assert(
      fc.property(partial, fc.constantFrom(...KEYS), fc.integer({ min: 0, max: 4 }), (r, key, low) => {
        const lower = computeScore({ ...r, [key]: low });
        const higher = computeScore({ ...r, [key]: low + 1 });
        return higher >= lower;
      }),
    );
  });
});

describe("ratingBand eşikleri", () => {
  const pairs: [number, string, number, string][] = [
    [90, "excellent", 89, "successful"],
    [80, "successful", 79, "good"],
    [60, "good", 59, "average"],
    [40, "average", 39, "bad"],
    [20, "bad", 19, "very_bad"],
  ];

  for (const [hi, hiBand, lo, loBand] of pairs) {
    it(`${lo}/${hi} sınırı: ${lo} → ${loBand}, ${hi} → ${hiBand}`, () => {
      expect(ratingBand(hi)).toBe(hiBand);
      expect(ratingBand(lo)).toBe(loBand);
    });

    it(`${lo}/${hi} sınırı puanlamadan uçtan uca (kategori puanlarından)`, () => {
      const high = ratingsWithWeightedSum(hi * 5);
      const low = ratingsWithWeightedSum(lo * 5);
      expect(computeScore(high)).toBe(hi);
      expect(computeScore(low)).toBe(lo);
      expect(ratingBand(computeScore(high))).toBe(hiBand);
      expect(ratingBand(computeScore(low))).toBe(loBand);
    });
  }

  it("uçlar: 100 excellent, 0 very_bad", () => {
    expect(ratingBand(100)).toBe("excellent");
    expect(ratingBand(0)).toBe("very_bad");
  });

  it("property: bant puanla birlikte azalmaz", () => {
    const order = ["very_bad", "bad", "average", "good", "successful", "excellent"];
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99 }), (s) => {
        return order.indexOf(ratingBand(s + 1)) >= order.indexOf(ratingBand(s));
      }),
    );
  });
});
