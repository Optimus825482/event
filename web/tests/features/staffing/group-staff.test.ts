import { describe, expect, it } from "vitest";
import {
  addGroupStaff,
  addServicePointStaff,
  groupStaffAssignments,
  groupStaffAvailability,
  removeGroupStaff,
  servicePointAssignments,
  servicePointAvailability,
  servicePointTypeLabel,
  staffingLabel,
  type AssignmentLike,
  type StaffPick,
} from "@/features/staffing/group-staff";

const base = (over: Partial<AssignmentLike>): AssignmentLike => ({
  id: "x",
  staffId: "s",
  shiftId: null,
  teamId: null,
  assignmentType: "table",
  servicePointId: null,
  role: null,
  shiftStart: null,
  shiftEnd: null,
  tableIds: [],
  ...over,
});

let seq = 0;
const create = (pick: StaffPick) => base({ id: `new${++seq}`, staffId: pick.staffId, shiftId: pick.shiftId, role: pick.role });
const group = { id: "g", teamId: "t1", tableIds: ["a", "b"] };

describe("grup personeli", () => {
  it("grubun masalarıyla kesişen masa atamaları grubun personelidir", () => {
    const list = [
      base({ id: "1", tableIds: ["a"] }),
      base({ id: "2", tableIds: ["c"] }),
      base({ id: "3", assignmentType: "special_task" }),
    ];
    expect(groupStaffAssignments(list, group).map((a) => a.id)).toEqual(["1"]);
  });

  it("yeni personel grubun masaları ve ekibiyle yeni masa ataması alır", () => {
    const out = addGroupStaff([], { staffId: "p", shiftId: "sh", role: "Garson" }, group, create);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ staffId: "p", shiftId: "sh", role: "Garson", teamId: "t1", tableIds: ["a", "b"] });
  });

  it("aynı vardiyadaki masa atamasına grubun masaları eklenir (çift atama oluşmaz)", () => {
    const list = [base({ id: "1", staffId: "p", tableIds: ["c"], teamId: null })];
    const out = addGroupStaff(list, { staffId: "p", shiftId: null, role: "Komi" }, group, create);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "1", tableIds: ["c", "a", "b"], role: "Komi", teamId: null });
  });

  it("başka görev, başka ekip, zaten grupta ve masasız grup engellenir", () => {
    const other = [base({ id: "1", staffId: "p", assignmentType: "service_point", servicePointId: "sp" })];
    expect(groupStaffAvailability(other, { staffId: "p", shiftId: null }, group)).toEqual({
      ok: false,
      reason: "Bu vardiyada başka bir görevi var",
    });
    const team = [base({ id: "1", staffId: "p", teamId: "t2", tableIds: ["c"] })];
    expect(groupStaffAvailability(team, { staffId: "p", shiftId: null }, group).ok).toBe(false);
    const inside = [base({ id: "1", staffId: "p", tableIds: ["a", "b"] })];
    expect(groupStaffAvailability(inside, { staffId: "p", shiftId: null }, group)).toEqual({ ok: false, reason: "Zaten bu grupta" });
    expect(groupStaffAvailability([], { staffId: "p", shiftId: null }, { ...group, tableIds: [] }).ok).toBe(false);
    expect(addGroupStaff(other, { staffId: "p", shiftId: null, role: null }, group, create)).toEqual(other);
    // Başka vardiya serbesttir.
    expect(groupStaffAvailability(other, { staffId: "p", shiftId: "sh2" }, group)).toEqual({ ok: true, existingId: null });
  });

  it("gruptan çıkarma yalnızca grubun masalarını siler; masasız kalan atama düşer", () => {
    const list = [base({ id: "1", tableIds: ["a", "c"] }), base({ id: "2", tableIds: ["b"] })];
    const out = removeGroupStaff(removeGroupStaff(list, "1", group), "2", group);
    expect(out).toEqual([base({ id: "1", tableIds: ["c"] })]);
  });
});

describe("servis noktası personeli", () => {
  it("noktaya servis noktası ataması eklenir, aynı vardiyada ikinci görev engellenir", () => {
    const out = addServicePointStaff([], { staffId: "p", shiftId: null, role: "Barmen" }, "sp", create);
    expect(out[0]).toMatchObject({ assignmentType: "service_point", servicePointId: "sp", tableIds: [], role: "Barmen" });
    expect(servicePointAssignments(out, "sp")).toHaveLength(1);
    expect(servicePointAvailability(out, { staffId: "p", shiftId: null }, "sp")).toEqual({ ok: false, reason: "Zaten bu noktada" });
    expect(servicePointAvailability(out, { staffId: "p", shiftId: null }, "sp2").ok).toBe(false);
    expect(addServicePointStaff(out, { staffId: "p", shiftId: null, role: null }, "sp2", create)).toHaveLength(1);
  });

  it("doluluk etiketi ve tür adı", () => {
    expect(staffingLabel(2, 3)).toBe("2 / 3");
    expect(staffingLabel(2, 0)).toBe("2");
    expect(servicePointTypeLabel("reception")).toBe("Karşılama");
    expect(servicePointTypeLabel("ozel")).toBe("ozel");
  });
});
