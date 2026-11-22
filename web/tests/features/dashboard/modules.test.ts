import { describe, expect, it } from "vitest";
import { visibleNavGroups } from "@/features/auth/nav";
import type { PolicyActor } from "@/features/auth/policy";
import { launcherModules, roleLanding } from "@/features/dashboard/modules";
import { countdownParts } from "@/components/dashboard/countdown";

const actor = (role: PolicyActor["role"]): PolicyActor => ({ id: "u1", role, staffId: null, permissions: [] });
const keys = (role: PolicyActor["role"]) => {
  const a = actor(role);
  return launcherModules(a, visibleNavGroups(a)).map((m) => m.key);
};

describe("launcherModules", () => {
  it("yönetici dört modülü de görür", () => {
    expect(keys("admin")).toEqual(["events", "reservations", "check_in", "admin"]);
  });

  it("organizatör sistem yönetimini görmez", () => {
    expect(keys("organizer")).toEqual(["events", "reservations", "check_in"]);
  });

  it("personel yalnızca rezervasyon ve check-in görür", () => {
    expect(keys("staff")).toEqual(["reservations", "check_in"]);
  });

  it("panel adreslerine yönlendirir", () => {
    const a = actor("admin");
    const hrefs = Object.fromEntries(launcherModules(a, visibleNavGroups(a)).map((m) => [m.key, m.href]));
    expect(hrefs).toMatchObject({ events: "/dashboard", admin: "/admin", reservations: "/reservations" });
  });

  it("olay izni kaldırılmış organizatör için etkinlik panelini atlar", () => {
    const a: PolicyActor = {
      ...actor("organizer"),
      permissions: [{ module: "events", canView: false, canCreate: false, canEdit: false, canDelete: false }],
    };
    const events = launcherModules(a, visibleNavGroups(a)).find((m) => m.key === "events");
    expect(events?.href).not.toBe("/dashboard");
  });
});

describe("roleLanding", () => {
  it("rollere göre çalışma alanı adresi verir", () => {
    expect(roleLanding("leader")).toBe("/leader/reviews");
    expect(roleLanding("controller")).toBe("/check-in");
    expect(roleLanding("venue_owner")).toBe("/venues");
    expect(roleLanding("admin")).toBeNull();
  });
});

describe("countdownParts", () => {
  it("kalan süreyi parçalar, geçmişte sıfırlar", () => {
    const now = Date.UTC(2027, 0, 1);
    expect(countdownParts(now + (2 * 86_400 + 3 * 3_600 + 4 * 60 + 5) * 1000, now)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
    });
    expect(countdownParts(now - 1000, now)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});
