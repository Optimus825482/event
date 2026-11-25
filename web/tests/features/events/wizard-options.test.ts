import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/features/auth/session";
import { adminActor, managerActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";

let current: Actor;
vi.mock("@/features/auth/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth/permissions")>()),
  requirePolicyActor: async () => current,
}));

const { loadWizardOptions } = await import("@/features/events/queries");

describe("yeni etkinlik sihirbazı seçenekleri", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("Entertainment yöneticisi (staff yetkisi yok) hata almaz; ekip şablonu listesi boş, uygulama kapalı", async () => {
    current = managerActor("entertainment");
    const options = await loadWizardOptions();
    expect(options.teamTemplates).toEqual([]);
    expect(options.canApplyTeam).toBe(false);
    expect(options.canApplyVenue).toBe(false);
  });

  it("ekip organizasyonu bağlantısı yalnızca staff ve events görüntüleme izni olanlara açıktır", async () => {
    current = managerActor("entertainment");
    expect((await loadWizardOptions()).canOrganizeTeam).toBe(false);
    current = adminActor();
    expect((await loadWizardOptions()).canOrganizeTeam).toBe(true);
  });
});
