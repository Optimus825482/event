import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { getReviewBoard } from "@/features/reviews/queries";
import { RATING_KEYS, ratingBand, type RatingKey } from "@/features/reviews/score";
import { isReviewComplete, shortReviewSchema, shortReviewValues, shortScore } from "@/features/reviews/short-form";
import { truncateAll } from "../../helpers/db";
import { createShortReview } from "../../helpers/fnb";
import { setupReviewWorld } from "./helpers";

const base = {
  eventId: "0b0f4c62-6d53-4a3b-8f0e-5f6a1a2b3c4d",
  staffId: "1c1a5d73-7e64-4b4c-9a1f-6a7b2b3c4d5e",
  overallRating: 4,
  comment: null,
  nextEventNotes: null,
};

describe("shortReviewSchema eksik notlar", () => {
  it("comment ve nextEventNotes verilmezse null olur (İngilizce Zod hatası yok)", () => {
    const parsed = shortReviewSchema.parse({ eventId: base.eventId, staffId: base.staffId, overallRating: 3 });
    expect(parsed.comment).toBeNull();
    expect(parsed.nextEventNotes).toBeNull();
  });
});

describe("kısa değerlendirme formu modeli", () => {
  it.each([
    [1, 20, "bad"],
    [2, 40, "average"],
    [3, 60, "good"],
    [4, 80, "successful"],
    [5, 100, "excellent"],
  ] as const)("%i yıldız → %i puan, %s bandı", (stars, score, band) => {
    expect(shortScore(stars)).toBe(score);
    expect(ratingBand(shortScore(stars))).toBe(band);
  });

  it("puansız kısa form 0 puan", () => expect(shortScore(null)).toBe(0));

  it.each([0, 6, 2.5])("geçersiz genel puan %s reddedilir", (v) =>
    expect(shortReviewSchema.safeParse({ ...base, overallRating: v }).error?.issues[0]?.message).toBe(
      "Genel puan 1 ile 5 arasında olmalı",
    ),
  );

  it("501 karakterlik kısa not reddedilir", () => {
    const r = shortReviewSchema.safeParse({ ...base, comment: "a".repeat(501) });
    expect(r.error?.issues[0]?.message).toBe("Kısa not en fazla 500 karakter olabilir");
    expect(shortReviewSchema.safeParse({ ...base, comment: "a".repeat(500) }).success).toBe(true);
  });

  it("501 karakterlik sonraki etkinlik notu reddedilir", () => {
    const r = shortReviewSchema.safeParse({ ...base, nextEventNotes: "a".repeat(501) });
    expect(r.error?.issues[0]?.message).toBe("Sonraki etkinlik notu en fazla 500 karakter olabilir");
  });

  it("boş not null olur", () => {
    const r = shortReviewSchema.parse({ ...base, comment: "  ", nextEventNotes: "" });
    expect(r.comment).toBeNull();
    expect(r.nextEventNotes).toBeNull();
  });

  it("puansız (null) genel puan kabul edilir", () => {
    expect(shortReviewSchema.safeParse({ ...base, overallRating: null }).success).toBe(true);
  });

  it("shortReviewValues kategorileri ve listeleri temizler, privateNotes içermez", () => {
    const values = shortReviewValues(shortReviewSchema.parse({ ...base, comment: "iyi" }));
    for (const key of RATING_KEYS) expect(values[key]).toBeNull();
    expect(values).toMatchObject({
      formKind: "short",
      overallRating: 4,
      score: 80,
      rating: "successful",
      strengths: [],
      improvements: [],
      recommendedTrainings: [],
      comment: "iyi",
      nextEventNotes: null,
    });
    expect("privateNotes" in values).toBe(false);
  });

  it("isReviewComplete", () => {
    const empty = Object.fromEntries(RATING_KEYS.map((k) => [k, null])) as Record<RatingKey, null>;
    const full = Object.fromEntries(RATING_KEYS.map((k) => [k, 3])) as Record<RatingKey, number>;
    expect(isReviewComplete({ ...empty, formKind: "short", overallRating: 4 })).toBe(true);
    expect(isReviewComplete({ ...empty, formKind: "short", overallRating: null })).toBe(false);
    expect(isReviewComplete({ ...full, formKind: "full", overallRating: null })).toBe(true);
    expect(isReviewComplete({ ...full, communication: null, formKind: "full", overallRating: null })).toBe(false);
  });
});

describe("toView", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("form türünü ve genel puanı taşır", async () => {
    const w = await setupReviewWorld();
    await createShortReview(db, {
      eventId: w.event.id,
      staffId: w.member1.id,
      reviewerId: w.leader.id,
      overallRating: 4,
    });
    const board = await getReviewBoard(db, w.leader, w.event.id);
    const review = board.teams[0]?.members.find((m) => m.staffId === w.member1.id)?.review;
    expect(review?.formKind).toBe("short");
    expect(review?.overallRating).toBe(4);
  });
});
