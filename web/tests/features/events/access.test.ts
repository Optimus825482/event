import { describe, expect, it } from "vitest";
import { canAccessEvent } from "@/features/events/access";

const ev = (organizerId: string) => ({ organizerId });

describe("canAccessEvent (M10: tek etkinlik sahipliği kuralı)", () => {
  it("organizatör yalnızca kendi etkinliğine erişir", () => {
    const org = { id: "u1", role: "organizer" as const };
    expect(canAccessEvent(org, ev("u1"))).toBe(true);
    expect(canAccessEvent(org, ev("u2"))).toBe(false);
  });

  it("organizatör dışındaki roller etkinlik sahibine bakılmaksızın geçer (rol/izin denetimi başka katmanda)", () => {
    for (const role of ["admin", "staff", "leader", "controller", "venue_owner"] as const) {
      expect(canAccessEvent({ id: "u9", role }, ev("u1"))).toBe(true);
    }
  });
});
