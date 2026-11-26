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

  it("revert ve reopen türleri kabul edilir", async () => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      await tx
        .insert(eventStageTransitions)
        .values({ eventId: e.id, fromStage: "layout_ready", toStage: "defined", kind: "revert" });
      await tx
        .insert(eventStageTransitions)
        .values({ eventId: e.id, fromStage: "sales_closed", toStage: "on_sale", kind: "reopen" });
      expect(await listTransitions(tx, e.id)).toHaveLength(2);
    });
  });

  it("aynı işlemdeki geçişler en yeni önce sıralanır", async () => {
    await inRollback(async (tx) => {
      const e = await createEvent(tx);
      const steps = [
        ["defined", "layout_ready"],
        ["layout_ready", "staffing_ready"],
        ["staffing_ready", "tables_classified"],
      ] as const;
      for (const [fromStage, toStage] of steps) {
        await tx.insert(eventStageTransitions).values({ eventId: e.id, fromStage, toStage, kind: "advance" });
      }
      const rows = await listTransitions(tx, e.id);
      expect(rows.map((r) => r.toStage)).toEqual(["tables_classified", "staffing_ready", "layout_ready"]);
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
