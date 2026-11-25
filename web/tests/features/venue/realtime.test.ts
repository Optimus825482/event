import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { venueTemplates } from "@/db/schema";
import { closeRealtime } from "@/features/realtime/listener";
import { applyVenueTemplate, saveLayout } from "@/features/venue/service";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { watchEvents } from "../realtime/emitted";

const decor = { width: 1200, height: 800, elements: [] };

async function setup() {
  const actor = await persistActor(db, managerActor("entertainment"));
  const event = await f.createEvent(db, { organizerId: actor.id });
  return { actor, event };
}

describe("mekân servisi gerçek zamanlı olaylar", () => {
  beforeEach(async () => {
    await truncateAll();
  });
  afterAll(async () => {
    await closeRealtime();
  });

  it("saveLayout: commit sonrası tek table.updated; hata durumunda hiçbiri", async () => {
    const { actor, event } = await setup();
    const watch = await watchEvents(event.id);
    try {
      await expect(
        saveLayout(db, actor, {
          eventId: event.id,
          tables: [
            { label: "M1", capacity: 4, x: 0, y: 0 },
            { label: "m1", capacity: 4, x: 10, y: 10 },
          ],
          decor,
        }),
      ).rejects.toThrow();
      expect(await watch.settled()).toEqual([]);

      await saveLayout(db, actor, { eventId: event.id, tables: [{ label: "M1", capacity: 4, x: 0, y: 0 }], decor });
      expect(await watch.settled()).toEqual(["table.updated"]);
    } finally {
      watch.stop();
    }
  });

  it("applyVenueTemplate: commit sonrası tek table.updated; olmayan şablonda hiçbiri", async () => {
    const { actor, event } = await setup();
    const [template] = await db
      .insert(venueTemplates)
      .values({
        name: "Salon",
        isPublic: true,
        createdById: actor.id,
        layoutData: {
          version: 1,
          tables: [{ label: "T1", capacity: 6, tableTypeId: null, x: 1, y: 1, rotation: 0, isLoca: false }],
          decor,
        },
      })
      .returning();
    if (!template) throw new Error("şablon yok");
    const watch = await watchEvents(event.id);
    try {
      await expect(
        applyVenueTemplate(db, actor, { eventId: event.id, templateId: "00000000-0000-4000-8000-000000000000" }),
      ).rejects.toThrow();
      expect(await watch.settled()).toEqual([]);

      await applyVenueTemplate(db, actor, { eventId: event.id, templateId: template.id });
      expect(await watch.settled()).toEqual(["table.updated"]);
    } finally {
      watch.stop();
    }
  });
});
