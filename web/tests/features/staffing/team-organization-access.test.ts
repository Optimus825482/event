import { describe, expect, it } from "vitest";
import { canOpenTeamOrganization } from "@/features/staffing/team-organization-access";
import { adminActor, managerActor, memberActor, noAccessActor } from "../../helpers/actors";

describe("canOpenTeamOrganization", () => {
  it("sayfa staff:view ve events:view ister", () => {
    expect(canOpenTeamOrganization(adminActor())).toBe(true);
    expect(canOpenTeamOrganization(managerActor("fnb"))).toBe(true);
  });

  it("yalnızca staff:view olan kullanıcı için bağlantı verilmez", () => {
    expect(canOpenTeamOrganization(memberActor("fnb", { staff: "v---" }))).toBe(false);
  });

  it("staff yetkisi olmayanlar için verilmez", () => {
    expect(canOpenTeamOrganization(managerActor("entertainment"))).toBe(false);
    expect(canOpenTeamOrganization(managerActor("casino"))).toBe(false);
    expect(canOpenTeamOrganization(noAccessActor())).toBe(false);
  });
});
