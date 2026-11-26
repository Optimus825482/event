import { describe, expect, it, vi } from "vitest";
import { visibleNavItems } from "@/features/auth/nav";
import type { PolicyActor } from "@/features/auth/policy";
import { managerActor } from "../../helpers/actors";

vi.mock("@/features/archive/ready", () => ({ ARCHIVE_READY: true }));

const hrefs = (actor: PolicyActor) => visibleNavItems(actor).map((item) => item.href);

describe("arşiv menüsü, hazır bayrağı açıkken", () => {
  it("bayrak açıkken Entertainment yöneticisi üç öğeyi görür, F&B yöneticisi görmez", () => {
    expect(hrefs(managerActor("entertainment"))).toEqual(expect.arrayContaining(["/archive", "/artists", "/reports"]));
    expect(hrefs(managerActor("fnb"))).not.toContain("/archive");
  });
});
