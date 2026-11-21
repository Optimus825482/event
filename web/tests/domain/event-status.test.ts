import { describe, expect, it } from "vitest";
import { canTransitionEvent, EVENT_STATUSES, type EventStatus } from "@/domain/event-status";

// Her satır: [from, to, beklenen]. 5x5 = 25 çiftin tamamı, elle yazılmış.
const TABLE: ReadonlyArray<readonly [EventStatus, EventStatus, boolean]> = [
  ["draft", "draft", false],
  ["draft", "published", true],
  ["draft", "active", false],
  ["draft", "completed", false],
  ["draft", "cancelled", true],
  ["published", "draft", true],
  ["published", "published", false],
  ["published", "active", true],
  ["published", "completed", false],
  ["published", "cancelled", true],
  ["active", "draft", false],
  ["active", "published", false],
  ["active", "active", false],
  ["active", "completed", true],
  ["active", "cancelled", true],
  ["completed", "draft", false],
  ["completed", "published", false],
  ["completed", "active", false],
  ["completed", "completed", false],
  ["completed", "cancelled", false],
  ["cancelled", "draft", false],
  ["cancelled", "published", false],
  ["cancelled", "active", false],
  ["cancelled", "completed", false],
  ["cancelled", "cancelled", false],
];

describe("event-status", () => {
  it("EVENT_STATUSES sabit listesi doğru", () => {
    expect(EVENT_STATUSES).toEqual(["draft", "published", "active", "completed", "cancelled"]);
  });

  it("tablo 25 çift içerir", () => {
    expect(TABLE).toHaveLength(25);
  });

  it.each(TABLE)("canTransitionEvent(%s, %s) === %s", (from, to, expected) => {
    expect(canTransitionEvent(from, to)).toBe(expected);
  });

  it("completed → draft izinli değil", () => {
    expect(canTransitionEvent("completed", "draft")).toBe(false);
  });

  it("aynı duruma geçiş her zaman false", () => {
    for (const status of EVENT_STATUSES) {
      expect(canTransitionEvent(status, status)).toBe(false);
    }
  });
});
