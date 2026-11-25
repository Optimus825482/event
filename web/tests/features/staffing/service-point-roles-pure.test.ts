import { describe, expect, it } from "vitest";
import { createOrganizationStore, toSavePayload } from "@/features/staffing/components/store";
import type { Organization } from "@/features/staffing/organization-service";
import {
  hasCustomTimes,
  isRoleAllowed,
  mergeRoleRequirements,
  overrideTimesError,
  roleCoverage,
  storedOverride,
} from "@/features/staffing/service-point-roles";

const SP = "00000000-0000-4000-8000-0000000000b1";
const SHIFT = { startTime: "18:00:00", endTime: "02:00:00" };

function fakeOrganization(): Organization {
  return {
    event: { id: "00000000-0000-4000-8000-0000000000e1", name: "Etkinlik", status: "draft", startsAt: new Date() },
    editable: true,
    tables: [],
    teams: [],
    groups: [],
    assignments: [],
    extraStaff: [],
    servicePoints: [{ id: SP, name: "Bar 1", pointType: "bar", requiredStaffCount: 2, color: "#06b6d4" }],
    servicePointRoles: [{ servicePointId: SP, roles: [] }],
    shifts: [],
    staff: [],
    reviewHints: {},
    locaStaffing: [],
    sectionHeads: [],
  };
}

describe("servis noktası rol kuralları (saf)", () => {
  it("izinli roller + sayılar birleşir, sayısız rol 0 olur, tekrarlar düşer", () => {
    expect(mergeRoleRequirements(["Barman", "hostes"], [{ role: "barman", requiredCount: 2 }, { role: "runner", requiredCount: 1 }])).toEqual([
      { role: "barman", requiredCount: 2 },
      { role: "hostes", requiredCount: 0 },
      { role: "runner", requiredCount: 1 },
    ]);
  });

  it("rol tanımsızsa her görev, tanımlıysa yalnızca listedeki görev izinlidir", () => {
    expect(isRoleAllowed([], null)).toBe(true);
    const roles = [{ role: "barman", requiredCount: 1 }];
    expect(isRoleAllowed(roles, " BARMAN")).toBe(true);
    expect(isRoleAllowed(roles, "garson")).toBe(false);
    expect(isRoleAllowed(roles, null)).toBe(false);
  });

  it("rol başına atanan / gereken ve listede olmayanlar", () => {
    const roles = [{ role: "barman", requiredCount: 2 }, { role: "hostes", requiredCount: 0 }];
    const out = roleCoverage(roles, [{ role: "Barman" }, { role: "garson" }, { role: null }]);
    expect(out.rows).toEqual([
      { role: "barman", label: "Barmen", required: 2, assigned: 1 },
      { role: "hostes", label: "Hostes", required: 0, assigned: 0 },
    ]);
    expect(out.other).toBe(2);
  });

  it("özel saat: çift ve farklılık kuralı, vardiyayla aynıysa özel sayılmaz ve saklanmaz", () => {
    expect(overrideTimesError("18:00", "02:00")).toBeNull();
    expect(overrideTimesError(null, null)).toBeNull();
    expect(overrideTimesError("18:00", null)).not.toBeNull();
    expect(overrideTimesError("18:00", "18:00:00")).not.toBeNull();
    expect(hasCustomTimes({ shiftStart: "18:00", shiftEnd: "02:00" }, SHIFT)).toBe(false);
    expect(hasCustomTimes({ shiftStart: "19:00", shiftEnd: "02:00" }, SHIFT)).toBe(true);
    expect(hasCustomTimes({ shiftStart: "19:00", shiftEnd: "02:00" }, null)).toBe(true);
    expect(storedOverride("18:00", "02:00", SHIFT)).toEqual({ shiftStart: null, shiftEnd: null });
    expect(storedOverride("19:00", "02:00", SHIFT)).toEqual({ shiftStart: "19:00", shiftEnd: "02:00" });
  });
});

describe("sihirbaz deposu: servis noktası rolleri ve özel saat geçmişi", () => {
  it("rol değişiklikleri geri alınır / yinelenir; aynı rolün sayısını yazmak tek adımdır; kayda girer", () => {
    const store = createOrganizationStore(fakeOrganization());
    const s = () => store.getState();
    s().setPointRoles(SP, [{ role: "barman", requiredCount: 1 }]);
    s().setPointRoles(SP, [{ role: "barman", requiredCount: 2 }], "barman:count");
    s().setPointRoles(SP, [{ role: "barman", requiredCount: 3 }], "barman:count");
    expect(s().servicePointRoles[0]?.roles).toEqual([{ role: "barman", requiredCount: 3 }]);
    expect(toSavePayload("e", s()).servicePointRoles).toEqual([{ servicePointId: SP, roles: [{ role: "barman", requiredCount: 3 }] }]);

    s().undo();
    expect(s().servicePointRoles[0]?.roles).toEqual([{ role: "barman", requiredCount: 1 }]);
    s().undo();
    expect(s().servicePointRoles[0]?.roles).toEqual([]);
    expect(s().dirty).toBe(false);
    s().redo();
    s().redo();
    expect(s().servicePointRoles[0]?.roles).toEqual([{ role: "barman", requiredCount: 3 }]);
  });

  it("özel saat yazımı geri alınır", () => {
    const org = fakeOrganization();
    org.staff = [{ id: "00000000-0000-4000-8000-0000000000a1", fullName: "Ali", sicilNo: "1", color: null }];
    const store = createOrganizationStore(org);
    const s = () => store.getState();
    s().addAssignment("table");
    const id = s().assignments[0]!.id;
    s().updateAssignment(id, { shiftStart: "19:00", shiftEnd: "03:00" });
    s().updateAssignment(id, { shiftStart: "19:30", shiftEnd: "03:00" });
    expect(s().assignments[0]).toMatchObject({ shiftStart: "19:30", shiftEnd: "03:00" });
    s().undo();
    expect(s().assignments[0]).toMatchObject({ shiftStart: null, shiftEnd: null });
  });
});
