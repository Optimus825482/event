import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventSectionHeads } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import type { Actor } from "@/features/auth/session";
import { sectionHeadActionDefs } from "@/features/staffing/section-heads-action-defs";
import { listSectionHeads, setSectionHeads } from "@/features/staffing/section-heads-service";
import { createAction, DomainError } from "@/lib/action";
import { assistantActor, managerActor, memberActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { createSectionHead } from "../../helpers/fnb";
import { initialSectionHeadSelection, sectionHeadRows } from "@/features/staffing/components/section-heads-card";
import { expectDomain, makeActor } from "./helpers";

function setFor(actor: Actor) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return defineAction(sectionHeadActionDefs.set);
}

async function staffIdsOf(eventId: string): Promise<string[]> {
  const rows = await db
    .select({ staffId: eventSectionHeads.staffId })
    .from(eventSectionHeads)
    .where(eq(eventSectionHeads.eventId, eventId));
  return rows.map((r) => r.staffId).sort();
}

async function domainErrorOf(promise: Promise<unknown>): Promise<DomainError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  return err as DomainError;
}

describe("etkinlik kısım sorumluları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("F&B yöneticisi iki kısım sorumlusu atar; liste ada göre sıralı döner", async () => {
    const actor = await makeActor(managerActor("fnb"));
    const event = await f.createEvent(db, { organizerId: actor.id });
    const zeynep = await f.createStaff(db, { fullName: "Zeynep Yılmaz" });
    const ali = await f.createStaff(db, { fullName: "Ali Demir" });

    const heads = await setSectionHeads(db, actor, { eventId: event.id, staffIds: [zeynep.id, ali.id] });

    expect(heads.map((h) => h.fullName)).toEqual(["Ali Demir", "Zeynep Yılmaz"]);
    expect(heads[0]).toMatchObject({ staffId: ali.id, sicilNo: ali.sicilNo });
    expect(await listSectionHeads(db, actor, event.id)).toEqual(heads);
  });

  it("küme değiştirilir: eski kayıt kalkar, yeni kayıt eklenir", async () => {
    const actor = await makeActor(managerActor("fnb"));
    const event = await f.createEvent(db, { organizerId: actor.id });
    const a = await f.createStaff(db, { fullName: "A Personel" });
    const b = await f.createStaff(db, { fullName: "B Personel" });
    const c = await f.createStaff(db, { fullName: "C Personel" });

    await setSectionHeads(db, actor, { eventId: event.id, staffIds: [a.id, b.id] });
    await setSectionHeads(db, actor, { eventId: event.id, staffIds: [b.id, c.id] });
    const again = await setSectionHeads(db, actor, { eventId: event.id, staffIds: [b.id, c.id] });

    expect(again.map((h) => h.staffId).sort()).toEqual([b.id, c.id].sort());
    expect(await staffIdsOf(event.id)).toEqual([b.id, c.id].sort());
  });

  it("boş liste tüm atamaları kaldırır", async () => {
    const actor = await makeActor(managerActor("fnb"));
    const event = await f.createEvent(db, { organizerId: actor.id });
    const a = await f.createStaff(db);
    await createSectionHead(db, { eventId: event.id, staffId: a.id });

    expect(await setSectionHeads(db, actor, { eventId: event.id, staffIds: [] })).toEqual([]);
    expect(await staffIdsOf(event.id)).toEqual([]);
  });

  it("aynı personel iki kez → invalid 'Aynı personel iki kez seçilemez'", async () => {
    const actor = await makeActor(managerActor("fnb"));
    const event = await f.createEvent(db, { organizerId: actor.id });
    const a = await f.createStaff(db);

    const res = await setFor(actor)({ eventId: event.id, staffIds: [a.id, a.id] });
    expect(res).toMatchObject({
      ok: false,
      code: "invalid",
      fieldErrors: { staffIds: ["Aynı personel iki kez seçilemez"] },
    });

    const err = await domainErrorOf(setSectionHeads(db, actor, { eventId: event.id, staffIds: [a.id, a.id] }));
    expect(err.code).toBe("invalid");
    expect(err.message).toBe("Aynı personel iki kez seçilemez");
  });

  it("pasif personel → invalid 'Personel bulunamadı ya da aktif değil'", async () => {
    const actor = await makeActor(managerActor("fnb"));
    const event = await f.createEvent(db, { organizerId: actor.id });
    const a = await f.createStaff(db);
    const pasif = await f.createStaff(db, { status: "inactive" });

    const err = await domainErrorOf(setSectionHeads(db, actor, { eventId: event.id, staffIds: [a.id, pasif.id] }));
    expect(err.code).toBe("invalid");
    expect(err.message).toBe("Personel bulunamadı ya da aktif değil");
    // Tek işlem: geçersiz bir kimlik varsa hiçbir atama yazılmaz.
    expect(await staffIdsOf(event.id)).toEqual([]);
  });

  it("Entertainment yöneticisi atayamaz", async () => {
    const actor = await makeActor(managerActor("entertainment"));
    const event = await f.createEvent(db);
    const a = await f.createStaff(db);

    await expect(setSectionHeads(db, actor, { eventId: event.id, staffIds: [a.id] })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await setFor(actor)({ eventId: event.id, staffIds: [a.id] })).toMatchObject({ ok: false, code: "forbidden" });
    // Reddedilen yazma hiçbir satır bırakmaz.
    expect(await staffIdsOf(event.id)).toEqual([]);
  });

  it("başarısız değiştirme (pasif personel) boş olmayan mevcut kümeyi değiştirmez", async () => {
    const actor = await makeActor(managerActor("fnb"));
    const event = await f.createEvent(db, { organizerId: actor.id });
    const mevcut = await f.createStaff(db);
    const yeni = await f.createStaff(db);
    const pasif = await f.createStaff(db, { status: "inactive" });
    await setSectionHeads(db, actor, { eventId: event.id, staffIds: [mevcut.id] });

    const err = await domainErrorOf(setSectionHeads(db, actor, { eventId: event.id, staffIds: [yeni.id, pasif.id] }));
    expect(err.code).toBe("invalid");
    expect(await staffIdsOf(event.id)).toEqual([mevcut.id]);
  });

  it("bilinmeyen etkinlikte liste not_found döner (boş liste değil)", async () => {
    const actor = await makeActor(managerActor("fnb"));
    await expectDomain(listSectionHeads(db, actor, crypto.randomUUID()), "not_found");
  });

  it("F&B asistanı atar ve kaldırır (kaldırma bir düzenlemedir)", async () => {
    const actor = await makeActor(assistantActor("fnb"));
    const event = await f.createEvent(db);
    const a = await f.createStaff(db);

    const added = await setSectionHeads(db, actor, { eventId: event.id, staffIds: [a.id] });
    expect(added.map((h) => h.staffId)).toEqual([a.id]);
    expect(await setSectionHeads(db, actor, { eventId: event.id, staffIds: [] })).toEqual([]);
  });

  it("personel görüntüleme yetkisi olmayan kullanıcı listeyi okuyamaz", async () => {
    const actor = await makeActor(memberActor("fnb", { staff: "----" }));
    const event = await f.createEvent(db);
    await expect(listSectionHeads(db, actor, event.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("tamamlanmış etkinlikte atama yapılamaz", async () => {
    const actor = await makeActor(managerActor("fnb"));
    const event = await f.createEvent(db, { organizerId: actor.id, status: "completed" });
    const a = await f.createStaff(db);

    await expectDomain(setSectionHeads(db, actor, { eventId: event.id, staffIds: [a.id] }), "conflict");
    expect(await staffIdsOf(event.id)).toEqual([]);
  });
});

describe("kısım sorumlusu satırları (saf)", () => {
  const ali = { staffId: "11111111-1111-4111-8111-111111111111", fullName: "Ali Demir", sicilNo: "S-1" };
  const zeynep = { staffId: "22222222-2222-4222-8222-222222222222", fullName: "Zeynep Yılmaz", sicilNo: "S-2" };

  it("aday olmayan (pasif) mevcut sorumlu satırda kalır ve seçili başlar", () => {
    const rows = sectionHeadRows([ali], [{ staffId: zeynep.staffId, fullName: zeynep.fullName }]);
    expect(rows).toEqual([
      { staffId: zeynep.staffId, fullName: zeynep.fullName, active: true },
      { staffId: ali.staffId, fullName: ali.fullName, active: false },
    ]);
    expect(initialSectionHeadSelection([ali])).toContain(ali.staffId);
  });

  it("sorumlu aynı zamanda aday ise tek satır üretilir (tekrar yok)", () => {
    const rows = sectionHeadRows([ali], [{ staffId: ali.staffId, fullName: ali.fullName }]);
    expect(rows).toEqual([{ staffId: ali.staffId, fullName: ali.fullName, active: true }]);
  });
});
