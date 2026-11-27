import { describe, expect, it } from "vitest";
import { saveSiteContentSchema, siteImageSchema } from "@/features/sales-site/schemas";

const ID = "00000000-0000-4000-8000-000000000001";

describe("sales-site schemas", () => {
  it("kapı saati Kıbrıs duvar saati olarak okunur", () => {
    expect(saveSiteContentSchema.parse({ eventId: ID, doorsOpenAt: "2026-12-31T19:30" }).doorsOpenAt?.toISOString()).toBe(
      "2026-12-31T17:30:00.000Z",
    );
  });

  it("boş alanlar null olur, metin kırpılır", () => {
    expect(
      saveSiteContentSchema.parse({
        eventId: ID,
        summary: "  Gala  ",
        ageLimit: "",
        dressCode: " ",
        doorsOpenAt: "",
        sightlineSet: "",
      }),
    ).toEqual({
      eventId: ID,
      summary: "Gala",
      doorsOpenAt: null,
      ageLimit: null,
      dressCode: null,
      sightlineSet: null,
    });
  });

  it("bilinmeyen sahne görüşü seti ve 2001 karakterlik tanıtım reddedilir", () => {
    expect(saveSiteContentSchema.safeParse({ eventId: ID, sightlineSet: "x" }).success).toBe(false);
    expect(saveSiteContentSchema.safeParse({ eventId: ID, summary: "a".repeat(2001) }).success).toBe(false);
    expect(saveSiteContentSchema.safeParse({ eventId: ID, sightlineSet: "diamond" }).success).toBe(true);
  });

  it("geçersiz kapı saati metni reddedilir", () => {
    const res = saveSiteContentSchema.safeParse({ eventId: ID, doorsOpenAt: "abc" });
    expect(res.success).toBe(false);
  });

  it("slot yalnızca cover, hero, artist olabilir", () => {
    expect(siteImageSchema.safeParse({ eventId: ID, slot: "logo" }).success).toBe(false);
    expect(siteImageSchema.safeParse({ eventId: ID, slot: "cover" }).success).toBe(true);
  });
});
