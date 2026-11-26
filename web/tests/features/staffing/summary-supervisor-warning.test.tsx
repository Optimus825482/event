// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrganizationStore, OrganizationStoreContext } from "@/features/staffing/components/store";
import { SummaryStep } from "@/features/staffing/components/summary-step";
import type { Organization } from "@/features/staffing/organization-service";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/staffing/actions", () => ({ saveOrganizationAction: vi.fn() }));
vi.mock("@/features/staffing/section-heads-actions", () => ({ setSectionHeadsAction: vi.fn() }));

function store(supervisorStaffId: string | null) {
  return createOrganizationStore({
    teams: [],
    groups: [
      { id: "g1", name: "Salon", color: "#3b82f6", teamId: null, supervisorStaffId, groupType: "standard", sortOrder: 0, notes: null, tableIds: [] },
    ],
    assignments: [],
    extraStaff: [],
    servicePointRoles: [],
    tables: [],
    staff: [{ id: "p1", fullName: "Ayşe Yılmaz", sicilNo: "S1", color: null }],
    shifts: [],
    servicePoints: [],
    reviewHints: {},
    supervisorNames: { gone: "Eski Çalışan" },
  } as unknown as Organization);
}

const renderSummary = (s: ReturnType<typeof store>) =>
  render(
    <OrganizationStoreContext.Provider value={s}>
      <SummaryStep eventId="e1" readOnly={false} sectionHeads={[]} />
    </OrganizationStoreContext.Provider>,
  );

describe("özet adımı: süpervizör", () => {
  afterEach(cleanup);

  it("pasif süpervizör gerçek adıyla uyarılır ve Pasif rozetiyle listelenir", () => {
    renderSummary(store("gone"));
    expect(screen.getByText('"Salon" grubunun süpervizörü pasif: Eski Çalışan')).toBeInTheDocument();
    expect(screen.getByText("Pasif")).toBeInTheDocument();
  });

  it("etkin süpervizörde uyarı yoktur", () => {
    renderSummary(store("p1"));
    expect(screen.queryByText(/süpervizörü pasif/)).toBeNull();
    expect(screen.getAllByText("Ayşe Yılmaz").length).toBeGreaterThan(0);
  });
});
