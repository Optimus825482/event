import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Tx } from "@/db/client";
import { artists, eventSaleSettings, eventSiteContent, events, systemSettings } from "@/db/schema";
import { getSaleSettings } from "@/features/seating/settings-service";
import { pgConstraintOf } from "@/lib/pg-error";
import { createEvent, pgErrorCode } from "../helpers/factories";
import { inRollback } from "./isolation";

async function expectPgError(
  tx: Tx,
  code: string,
  op: (sp: Tx) => Promise<unknown>,
  constraint?: string,
): Promise<void> {
  let caught: unknown;
  try {
    await tx.transaction(async (sp) => {
      await op(sp);
    });
  } catch (err) {
    caught = err;
  }
  expect(caught, `beklenen hata ${code} fırlatılmadı`).toBeDefined();
  expect(pgErrorCode(caught)).toBe(code);
  if (constraint) expect(pgConstraintOf(caught)).toBe(constraint);
}

describe("şema: satış sitesi ekleri", () => {
  it("yeni sütunların varsayılanları: demo kapalı, etkinlik demo değil, satış şekli seat", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      expect(event.isDemo).toBe(false);

      const [settings] = await tx.insert(eventSaleSettings).values({ eventId: event.id }).returning();
      expect(settings?.saleMode).toBe("seat");

      const [sys] = await tx.insert(systemSettings).values({}).returning();
      expect(sys?.salesDemoEnabled).toBe(false);

      const [artist] = await tx
        .insert(artists)
        .values({ name: "Deneme Sanatçı", nameKey: "DENEME SANATÇI" })
        .returning();
      expect(artist?.image).toBeNull();
      expect(artist?.isDemo).toBe(false);
    });
  });

  it("sale_mode yalnızca table ya da seat olabilir", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      await expectPgError(
        tx,
        "23514",
        (sp) =>
          sp.execute(
            sql`insert into event_sale_settings (event_id, sale_mode) values (${event.id}, 'row')`,
          ),
        "event_sale_settings_sale_mode_valid",
      );
    });
  });

  it("event_site_content etkinlik başına tek satırdır ve etkinlikle silinir", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const [row] = await tx
        .insert(eventSiteContent)
        .values({ eventId: event.id, summary: "Özel gala", sightlineSet: "diamond" })
        .returning();
      expect(row?.eventId).toBe(event.id);
      expect(row?.summary).toBe("Özel gala");

      await expectPgError(
        tx,
        "23505",
        (sp) => sp.insert(eventSiteContent).values({ eventId: event.id }),
        "event_site_content_pkey",
      );

      await tx.delete(events).where(eq(events.id, event.id));
      const left = await tx.select().from(eventSiteContent).where(eq(eventSiteContent.eventId, event.id));
      expect(left).toHaveLength(0);
    });
  });

  it("getSaleSettings satış şeklini okur; satır yoksa seat", async () => {
    await inRollback(async (tx) => {
      const withoutRow = await createEvent(tx);
      expect((await getSaleSettings(tx, withoutRow.id)).saleMode).toBe("seat");

      const withRow = await createEvent(tx);
      await tx.insert(eventSaleSettings).values({ eventId: withRow.id, saleMode: "table" });
      expect((await getSaleSettings(tx, withRow.id)).saleMode).toBe("table");
    });
  });
});
