// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaStep } from "@/features/staffing/components/loca-step";
import { SectionHeadsCard } from "@/features/staffing/components/section-heads-card";
import { createOrganizationStore, OrganizationStoreContext } from "@/features/staffing/components/store";
import { DRAFT_DIRTY_NOTE } from "@/features/staffing/draft-guard";
import type { Organization } from "@/features/staffing/organization-service";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/staffing/actions", () => ({ groupUngroupedLocasAction: vi.fn() }));
vi.mock("@/features/staffing/section-heads-actions", () => ({ setSectionHeadsAction: vi.fn() }));

const EVENT = "11111111-1111-4111-8111-111111111111";

function org(): Organization {
  return {
    event: { id: EVENT, name: "E", status: "draft", startsAt: new Date() },
    editable: true,
    tables: [],
    teams: [],
    groups: [],
    assignments: [],
    extraStaff: [],
    servicePoints: [],
    servicePointRoles: [],
    shifts: [],
    staff: [],
    reviewHints: {},
    supervisorNames: {},
    locaStaffing: [],
    sectionHeads: [],
  };
}

const locaRow = {
  tableId: "t1", label: "L1", floor: 2, groupId: null, groupName: null, supervisorStaffId: null, supervisorName: null, staff: [],
};

function renderIn(ui: React.ReactElement, dirty: boolean) {
  const store = createOrganizationStore(org());
  store.setState({ dirty });
  return render(<OrganizationStoreContext.Provider value={store}>{ui}</OrganizationStoreContext.Provider>);
}

afterEach(cleanup);

describe("taslak kirliyken doğrudan sunucuya yazan düğmeler", () => {
  it("LocaStep: kirli taslakta düğme kapalı, not görünür ve düğmeye bağlı", () => {
    renderIn(<LocaStep rows={[locaRow]} eventId={EVENT} canEdit />, true);
    const button = screen.getByRole("button", { name: "Grupsuz locaları gruplandır" });
    const note = screen.getByText(DRAFT_DIRTY_NOTE);
    expect(button).toBeDisabled();
    expect(button.getAttribute("aria-describedby")).toBe(note.id);
  });

  it("LocaStep: temiz taslakta düğme açık, not yok", () => {
    renderIn(<LocaStep rows={[locaRow]} eventId={EVENT} canEdit />, false);
    const button = screen.getByRole("button", { name: "Grupsuz locaları gruplandır" });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText(DRAFT_DIRTY_NOTE)).toBeNull();
  });

  const candidates = [{ staffId: "s1", fullName: "Ali" }];

  it("SectionHeadsCard: kirli taslakta düğme kapalı (seçim değişse bile), not bağlı", async () => {
    renderIn(<SectionHeadsCard eventId={EVENT} heads={[]} candidates={candidates} canEdit />, true);
    screen.getByLabelText("Ali").click();
    // Seçim gerçekten değişti: düğmeyi kapalı tutan yalnızca taslak koruması olmalı.
    await waitFor(() => expect(screen.getByLabelText("Ali")).toBeChecked());
    const button = screen.getByRole("button", { name: "Kaydet" });
    expect(button).toBeDisabled();
    expect(button.getAttribute("aria-describedby")).toBe(screen.getByText(DRAFT_DIRTY_NOTE).id);
  });

  it("SectionHeadsCard: temiz taslakta seçim değişince düğme açık, not yok", async () => {
    renderIn(<SectionHeadsCard eventId={EVENT} heads={[]} candidates={candidates} canEdit />, false);
    screen.getByLabelText("Ali").click();
    expect(await screen.findByRole("button", { name: "Kaydet" })).toBeEnabled();
    expect(screen.queryByText(DRAFT_DIRTY_NOTE)).toBeNull();
  });
});
