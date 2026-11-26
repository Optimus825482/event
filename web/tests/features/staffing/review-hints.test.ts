import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { events, staffPerformanceReviews } from "@/db/schema";
import { getOrganization } from "@/features/staffing/organization-service";
import { listReviewHints } from "@/features/staffing/review-hints";
import { adminActor, memberActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { createShortReview } from "../../helpers/fnb";
import { makeActor, setupEvent } from "./helpers";

const PRIVATE = "GİZLİ-ÖZEL-NOT-XYZ";

function pastEvent(organizerId: string, name: string, startsAt: string) {
  return f.createEvent(db, { organizerId, name, startsAt: new Date(startsAt) });
}

async function setup() {
  const { actor, event, people } = await setupEvent();
  const reviewer = await f.createUser(db);
  return { actor, event, staffId: people[0]!.id, reviewer, others: people.slice(1) };
}

describe("personel seçici geçmiş değerlendirme ipucu", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("anahtar kapalıyken ipucu dönmez", async () => {
    const { actor, event, staffId, reviewer } = await setup();
    const e1 = await pastEvent(actor.id, "E1", "2026-01-10T18:00:00Z");
    await createShortReview(db, { eventId: e1.id, staffId, reviewerId: reviewer.id, overallRating: 3 });
    const hints = await listReviewHints(db, actor, { id: event.id, reviewHistoryVisible: false }, [staffId]);
    expect(hints).toEqual({});
  });

  it("yalnızca tamamlanmış ve başka etkinliklere ait değerlendirmeler", async () => {
    const { actor, event, staffId, reviewer } = await setup();
    const e1 = await pastEvent(actor.id, "E1", "2026-01-10T18:00:00Z");
    const e2 = await pastEvent(actor.id, "E2", "2026-02-10T18:00:00Z");
    await createShortReview(db, { eventId: e1.id, staffId, reviewerId: reviewer.id, overallRating: 4 });
    // taslak
    await createShortReview(db, { eventId: e2.id, staffId, reviewerId: reviewer.id, overallRating: 2, isCompleted: false });
    // mevcut etkinlik
    await createShortReview(db, { eventId: event.id, staffId, reviewerId: reviewer.id, overallRating: 1 });
    const hints = await listReviewHints(db, actor, { id: event.id, reviewHistoryVisible: true }, [staffId]);
    expect(hints[staffId]).toMatchObject({ reviewCount: 1, averageScore: 80, lastEventName: "E1" });
  });

  it("ortalama ve son değerlendirme; değerlendirmesi olmayan personel anahtar olmaz", async () => {
    const { actor, event, staffId, reviewer, others } = await setup();
    const e1 = await pastEvent(actor.id, "E1", "2026-01-10T18:00:00Z");
    const e2 = await pastEvent(actor.id, "E2", "2026-02-10T18:00:00Z");
    // E2 önce yazılsa da "son" etkinlik başlangıcına göre belirlenir.
    const r2 = await createShortReview(db, { eventId: e2.id, staffId, reviewerId: reviewer.id, overallRating: 4 });
    await createShortReview(db, { eventId: e1.id, staffId, reviewerId: reviewer.id, overallRating: 3 });
    await db.update(staffPerformanceReviews).set({ nextEventNotes: "Bar'a alın" }).where(eq(staffPerformanceReviews.id, r2.id));
    const hints = await listReviewHints(db, actor, { id: event.id, reviewHistoryVisible: true }, [staffId, others[0]!.id]);
    expect(hints).toEqual({
      [staffId]: {
        reviewCount: 2,
        averageScore: 70,
        lastBand: "successful",
        lastEventName: "E2",
        lastNextEventNotes: "Bar'a alın",
      },
    });
  });

  it("özel notlar ve değerlendirici kimliği sızmaz", async () => {
    const { actor, event, staffId, reviewer } = await setup();
    const e1 = await pastEvent(actor.id, "E1", "2026-01-10T18:00:00Z");
    const r = await createShortReview(db, { eventId: e1.id, staffId, reviewerId: reviewer.id, overallRating: 4 });
    await db
      .update(staffPerformanceReviews)
      .set({ privateNotes: PRIVATE, comment: "GENEL-YORUM" })
      .where(eq(staffPerformanceReviews.id, r.id));
    const hints = await listReviewHints(db, actor, { id: event.id, reviewHistoryVisible: true }, [staffId]);
    const json = JSON.stringify(hints);
    expect(json).not.toContain(PRIVATE);
    expect(json).not.toContain("GENEL-YORUM");
    expect(json).not.toContain(reviewer.id);
    expect(Object.keys(hints[staffId]!).sort()).toEqual([
      "averageScore",
      "lastBand",
      "lastEventName",
      "lastNextEventNotes",
      "reviewCount",
    ]);
  });

  it("staff:edit izni olmayan aktör ipucu görmez", async () => {
    const { actor, event, staffId, reviewer } = await setup();
    const e1 = await pastEvent(actor.id, "E1", "2026-01-10T18:00:00Z");
    await createShortReview(db, { eventId: e1.id, staffId, reviewerId: reviewer.id, overallRating: 4 });
    const ev = { id: event.id, reviewHistoryVisible: true };
    expect(await listReviewHints(db, memberActor("fnb", { staff: "v---" }), ev, [staffId])).toEqual({});
    expect(Object.keys(await listReviewHints(db, memberActor("fnb", { staff: "v-e-" }), ev, [staffId]))).toEqual([staffId]);
    expect(Object.keys(await listReviewHints(db, adminActor(), ev, [staffId]))).toEqual([staffId]);
  });

  it("getOrganization reviewHints alanını doldurur", async () => {
    const { actor, event, staffId, reviewer } = await setup();
    const e1 = await pastEvent(actor.id, "E1", "2026-01-10T18:00:00Z");
    await createShortReview(db, { eventId: e1.id, staffId, reviewerId: reviewer.id, overallRating: 4 });
    expect((await getOrganization(db, actor, event.id)).reviewHints).toEqual({});
    await db.update(events).set({ reviewHistoryVisible: true }).where(eq(events.id, event.id));
    const org = await getOrganization(db, actor, event.id);
    expect(org.reviewHints[staffId]).toMatchObject({ reviewCount: 1, averageScore: 80, lastEventName: "E1" });
  });

  it("getOrganization: staff:view var staff:edit yok → reviewHints boş (anahtar açık, geçmiş değerlendirme var)", async () => {
    const { actor, event, staffId, reviewer } = await setup();
    const e1 = await pastEvent(actor.id, "E1", "2026-01-10T18:00:00Z");
    await createShortReview(db, { eventId: e1.id, staffId, reviewerId: reviewer.id, overallRating: 4 });
    await db.update(events).set({ reviewHistoryVisible: true }).where(eq(events.id, event.id));
    // Kontrol: düzenleme izinli yönetici ipucunu görür.
    expect((await getOrganization(db, actor, event.id)).reviewHints[staffId]).toBeDefined();
    const viewer = await makeActor(memberActor("fnb", { staff: "v---" }));
    const org = await getOrganization(db, viewer, event.id);
    expect(org.staff.map((s) => s.id)).toContain(staffId);
    expect(org.reviewHints).toEqual({});
  });
});
