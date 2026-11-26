import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventFinanceItems } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { createFinanceItem, deleteFinanceItem, updateFinanceItem } from "@/features/finance/items-service";
import { createFinanceItemSchema } from "@/features/finance/schemas";
import { DomainError } from "@/lib/action";
import { assistantActor, managerActor, memberActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { createFinanceItem as seedItem } from "../../helpers/finance";

async function expectDomain(promise: Promise<unknown>, code: DomainError["code"], message: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DomainError);
  expect(error).toMatchObject({ code, message });
}

const MISSING_ID = "00000000-0000-4000-8000-000000000000";

const base = {
  direction: "expense",
  category: "production",
  label: "Sahne",
  estimatedAmount: "1500.5",
  actualAmount: null,
  note: "",
};

function parseCreate(eventId: string, patch: Record<string, unknown> = {}) {
  return createFinanceItemSchema.parse({ ...base, eventId, ...patch });
}

beforeEach(async () => {
  await truncateAll();
});

describe("kalem ekleme", () => {
  it("kalem eklenir: tutar kanonik, sıra artar, oluşturan yazılır", async () => {
    const event = await f.createEvent(db);
    const ent = await persistActor(db, managerActor("entertainment"));
    const first = await createFinanceItem(db, ent, parseCreate(event.id));
    const second = await createFinanceItem(db, ent, parseCreate(event.id, { label: "Işık", estimatedAmount: "200" }));
    expect(first).toMatchObject({
      estimatedAmount: "1500.50",
      sortOrder: 1,
      createdBy: ent.id,
      actualAmount: null,
      note: null,
    });
    expect(second).toMatchObject({ estimatedAmount: "200.00", sortOrder: 2, createdBy: ent.id });
  });

  it("olmayan etkinlik → not_found", async () => {
    const ent = await persistActor(db, managerActor("entertainment"));
    await expectDomain(createFinanceItem(db, ent, parseCreate(MISSING_ID)), "not_found", "Etkinlik bulunamadı");
  });

  it.each([
    ["gider + sponsorluk", { direction: "expense", category: "sponsorship" }, "Bu kategori seçilen yön için geçerli değil"],
    ["gelir + sanatçı ücreti", { direction: "income", category: "artist_fee" }, "Bu kategori seçilen yön için geçerli değil"],
    ["boş ad", { label: "   " }, "Kalem adı gerekli"],
    ["uzun ad", { label: "a".repeat(121) }, "Kalem adı en fazla 120 karakter olabilir"],
    ["uzun not", { note: "a".repeat(501) }, "Not en fazla 500 karakter olabilir"],
    ["üç ondalık", { estimatedAmount: "10.005" }, "Tutar geçersiz"],
    ["negatif", { estimatedAmount: "-5" }, "Tutar geçersiz"],
    ["on basamak", { estimatedAmount: "1234567890" }, "Tutar geçersiz"],
  ])("şema reddi: %s", (_name, patch, message) => {
    const result = createFinanceItemSchema.safeParse({ ...base, eventId: MISSING_ID, ...patch });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toContain(message);
  });

  it("kategori uyumsuzluğu `category` alanına yazılır", () => {
    const result = createFinanceItemSchema.safeParse({
      ...base,
      eventId: MISSING_ID,
      direction: "income",
      category: "staff",
    });
    expect(result.error?.issues[0]?.path).toEqual(["category"]);
  });
});

describe("kalem güncelleme", () => {
  it("gerçekleşen tutar sonradan girilir, tahmini değişmez", async () => {
    const event = await f.createEvent(db);
    const ent = await persistActor(db, managerActor("entertainment"));
    const item = await seedItem(db, event.id, { estimatedAmount: "1500.00" });
    const updated = await updateFinanceItem(db, ent, {
      id: item.id,
      category: "production",
      label: item.label,
      estimatedAmount: "1500.00",
      actualAmount: "1800.00",
      note: null,
    });
    expect(updated).toMatchObject({ estimatedAmount: "1500.00", actualAmount: "1800.00" });
  });

  it("tamamlanmış etkinlikte de gerçekleşen girilebilir", async () => {
    const event = await f.createEvent(db, { status: "completed" });
    const ent = await persistActor(db, managerActor("entertainment"));
    const item = await seedItem(db, event.id);
    const updated = await updateFinanceItem(db, ent, {
      id: item.id,
      category: "production",
      label: item.label,
      estimatedAmount: "1000.00",
      actualAmount: "900.00",
      note: null,
    });
    expect(updated.actualAmount).toBe("900.00");
  });

  it("güncellemede kategori kayıtlı yönle uyumsuzsa invalid", async () => {
    const event = await f.createEvent(db);
    const ent = await persistActor(db, managerActor("entertainment"));
    const item = await seedItem(db, event.id, { direction: "income", category: "sponsorship" });
    await expectDomain(
      updateFinanceItem(db, ent, {
        id: item.id,
        category: "staff",
        label: item.label,
        estimatedAmount: "1000.00",
        actualAmount: null,
        note: null,
      }),
      "invalid",
      "Bu kategori seçilen yön için geçerli değil",
    );
  });

  it("olmayan kalem → not_found 'Kalem bulunamadı'", async () => {
    const ent = await persistActor(db, managerActor("entertainment"));
    await expectDomain(
      updateFinanceItem(db, ent, {
        id: MISSING_ID,
        category: "other",
        label: "x",
        estimatedAmount: "1.00",
        actualAmount: null,
        note: null,
      }),
      "not_found",
      "Kalem bulunamadı",
    );
    await expectDomain(deleteFinanceItem(db, ent, { id: MISSING_ID }), "not_found", "Kalem bulunamadı");
  });
});

describe("yetki", () => {
  it("Kullanıcı 'v---' ekleyemez; 'vc--' ekler ama düzenleyemez; Yönetici Asistanı silemez; Yönetici siler", async () => {
    const event = await f.createEvent(db);
    const viewer = await persistActor(db, memberActor("entertainment", { finance: "v---" }));
    await expect(createFinanceItem(db, viewer, parseCreate(event.id))).rejects.toBeInstanceOf(ForbiddenError);

    const creator = await persistActor(db, memberActor("entertainment", { finance: "vc--" }));
    const item = await createFinanceItem(db, creator, parseCreate(event.id));
    await expect(
      updateFinanceItem(db, creator, {
        id: item.id,
        category: "production",
        label: "Yeni",
        estimatedAmount: "1.00",
        actualAmount: null,
        note: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const assistant = await persistActor(db, assistantActor("entertainment"));
    await expect(deleteFinanceItem(db, assistant, { id: item.id })).rejects.toBeInstanceOf(ForbiddenError);

    const manager = await persistActor(db, managerActor("entertainment"));
    expect(await deleteFinanceItem(db, manager, { id: item.id })).toEqual({ id: item.id, eventId: event.id });
    expect(await db.select().from(eventFinanceItems).where(eq(eventFinanceItems.id, item.id))).toHaveLength(0);
  });

  it.each(["fnb", "casino"] as const)("%s yöneticisi kalem ekleyemez", async (department) => {
    const event = await f.createEvent(db);
    const actor = await persistActor(db, managerActor(department));
    await expect(createFinanceItem(db, actor, parseCreate(event.id))).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.select().from(eventFinanceItems)).toHaveLength(0);
  });
});
