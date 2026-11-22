import { describe, expect, it } from "vitest";
import { createOrganizationStore } from "@/features/staffing/components/store";
import type { Organization } from "@/features/staffing/organization-service";

const T1 = "00000000-0000-4000-8000-000000000001";
const T2 = "00000000-0000-4000-8000-000000000002";
const P1 = "00000000-0000-4000-8000-0000000000a1";
const SP = "00000000-0000-4000-8000-0000000000b1";

function fakeOrganization(): Organization {
  return {
    event: { id: "00000000-0000-4000-8000-0000000000e1", name: "Etkinlik", status: "draft", startsAt: new Date() },
    editable: true,
    tables: [
      { id: T1, label: "1", capacity: 10, x: 0, y: 0, isLoca: false },
      { id: T2, label: "2", capacity: 10, x: 100, y: 0, isLoca: false },
    ],
    teams: [],
    groups: [],
    assignments: [],
    extraStaff: [],
    servicePoints: [{ id: SP, name: "Bar 1", pointType: "bar", requiredStaffCount: 2, color: "#06b6d4" }],
    shifts: [],
    staff: [{ id: P1, fullName: "Ali Veli", sicilNo: "001", color: null }],
  };
}

describe("sihirbaz deposu: geri al / yinele", () => {
  it("değişiklikler adım adım geri alınır ve yinelenir; geçmiş boşalınca taslak temizdir", () => {
    const store = createOrganizationStore(fakeOrganization());
    const s = () => store.getState();
    s().addGroup();
    const id = s().groups[0]!.id;
    s().toggleTable(id, T1);
    s().assignTables(id, [T2]);
    expect(s().groups[0]?.tableIds).toEqual([T1, T2]);

    s().undo();
    expect(s().groups[0]?.tableIds).toEqual([T1]);
    s().undo();
    expect(s().groups[0]?.tableIds).toEqual([]);
    s().undo();
    expect(s().groups).toEqual([]);
    expect(s().dirty).toBe(false);
    s().undo();
    expect(s().groups).toEqual([]);

    s().redo();
    s().redo();
    expect(s().groups[0]?.tableIds).toEqual([T1]);
    expect(s().dirty).toBe(true);
  });

  it("aynı alana art arda yazım tek adımdır; değişmeyen toplu atama geçmişe yazılmaz", () => {
    const store = createOrganizationStore(fakeOrganization());
    const s = () => store.getState();
    s().addGroup();
    const id = s().groups[0]!.id;
    s().updateGroup(id, { name: "S" });
    s().updateGroup(id, { name: "Sa" });
    s().updateGroup(id, { name: "Sal" });
    s().assignTables(id, [T1]);
    const depth = s().history.past.length;
    s().assignTables(id, [T1]);
    expect(s().history.past.length).toBe(depth);
    s().undo();
    expect(s().groups[0]?.name).toBe("Sal");
    s().undo();
    expect(s().groups[0]?.name).toBe("Grup 1");
  });

  it("grup ve servis noktası personeli taslağa atama olarak yazılır ve geri alınır", () => {
    const store = createOrganizationStore(fakeOrganization());
    const s = () => store.getState();
    s().addGroup();
    const id = s().groups[0]!.id;
    s().assignTables(id, [T1, T2]);
    s().addGroupStaff(id, { staffId: P1, shiftId: null, role: "Garson" });
    expect(s().assignments[0]).toMatchObject({ staffId: P1, assignmentType: "table", tableIds: [T1, T2], role: "Garson" });

    // Aynı vardiyada ikinci görev eklenmez (sunucunun kuralı).
    s().addServicePointStaff(SP, { staffId: P1, shiftId: null, role: "Barmen" });
    expect(s().assignments).toHaveLength(1);

    s().removeGroupStaff(id, s().assignments[0]!.id);
    expect(s().assignments).toEqual([]);
    s().addServicePointStaff(SP, { staffId: P1, shiftId: null, role: "Barmen" });
    expect(s().assignments[0]).toMatchObject({ assignmentType: "service_point", servicePointId: SP, tableIds: [] });

    s().undo();
    s().undo();
    expect(s().assignments[0]?.assignmentType).toBe("table");
  });

  it("sunucu verisiyle yeniden yükleme geçmişi siler", () => {
    const store = createOrganizationStore(fakeOrganization());
    store.getState().addGroup();
    store.getState().reset(fakeOrganization());
    expect(store.getState().history.past).toEqual([]);
    expect(store.getState().dirty).toBe(false);
  });
});
