import { describe, expect, it } from "vitest";
import { allowedTransitions } from "@/features/planning/allowed";
import { adminActor, managerActor, memberActor } from "../../helpers/actors";

describe("allowedTransitions", () => {
  it("F&B yöneticisi tanımlı etkinlikte yalnızca yerleşimi hazır işaretler", () =>
    expect(allowedTransitions(managerActor("fnb"), "defined", "draft")).toEqual([{ kind: "advance", to: "layout_ready" }]));

  it("Entertainment yöneticisi tanımlı etkinlikte geçiş yapamaz", () =>
    expect(allowedTransitions(managerActor("entertainment"), "defined", "draft")).toEqual([]));

  it("admin personel planı hazırken ileri ve geri gidebilir", () =>
    expect(allowedTransitions(adminActor(), "staffing_ready", "published")).toEqual([
      { kind: "advance", to: "tables_classified" },
      { kind: "revert", to: "layout_ready" },
    ]));

  it("satış kapalıyken Entertainment yeniden açar, geri alamaz", () =>
    expect(allowedTransitions(managerActor("entertainment"), "sales_closed", "active")).toEqual([
      { kind: "reopen", to: "on_sale" },
    ]));

  it("casino kullanıcısı izin satırı olmadan tahsisi tamamlayamaz, edit izniyle tamamlar", () => {
    expect(allowedTransitions(memberActor("casino", { reservations: "v---" }), "tables_classified", "draft")).toEqual([]);
    expect(allowedTransitions(memberActor("casino", { reservations: "v-e-" }), "tables_classified", "draft")).toEqual([
      { kind: "advance", to: "casino_allocated" },
    ]);
  });

  it("iptal edilmiş etkinlikte hiçbir geçiş yoktur", () =>
    expect(allowedTransitions(adminActor(), "priced", "cancelled")).toEqual([]));

  it("tamamlanmış etkinlikte hiçbir geçiş yoktur", () =>
    expect(allowedTransitions(adminActor(), "on_sale", "completed")).toEqual([]));
});
