import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { departmentMemberships, userPermissions } from "@/db/schema";
import { can } from "@/features/auth/policy";
import {
  adminActor,
  assistantActor,
  managerActor,
  memberActor,
  noAccessActor,
  persistActor,
} from "./actors";

describe("test aktör yardımcıları", () => {
  it("yönetici silebilir, asistan silemez", () => {
    expect(can(managerActor("fnb"), "staff", "delete")).toBe(true);
    expect(can(assistantActor("fnb"), "staff", "delete")).toBe(false);
    expect(can(assistantActor("fnb"), "staff", "edit")).toBe(true);
  });

  it("yönetici kendi departmanı dışına erişemez", () => {
    expect(can(managerActor("fnb"), "events", "edit")).toBe(false);
    expect(can(managerActor("entertainment"), "events", "edit")).toBe(true);
  });

  it("admin her modüle erişir", () => {
    expect(can(adminActor(), "users", "delete")).toBe(true);
  });

  it("üyeliksiz kullanıcı hiçbir şeye erişemez", () => {
    const a = noAccessActor();
    expect(a.role).toBe("user");
    expect(a.memberships).toEqual([]);
    expect(can(a, "events", "view")).toBe(false);
  });

  it("kullanıcı düzeyi gösterimi tek satır ve doğru bayraklar üretir", () => {
    const a = memberActor("casino", { reservations: "vc--" });
    expect(a.permissions).toEqual([
      { module: "reservations", canView: true, canCreate: true, canEdit: false, canDelete: false },
    ]);
    expect(can(a, "reservations", "create")).toBe(true);
    expect(can(a, "reservations", "edit")).toBe(false);
  });

  it("persistActor üyeliği ve izin satırını yazar, gerçek id döner", async () => {
    const saved = await persistActor(db, memberActor("casino", { reservations: "vc--" }));
    const memberships = await db.select().from(departmentMemberships).where(eq(departmentMemberships.userId, saved.id));
    const perms = await db.select().from(userPermissions).where(eq(userPermissions.userId, saved.id));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ department: "casino", level: "member" });
    expect(perms).toHaveLength(1);
    expect(perms[0]).toMatchObject({ module: "reservations", canView: true, canCreate: true, canEdit: false });
  });
});
