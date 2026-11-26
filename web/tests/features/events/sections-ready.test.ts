import { describe, expect, it, vi } from "vitest";
import { managerActor } from "../../helpers/actors";

vi.mock("@/features/finance/ready", () => ({ FINANCE_READY: true }));
vi.mock("@/features/ticketing/ready", () => ({ TICKETING_READY: true }));

const { visibleEventSections } = await import("@/features/events/sections");

describe("etkinlik bölümleri (fazlar hazır)", () => {
  it("bayraklar açılınca Finans ve Siparişler görünür", () =>
    expect(visibleEventSections(managerActor("entertainment")).map((s) => s.key)).toEqual([
      "overview",
      "tables",
      "finance",
      "orders",
    ]));
});
