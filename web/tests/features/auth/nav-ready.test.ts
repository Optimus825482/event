import { describe, expect, it, vi } from "vitest";
import { visibleNavItems } from "@/features/auth/nav";
import type { PolicyActor } from "@/features/auth/policy";
import { managerActor } from "../../helpers/actors";

vi.mock("@/features/archive/ready", () => ({ ARCHIVE_READY: true }));
vi.mock("@/features/sales-site/ready", () => ({ SALES_SITE_READY: true }));

const hrefs = (actor: PolicyActor) => visibleNavItems(actor).map((item) => item.href);

describe("arşiv menüsü, hazır bayrağı açıkken", () => {
  it("bayrak açıkken Entertainment yöneticisi üç öğeyi görür, F&B yöneticisi görmez", () => {
    expect(hrefs(managerActor("entertainment"))).toEqual(expect.arrayContaining(["/archive", "/artists", "/reports"]));
    expect(hrefs(managerActor("fnb"))).not.toContain("/archive");
  });
});

describe("satış sitesi menüsü, hazır bayrağı açıkken", () => {
  it("bayrak açıkken Entertainment yöneticisi /sales-site'ı görür, F&B yöneticisi görmez", () => {
    expect(hrefs(managerActor("entertainment"))).toContain("/sales-site");
    expect(hrefs(managerActor("fnb"))).not.toContain("/sales-site");
  });
});
