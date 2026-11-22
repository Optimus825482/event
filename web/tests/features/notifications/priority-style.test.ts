import { describe, expect, it } from "vitest";
import { PRIORITY_STYLES } from "@/features/notifications/components/priority-style";
import { PRIORITY_LABELS } from "@/features/notifications/labels";

describe("bildirim öncelik stilleri", () => {
  it("her öncelik için simge ve renk tanımlıdır", () => {
    for (const priority of Object.keys(PRIORITY_LABELS) as (keyof typeof PRIORITY_LABELS)[]) {
      const style = PRIORITY_STYLES[priority];
      expect(style.icon).toBeDefined();
      expect(style.tile).not.toBe("");
      expect(style.badge).not.toBe("");
      expect(style.unreadCard).not.toBe("");
    }
  });

  it("acil kırmızı, yüksek turuncu tonundadır", () => {
    expect(PRIORITY_STYLES.urgent.badge).toContain("red");
    expect(PRIORITY_STYLES.high.badge).toContain("amber");
  });
});
