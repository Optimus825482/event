// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GroupStaffDialog } from "@/features/staffing/components/group-staff-dialog";
import { LocaSupervisorCell } from "@/features/staffing/components/loca-supervisor-cell";
import { GroupSupervisorLine } from "@/features/staffing/components/group-supervisor-line";
import { createOrganizationStore, OrganizationStoreContext } from "@/features/staffing/components/store";
import type { Organization } from "@/features/staffing/organization-service";

const person = (id: string, fullName: string) => ({ id, fullName, sicilNo: `S-${id}` });

function makeStore(supervisorStaffId: string | null = null) {
  const org = {
    teams: [],
    groups: [
      { id: "g1", name: "Grup 1", color: "#3b82f6", teamId: null, supervisorStaffId, groupType: "standard", sortOrder: 0, notes: null, tableIds: [] },
    ],
    assignments: [],
    extraStaff: [],
    servicePointRoles: [],
    tables: [],
    staff: [person("p1", "Ayşe Yılmaz"), person("p2", "Mehmet Kaya")],
    shifts: [],
    servicePoints: [],
    reviewHints: {},
    supervisorNames: { gone: "Eski Çalışan" },
  } as unknown as Organization;
  return createOrganizationStore(org);
}

function renderDialog(store: ReturnType<typeof makeStore>, readOnly = false) {
  const group = store.getState().groups[0]!;
  render(
    <OrganizationStoreContext.Provider value={store}>
      <GroupStaffDialog group={group} readOnly={readOnly} />
      <GroupSupervisorLine group={group} />
    </OrganizationStoreContext.Provider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Grup 1 personeli" }));
}

describe("grup penceresinde süpervizör seçimi", () => {
  afterEach(cleanup);

  it("personel seçilir, taslak kirlenir; 'Süpervizörü kaldır' ile kalkar", () => {
    const store = makeStore();
    renderDialog(store);
    expect(screen.getByText("Süpervizör yok")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ayşe Yılmaz süpervizör seç" }));
    expect(store.getState().groups[0]?.supervisorStaffId).toBe("p1");
    expect(store.getState().dirty).toBe(true);
    expect(screen.getAllByText("Ayşe Yılmaz").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Süpervizörü kaldır" }));
    expect(store.getState().groups[0]?.supervisorStaffId).toBeNull();
  });

  it("vardiya ve görev alanları gösterilmez (tek kişi seçimi)", () => {
    renderDialog(makeStore());
    // Personel ekleme bölümündeki seçici vardiya alanını gösterir; süpervizör seçicisi göstermez.
    expect(screen.getAllByLabelText("Eklenecek vardiya")).toHaveLength(1);
  });

  it("salt okunur görünümde seçici ve kaldırma düğmesi yoktur", () => {
    renderDialog(makeStore("p2"), true);
    expect(screen.queryByRole("button", { name: /süpervizör seç/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Süpervizörü kaldır" })).toBeNull();
    expect(screen.getAllByText("Mehmet Kaya").length).toBeGreaterThan(0);
  });

  it("seçili kişi seçicide işaretlenir", () => {
    renderDialog(makeStore("p2"));
    const row = screen.getByRole("button", { name: "Mehmet Kaya süpervizör seç" }).closest("li");
    expect(row?.getAttribute("aria-current")).toBe("true");
    expect(row?.textContent).toContain("Seçili");
    expect(screen.getByRole("button", { name: "Ayşe Yılmaz süpervizör seç" }).closest("li")?.getAttribute("aria-current")).toBeNull();
  });

  it("pasifleşmiş süpervizör gerçek adı ve Pasif rozetiyle gösterilir", () => {
    renderDialog(makeStore("gone"));
    expect(screen.getAllByText("Eski Çalışan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pasif").length).toBeGreaterThan(0);
    expect(screen.queryByText("Aktif olmayan personel")).toBeNull();
  });
});

describe("loca süpervizör hücresi", () => {
  afterEach(cleanup);

  function renderCell(store: ReturnType<typeof makeStore>, props: { groupId: string | null; savedName: string | null; canEdit: boolean }) {
    render(
      <OrganizationStoreContext.Provider value={store}>
        <LocaSupervisorCell groupName="Loca A" {...props} />
      </OrganizationStoreContext.Provider>,
    );
  }

  it("taslaktaki seçimi gösterir; kayıtlı ad yalnızca grup taslakta yoksa kullanılır", () => {
    const store = makeStore("p1");
    renderCell(store, { groupId: "g1", savedName: "Kayıtlı Ad", canEdit: true });
    expect(screen.getByText("Ayşe Yılmaz")).toBeTruthy();
    expect(screen.queryByText("Kayıtlı Ad")).toBeNull();
    cleanup();
    renderCell(makeStore(), { groupId: "silinmis", savedName: "Kayıtlı Ad", canEdit: true });
    expect(screen.getByText("Kayıtlı Ad")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /değiştir/ })).toBeNull();
  });

  it("grupsuz loca tire gösterir; salt okunurda Değiştir yoktur; düzenlenebilirde pencere açar", () => {
    renderCell(makeStore(), { groupId: null, savedName: null, canEdit: true });
    expect(screen.getByText("—")).toBeTruthy();
    cleanup();
    renderCell(makeStore("p1"), { groupId: "g1", savedName: null, canEdit: false });
    expect(screen.queryByRole("button", { name: /değiştir/ })).toBeNull();
    cleanup();
    renderCell(makeStore("p1"), { groupId: "g1", savedName: null, canEdit: true });
    fireEvent.click(screen.getByRole("button", { name: "Loca A süpervizörünü değiştir" }));
    expect(screen.getByRole("button", { name: "Mehmet Kaya süpervizör seç" })).toBeTruthy();
  });
});
