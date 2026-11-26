import { describe, expect, it } from "vitest";
import { EVENT_SECTIONS, visibleEventSections } from "@/features/events/sections";
import { managerActor, memberActor } from "../../helpers/actors";

describe("etkinlik bölümleri", () => {
  it("bölümler sözleşmedeki sırada ve adreslerdedir", () =>
    expect(EVENT_SECTIONS.map((s) => [s.key, s.label, s.href("E1"), s.module])).toEqual([
      ["overview", "Genel", "/events/E1", "events"],
      ["tables", "Masalar ve Satış", "/events/E1/tables", "ticketing"],
      ["finance", "Finans", "/events/E1/finance", "finance"],
      ["orders", "Siparişler", "/events/E1/orders", "ticketing"],
    ]));

  it("hazır olmayan bölümler gizlidir", () =>
    expect(visibleEventSections(managerActor("entertainment")).map((s) => s.key)).toEqual(["overview", "tables"]));

  it.each(["fnb", "casino"] as const)("%s yöneticisi yalnızca Genel bölümünü görür", (department) =>
    expect(visibleEventSections(managerActor(department)).map((s) => s.key)).toEqual(["overview"]));

  it("ticketing izni olmayan Entertainment kullanıcısı Masalar ve Satış bölümünü görmez", () =>
    expect(visibleEventSections(memberActor("entertainment", { events: "v---" })).map((s) => s.key)).toEqual([
      "overview",
    ]));
});
