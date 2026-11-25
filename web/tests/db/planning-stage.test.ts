import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { eventStageTransitions, events } from "@/db/schema";
import { createEvent, pgErrorCode } from "../helpers/factories";
import { listTransitions } from "../helpers/planning";
import { inRollback } from "./isolation";

describe("planlama aşaması şeması", () => {
  it("yeni etkinlik 'defined' aşamasında başlar, stage_changed_at boştur", async () => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      expect(e.planningStage).toBe("defined");
      expect(e.stageChangedAt).toBeNull();
    });
  });

  it("geçiş türü yalnızca advance/revert/reopen olabilir", async () => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      let caught: unknown;
      try {
        await tx.transaction(async (sp) => {
          await sp
            .insert(eventStageTransitions)
            .values({ eventId: e.id, fromStage: "defined", toStage: "layout_ready", kind: "skip" });
        });
      } catch (err) {
        caught = err;
      }
      expect(pgErrorCode(caught)).toBe("23514");
      await tx
        .insert(eventStageTransitions)
        .values({ eventId: e.id, fromStage: "defined", toStage: "layout_ready", kind: "advance" });
      expect(await listTransitions(tx, e.id)).toHaveLength(1);
    });
  });

  it("etkinlik silinince geçiş geçmişi de silinir", async () => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      await tx
        .insert(eventStageTransitions)
        .values({ eventId: e.id, fromStage: "defined", toStage: "layout_ready", kind: "advance" });
      expect(await listTransitions(tx, e.id)).toHaveLength(1);
      await tx.delete(events).where(eq(events.id, e.id));
      expect(await listTransitions(tx, e.id)).toHaveLength(0);
    });
  });

  it("artist_name boş bırakılabilir", async () => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      expect(e.artistName).toBeNull();
      const named = await createEvent(tx, { artistName: "Sanatçı" });
      expect(named.artistName).toBe("Sanatçı");
    });
  });
});
