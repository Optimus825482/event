import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { departments, eventStaffAssignments, staff } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ForbiddenError } from "@/features/auth/errors";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { setStaffStatusSchema, staffInputSchema } from "@/features/staff/schemas";
import {
  createStaff,
  deleteStaff,
  getStaffById,
  listActiveStaff,
  setStaffStatus,
  updateStaff,
} from "@/features/staff/service";
import { DomainError } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import { createAssignment, createEvent, createStaff as makeStaff } from "../../helpers/factories";

function actorOf(role: Role): Actor {
  return { id: "00000000-0000-4000-8000-000000000001", username: "t", role, staffId: null, memberships: [], permissions: [] };
}
const admin = actorOf("admin");

function st(v: Record<string, unknown>) {
  return setStaffStatus(db, admin, setStaffStatusSchema.parse(v));
}

function input(over: Record<string, unknown> = {}) {
  return staffInputSchema.parse({ sicilNo: "S-100", fullName: "Ayşe Yılmaz", ...over });
}

async function expectDomain(promise: Promise<unknown>, code: "conflict" | "not_found") {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
}

describe("personel servisi", () => {
  beforeEach(truncateAll);

  it("personel oluşturur, boş alanları null yapar ve renk atar", async () => {
    const { id } = await createStaff(db, admin, input({ email: "", phone: " 0532 " }));
    const row = await getStaffById(db, admin, id);
    expect(row.sicilNo).toBe("S-100");
    expect(row.email).toBeNull();
    expect(row.phone).toBe("0532");
    expect(row.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(row.status).toBe("active");
  });

  it("yinelenen sicil numarası conflict döner", async () => {
    await createStaff(db, admin, input());
    await expectDomain(createStaff(db, admin, input({ fullName: "Başka" })), "conflict");
  });

  it("güncellemede başka personelin sicili conflict, kendi sicili serbest", async () => {
    const a = await createStaff(db, admin, input({ sicilNo: "A" }));
    const b = await createStaff(db, admin, input({ sicilNo: "B" }));
    await expectDomain(updateStaff(db, admin, { id: b.id, ...input({ sicilNo: "A" }) }), "conflict");
    await updateStaff(db, admin, { id: a.id, ...input({ sicilNo: "A", fullName: "Yeni Ad" }) });
    expect((await getStaffById(db, admin, a.id)).fullName).toBe("Yeni Ad");
  });

  it("olmayan personel not_found döner", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    await expectDomain(getStaffById(db, admin, id), "not_found");
    await expectDomain(updateStaff(db, admin, { id, ...input() }), "not_found");
    await expectDomain(st({ id, status: "inactive" }), "not_found");
    await expectDomain(deleteStaff(db, admin, { id }), "not_found");
  });

  it("olmayan bölüm kimliği conflict döner", async () => {
    await expectDomain(
      createStaff(db, admin, input({ departmentId: "11111111-1111-4111-8111-111111111111" })),
      "conflict",
    );
  });

  it("ataması olan personel silinemez ve satır korunur", async () => {
    const event = await createEvent(db);
    const person = await makeStaff(db);
    await createAssignment(db, { eventId: event.id, staffId: person.id });

    await expectDomain(deleteStaff(db, admin, { id: person.id }), "conflict");
    const rows = await db.select().from(staff).where(eq(staff.id, person.id));
    expect(rows).toHaveLength(1);
    const assignments = await db.select().from(eventStaffAssignments);
    expect(assignments).toHaveLength(1);
  });

  it("ataması olmayan personel silinir", async () => {
    const person = await makeStaff(db);
    await deleteStaff(db, admin, { id: person.id });
    expect(await db.select().from(staff)).toHaveLength(0);
  });

  it("ataması olan personel pasifleştirilebilir", async () => {
    const event = await createEvent(db);
    const person = await makeStaff(db);
    await createAssignment(db, { eventId: event.id, staffId: person.id });
    await st({ id: person.id, status: "inactive" });
    expect((await getStaffById(db, admin, person.id)).status).toBe("inactive");
  });

  it("ayrılma durumu neden ve tarih kaydeder", async () => {
    const person = await makeStaff(db);
    await st({
      id: person.id,
      status: "terminated",
      terminationDate: "2026-05-01",
      terminationReason: "İstifa",
    });
    const row = await getStaffById(db, admin, person.id);
    expect(row.terminationReason).toBe("İstifa");
    expect(row.terminationDate).toBe("2026-05-01");
  });

  it("yeniden etkinleştirme ayrılma bilgisini temizler", async () => {
    const person = await makeStaff(db);
    await st({ id: person.id, status: "terminated", terminationReason: "x" });
    await st({ id: person.id, status: "active" });
    const row = await getStaffById(db, admin, person.id);
    expect(row.terminationReason).toBeNull();
    expect(row.terminationDate).toBeNull();
  });

  it("yetkisiz rol servis düzeyinde de reddedilir", async () => {
    await expect(createStaff(db, actorOf("controller"), input())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createStaff(db, actorOf("staff"), input())).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("listActiveStaff", () => {
  beforeEach(truncateAll);

  it("pasif ve ayrılmış personel listede yok", async () => {
    const active = await makeStaff(db, { fullName: "Aktif" });
    await makeStaff(db, { fullName: "Pasif", status: "inactive" });
    await makeStaff(db, { fullName: "Ayrıldı", status: "terminated" });
    const rows = await listActiveStaff(db, {});
    expect(rows.map((r) => r.id)).toEqual([active.id]);
  });

  it("pasifleştirilen personel listeden düşer", async () => {
    const person = await makeStaff(db);
    expect(await listActiveStaff(db, {})).toHaveLength(1);
    await st({ id: person.id, status: "inactive" });
    expect(await listActiveStaff(db, {})).toHaveLength(0);
  });

  it("bölüme ve aramaya göre süzer, ada göre sıralar", async () => {
    const [dep] = await db.insert(departments).values({ name: "Servis" }).returning();
    if (!dep) throw new Error("bölüm eklenemedi");
    await makeStaff(db, { fullName: "Zeynep", departmentId: dep.id });
    await makeStaff(db, { fullName: "Ali", departmentId: dep.id, sicilNo: "ZZ-9" });
    await makeStaff(db, { fullName: "Mehmet" });

    const inDep = await listActiveStaff(db, { departmentId: dep.id });
    expect(inDep.map((r) => r.fullName)).toEqual(["Ali", "Zeynep"]);
    expect((await listActiveStaff(db, { search: "zz-9" })).map((r) => r.fullName)).toEqual(["Ali"]);
    expect(await listActiveStaff(db, { search: "%" })).toHaveLength(0);
  });
});
