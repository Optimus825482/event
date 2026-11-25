import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { departments, positions, staffRoles, workLocations, workShifts } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import {
  createDepartment,
  createPosition,
  createWorkLocation,
  deleteDepartment,
  deletePosition,
  deleteWorkLocation,
  updateDepartment,
} from "@/features/staff/catalog-service";
import {
  createShift,
  createStaffRole,
  deleteShift,
  deleteStaffRole,
  updateShift,
} from "@/features/staff/role-shift-service";
import { shiftInputSchema, staffRoleInputSchema } from "@/features/staff/schemas";
import { DomainError } from "@/lib/action";
import { adminActor, managerActor, memberActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createAssignment, createEvent, createShift as makeShift, createStaff } from "../../helpers/factories";

const admin = adminActor({ id: "00000000-0000-4000-8000-000000000001" });

async function expectDomain(promise: Promise<unknown>, code: "conflict" | "not_found") {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
}

const base = { description: null, sortOrder: 0, isActive: true };

describe("bölüm / unvan / görev yeri", () => {
  beforeEach(truncateAll);

  it("bölüm oluşturur; aynı ad conflict", async () => {
    await createDepartment(db, admin, { ...base, name: "Servis", color: "#ff0000" });
    await expectDomain(createDepartment(db, admin, { ...base, name: "Servis", color: null }), "conflict");
    expect(await db.select().from(departments)).toHaveLength(1);
  });

  it("güncellemede başka bölümün adı conflict; olmayan kayıt not_found", async () => {
    await createDepartment(db, admin, { ...base, name: "A", color: null });
    const b = await createDepartment(db, admin, { ...base, name: "B", color: null });
    await expectDomain(updateDepartment(db, admin, { id: b.id, ...base, name: "A", color: null }), "conflict");
    await expectDomain(
      updateDepartment(db, admin, {
        id: "11111111-1111-4111-8111-111111111111",
        ...base,
        name: "C",
        color: null,
      }),
      "not_found",
    );
  });

  it("personele bağlı bölüm / unvan / görev yeri silinemez, boşta olan silinir", async () => {
    const dep = await createDepartment(db, admin, { ...base, name: "D", color: null });
    const pos = await createPosition(db, admin, { ...base, name: "P" });
    const loc = await createWorkLocation(db, admin, { ...base, name: "L", address: null });
    await createStaff(db, { departmentId: dep.id, positionId: pos.id, workLocationId: loc.id });

    await expectDomain(deleteDepartment(db, admin, { id: dep.id }), "conflict");
    await expectDomain(deletePosition(db, admin, { id: pos.id }), "conflict");
    await expectDomain(deleteWorkLocation(db, admin, { id: loc.id }), "conflict");

    const free = await createDepartment(db, admin, { ...base, name: "Boş", color: null });
    await deleteDepartment(db, admin, { id: free.id });
    expect(await db.select().from(departments)).toHaveLength(1);
    expect(await db.select().from(positions)).toHaveLength(1);
    expect(await db.select().from(workLocations)).toHaveLength(1);
    await expectDomain(deleteDepartment(db, admin, { id: free.id }), "not_found");
  });

  it("F&B yöneticisi düzenleyebilir, Casino kullanıcıları düzenleyemez", async () => {
    await createDepartment(db, managerActor("fnb"), { ...base, name: "X", color: null });
    await expect(createDepartment(db, memberActor("casino", { reservations: "vce-", customers: "v---", check_in: "vc--" }), { ...base, name: "Y", color: null })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(createPosition(db, memberActor("casino", { check_in: "vc--" }), { ...base, name: "Y" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("personel rolleri", () => {
  beforeEach(truncateAll);

  const roleInput = (key: string) => staffRoleInputSchema.parse({ key, label: "Kaptan" });

  it("anahtar tekildir ve varsayılan renkler uygulanır", async () => {
    await createStaffRole(db, admin, roleInput("captain"));
    await expectDomain(createStaffRole(db, admin, roleInput("captain")), "conflict");
    const [row] = await db.select().from(staffRoles);
    expect(row?.color).toBe("#3b82f6");
  });

  it("atamada kullanılan rol silinemez", async () => {
    const role = await createStaffRole(db, admin, roleInput("captain"));
    const event = await createEvent(db);
    const person = await createStaff(db);
    await createAssignment(db, { eventId: event.id, staffId: person.id, role: "captain" });
    await expectDomain(deleteStaffRole(db, admin, { id: role.id }), "conflict");

    const free = await createStaffRole(db, admin, roleInput("waiter"));
    await deleteStaffRole(db, admin, { id: free.id });
    expect(await db.select().from(staffRoles)).toHaveLength(1);
  });
});

describe("vardiya şablonları", () => {
  beforeEach(truncateAll);

  const shift = (name: string, over: Record<string, unknown> = {}) =>
    shiftInputSchema.parse({ name, startTime: "18:00", endTime: "02:00", ...over });

  it("genel vardiya adı tekildir (event_id NULL için de)", async () => {
    await createShift(db, admin, shift("Akşam"));
    await expectDomain(createShift(db, admin, shift("Akşam")), "conflict");
    expect(await db.select().from(workShifts)).toHaveLength(1);
  });

  it("gece vardiyasına izin verilir; geçersiz saat şemada reddedilir", () => {
    expect(shift("Gece", { startTime: "22:00", endTime: "06:00" }).endTime).toBe("06:00");
    expect(shiftInputSchema.safeParse({ name: "x", startTime: "25:00", endTime: "02:00" }).success).toBe(false);
    expect(shiftInputSchema.safeParse({ name: "x", startTime: "18:00", endTime: "18:00" }).success).toBe(false);
  });

  it("güncelleme ve olmayan kayıt", async () => {
    const created = await createShift(db, admin, shift("A"));
    await createShift(db, admin, shift("B"));
    await expectDomain(updateShift(db, admin, { id: created.id, ...shift("B") }), "conflict");
    await updateShift(db, admin, { id: created.id, ...shift("A2") });
    await expectDomain(
      updateShift(db, admin, { id: "11111111-1111-4111-8111-111111111111", ...shift("Z") }),
      "not_found",
    );
  });

  it("atamada kullanılan vardiya silinemez; etkinliğe özel vardiyaya dokunulmaz", async () => {
    const used = await makeShift(db, { name: "Kullanılan" });
    const event = await createEvent(db);
    const person = await createStaff(db);
    await createAssignment(db, { eventId: event.id, staffId: person.id, shiftId: used.id });
    await expectDomain(deleteShift(db, admin, { id: used.id }), "conflict");

    const scoped = await makeShift(db, { name: "Özel", eventId: event.id });
    await expectDomain(deleteShift(db, admin, { id: scoped.id }), "not_found");

    const free = await makeShift(db, { name: "Boş" });
    await deleteShift(db, admin, { id: free.id });
  });
});
