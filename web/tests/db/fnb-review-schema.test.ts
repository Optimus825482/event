import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { eventSectionHeads, events, staffPerformanceReviews } from "@/db/schema";
import { REVIEW_ROUTES } from "@/features/reviews/routes";
import { createEvent, createStaff, createTableGroup, createUser, pgErrorCode } from "../helpers/factories";
import { createSectionHead, createShortReview } from "../helpers/fnb";
import { inRollback } from "./isolation";

type Tx = Parameters<Parameters<typeof inRollback>[0]>[0];

/** Hatalı ifadeyi savepoint içinde çalıştırıp SQLSTATE kodunu döndürür. */
async function codeOf(tx: Tx, fn: (sp: Tx) => Promise<unknown>): Promise<string | undefined> {
  try {
    await tx.transaction(async (sp) => {
      await fn(sp as unknown as Tx);
    });
  } catch (err) {
    return pgErrorCode(err);
  }
  return undefined;
}

async function base(tx: Tx) {
  const event = await createEvent(tx);
  const staff = await createStaff(tx);
  const reviewer = await createUser(tx);
  return { event, staff, reviewer };
}

describe("F&B değerlendirme şeması", () => {
  it("eski değerlendirme satırı 'full' türündedir", async () => {
    await inRollback(async (tx) => {
      const { event, staff, reviewer } = await base(tx);
      const [row] = await tx
        .insert(staffPerformanceReviews)
        .values({ eventId: event.id, staffId: staff.id, reviewerId: reviewer.id, score: 70, rating: "good" })
        .returning();
      expect(row?.formKind).toBe("full");
      expect(row?.overallRating).toBeNull();
    });
  });

  it("kısa form tamamlanmışsa genel puan zorunludur", async () => {
    await inRollback(async (tx) => {
      const { event, staff, reviewer } = await base(tx);
      const code = await codeOf(tx, (sp) =>
        createShortReview(sp, {
          eventId: event.id,
          staffId: staff.id,
          reviewerId: reviewer.id,
          overallRating: null,
          isCompleted: true,
        }),
      );
      expect(code).toBe("23514");
      const draft = await createShortReview(tx, {
        eventId: event.id,
        staffId: staff.id,
        reviewerId: reviewer.id,
        overallRating: null,
        isCompleted: false,
      });
      expect(draft.overallRating).toBeNull();
    });
  });

  it("genel puan 1–5 arasıdır", async () => {
    await inRollback(async (tx) => {
      const { event, staff, reviewer } = await base(tx);
      for (const bad of [0, 6]) {
        const code = await codeOf(tx, (sp) =>
          createShortReview(sp, {
            eventId: event.id,
            staffId: staff.id,
            reviewerId: reviewer.id,
            overallRating: bad,
            isCompleted: false,
          }),
        );
        expect(code).toBe("23514");
      }
      const ok = await createShortReview(tx, {
        eventId: event.id,
        staffId: staff.id,
        reviewerId: reviewer.id,
        overallRating: 5,
      });
      expect(ok.overallRating).toBe(5);
    });
  });

  it("form türü yalnızca short/full", async () => {
    await inRollback(async (tx) => {
      const { event, staff, reviewer } = await base(tx);
      const code = await codeOf(tx, (sp) =>
        sp
          .insert(staffPerformanceReviews)
          .values({
            eventId: event.id,
            staffId: staff.id,
            reviewerId: reviewer.id,
            score: 50,
            rating: "average",
            formKind: "medium",
          })
          .then(() => undefined),
      );
      expect(code).toBe("23514");
    });
  });

  it("grup tipi yalnızca standard/loca", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const code = await codeOf(tx, (sp) => createTableGroup(sp, event.id, { groupType: "vip" }));
      expect(code).toBe("23514");
      const loca = await createTableGroup(tx, event.id, { groupType: "loca" });
      expect(loca.groupType).toBe("loca");
    });
  });

  it("aynı personel etkinliğe iki kez kısım sorumlusu atanamaz", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const staff = await createStaff(tx);
      await createSectionHead(tx, { eventId: event.id, staffId: staff.id });
      const code = await codeOf(tx, (sp) => createSectionHead(sp, { eventId: event.id, staffId: staff.id }));
      expect(code).toBe("23505");
    });
  });

  it("etkinlik silinince kısım sorumluları silinir", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const staff = await createStaff(tx);
      await createSectionHead(tx, { eventId: event.id, staffId: staff.id });
      await tx.delete(events).where(eq(events.id, event.id));
      const rows = await tx.select().from(eventSectionHeads).where(eq(eventSectionHeads.eventId, event.id));
      expect(rows).toHaveLength(0);
    });
  });

  it("REVIEW_ROUTES", () => {
    expect(REVIEW_ROUTES.reviewBoard("e1")).toBe("/fnb/team/reviews/e1");
    expect(REVIEW_ROUTES.member("s1")).toBe("/fnb/team/members/s1");
    expect(REVIEW_ROUTES.event("e1")).toBe("/fnb/team/events/e1");
    expect(REVIEW_ROUTES.home).toBe("/fnb/team");
  });
});
