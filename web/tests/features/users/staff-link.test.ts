import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import type { Actor } from "@/features/auth/session";
import { listLinkableStaff } from "@/features/users/queries";
import { createUser, updateUser } from "@/features/users/service";
import { adminActor, managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createStaff, createUser as insertUser } from "../../helpers/factories";
import { PASSWORD } from "../auth/helpers";

const ACCESS = {
  role: "user" as const,
  memberships: [{ department: "fnb" as const, level: "member" as const }],
  permissions: [],
};

async function admin(): Promise<Actor> {
  return persistActor(db, adminActor());
}

async function staffIdOf(userId: string): Promise<string | null> {
  const [row] = await db.select({ staffId: users.staffId }).from(users).where(eq(users.id, userId));
  return row?.staffId ?? null;
}

describe("kullanıcı - personel kaydı bağı", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("oluştururken personel kaydına bağlar", async () => {
    const actor = await admin();
    const person = await createStaff(db);
    const created = await createUser(db, actor, { username: "ayse", password: PASSWORD, ...ACCESS, staffId: person.id });
    expect(created.staffId).toBe(person.id);
  });

  it("olmayan personel kaydı reddedilir ve kullanıcı oluşmaz", async () => {
    const actor = await admin();
    await expect(
      createUser(db, actor, {
        username: "ayse",
        password: PASSWORD,
        ...ACCESS,
        staffId: "00000000-0000-4000-8000-000000000000",
      }),
    ).rejects.toMatchObject({ code: "not_found", message: "Personel kaydı bulunamadı" });
    expect(await db.select().from(users).where(eq(users.username, "ayse"))).toHaveLength(0);
  });

  it("başka kullanıcıya bağlı personel kaydı conflict olur ve diğer kullanıcıyı adlandırır", async () => {
    const actor = await admin();
    const person = await createStaff(db);
    await insertUser(db, { username: "mehmet", name: "Mehmet Kaya", staffId: person.id });
    const err = await createUser(db, actor, {
      username: "ayse",
      password: PASSWORD,
      ...ACCESS,
      staffId: person.id,
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "conflict" });
    expect((err as Error).message).toContain("Mehmet Kaya");
    expect((err as Error).message).toContain("mehmet");
    expect(await db.select().from(users).where(eq(users.username, "ayse"))).toHaveLength(0);
  });

  it("güncellemede bağlar, başka personele yeniden bağlar ve null ile çözer", async () => {
    const actor = await admin();
    const target = await insertUser(db, { role: "admin" });
    const first = await createStaff(db);
    const second = await createStaff(db);

    await updateUser(db, actor, { id: target.id, staffId: first.id });
    expect(await staffIdOf(target.id)).toBe(first.id);

    await updateUser(db, actor, { id: target.id, staffId: second.id });
    expect(await staffIdOf(target.id)).toBe(second.id);
    // Eski personel kaydı serbest kaldı: başka kullanıcı bağlanabilir.
    const other = await insertUser(db, { role: "admin" });
    await updateUser(db, actor, { id: other.id, staffId: first.id });
    expect(await staffIdOf(other.id)).toBe(first.id);

    await updateUser(db, actor, { id: target.id, staffId: null });
    expect(await staffIdOf(target.id)).toBeNull();
  });

  it("staffId verilmezse mevcut bağ korunur; aynı personele yeniden kaydetmek çakışma sayılmaz", async () => {
    const actor = await admin();
    const person = await createStaff(db);
    const target = await insertUser(db, { role: "admin", staffId: person.id });
    await updateUser(db, actor, { id: target.id, name: "Yeni Ad" });
    expect(await staffIdOf(target.id)).toBe(person.id);
    await updateUser(db, actor, { id: target.id, staffId: person.id });
    expect(await staffIdOf(target.id)).toBe(person.id);
  });

  it("güncellemede olmayan ve başkasına bağlı personel reddedilir; bağ değişmez", async () => {
    const actor = await admin();
    const taken = await createStaff(db);
    await insertUser(db, { username: "mehmet", name: "Mehmet Kaya", staffId: taken.id });
    const own = await createStaff(db);
    const target = await insertUser(db, { role: "admin", staffId: own.id });

    await expect(
      updateUser(db, actor, { id: target.id, staffId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ code: "not_found" });
    const err = await updateUser(db, actor, { id: target.id, staffId: taken.id }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "conflict" });
    expect((err as Error).message).toContain("Mehmet Kaya");
    expect(await staffIdOf(target.id)).toBe(own.id);
  });

  it("ayrılmış personel kaydına yeni bağ kurulamaz; mevcut bağ korunur ve çözülebilir", async () => {
    const actor = await admin();
    const gone = await createStaff(db, { status: "terminated" });
    const target = await insertUser(db, { role: "admin" });
    await expect(updateUser(db, actor, { id: target.id, staffId: gone.id })).rejects.toMatchObject({
      code: "invalid",
      message: "Ayrılmış personel kaydına hesap bağlanamaz",
    });
    await expect(
      createUser(db, actor, { username: "ayse", password: PASSWORD, ...ACCESS, staffId: gone.id }),
    ).rejects.toMatchObject({ code: "invalid" });

    const linked = await insertUser(db, { role: "admin", staffId: gone.id });
    await updateUser(db, actor, { id: linked.id, staffId: gone.id, name: "Yeni Ad" });
    expect(await staffIdOf(linked.id)).toBe(gone.id);
    await updateUser(db, actor, { id: linked.id, staffId: null });
    expect(await staffIdOf(linked.id)).toBeNull();
  });

  it("ayrılmış ama hâlâ bağlı personel seçici listesinde kalır", async () => {
    const actor = await admin();
    const gone = await createStaff(db, { fullName: "Ayrılan Bağlı", status: "terminated" });
    await insertUser(db, { staffId: gone.id });
    const list = await listLinkableStaff(db, actor);
    expect(list.map((p) => p.id)).toContain(gone.id);
  });

  it("yetkisiz aktör bağı değiştiremez", async () => {
    const person = await createStaff(db);
    const target = await insertUser(db, { role: "admin" });
    const manager = await persistActor(db, managerActor("fnb"));
    await expect(updateUser(db, manager, { id: target.id, staffId: person.id })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      createUser(db, manager, { username: "ayse", password: PASSWORD, ...ACCESS, staffId: person.id }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await staffIdOf(target.id)).toBeNull();
  });

  it("seçici listesi kullanıcı yönetimi yetkisiyle gelir; bağlı olanı işaretler, ayrılmışı gizler", async () => {
    const actor = await admin();
    const free = await createStaff(db, { fullName: "Ali Boş" });
    const taken = await createStaff(db, { fullName: "Veli Bağlı" });
    await createStaff(db, { fullName: "Eski Çalışan", status: "terminated" });
    const owner = await insertUser(db, { username: "veli", staffId: taken.id });

    const list = await listLinkableStaff(db, actor);
    expect(list.map((p) => p.fullName)).toEqual(["Ali Boş", "Veli Bağlı"]);
    expect(list.find((p) => p.id === free.id)?.linkedUserId).toBeNull();
    expect(list.find((p) => p.id === taken.id)).toMatchObject({ linkedUserId: owner.id, linkedUserName: owner.name });

    const manager = await persistActor(db, managerActor("fnb"));
    await expect(listLinkableStaff(db, manager)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
