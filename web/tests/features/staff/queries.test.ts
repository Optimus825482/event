import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { ForbiddenError } from "@/features/auth/errors";
import type { PolicyActor } from "@/features/auth/policy";
import {
  getOrganizationCatalogs,
  getStaffDetail,
  getStaffFormOptions,
  listStaff,
} from "@/features/staff/queries";
import { truncateAll } from "../../helpers/db";
import { createAssignment, createEvent, createStaff } from "../../helpers/factories";

const admin: PolicyActor = { id: "u1", role: "admin", staffId: null };
const controller: PolicyActor = { id: "u2", role: "controller", staffId: null };

describe("personel sorguları", () => {
  beforeEach(truncateAll);

  it("yetkisiz rol hiçbir sorguyu çalıştıramaz", async () => {
    await expect(listStaff(db, controller, {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getStaffDetail(db, controller, "11111111-1111-4111-8111-111111111111")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(getOrganizationCatalogs(db, controller)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getStaffFormOptions(db, controller)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("listStaff durum süzgeci uygular; varsayılan tümünü listeler", async () => {
    await createStaff(db, { fullName: "A" });
    await createStaff(db, { fullName: "B", status: "inactive" });
    expect(await listStaff(db, admin, {})).toHaveLength(2);
    const inactive = await listStaff(db, admin, { status: "inactive" });
    expect(inactive.map((r) => r.fullName)).toEqual(["B"]);
  });

  it("getStaffDetail atama sayısını döner, olmayan kayıt için null", async () => {
    const person = await createStaff(db);
    const event = await createEvent(db);
    await createAssignment(db, { eventId: event.id, staffId: person.id });
    const detail = await getStaffDetail(db, admin, person.id);
    expect(detail?.assignmentCount).toBe(1);
    expect(await getStaffDetail(db, admin, "11111111-1111-4111-8111-111111111111")).toBeNull();
  });
});
