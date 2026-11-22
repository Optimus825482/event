import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { customers } from "@/db/schema";
import { DomainError } from "@/lib/action";
import { findOrCreateCustomer } from "@/features/customers/find-or-create";
import { truncateAll } from "../../helpers/db";
import { createCustomer } from "../../helpers/factories";

async function count(): Promise<number> {
  return (await db.select({ id: customers.id }).from(customers)).length;
}

describe("findOrCreateCustomer", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("aynı telefonla 10 eşzamanlı çağrı (ayrı bağlantı ve transaction) tek satır üretir", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        db.transaction((tx) => findOrCreateCustomer(tx, { phone: "0532 111 22 33", fullName: `Ziyaretçi ${i}` })),
      ),
    );

    expect(await count()).toBe(1);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
  });

  it("aynı telefonla 10 eşzamanlı çağrı (doğrudan havuz) tek satır üretir", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => findOrCreateCustomer(db, { phone: "5321112233", fullName: "Aynı Kişi" })),
    );

    expect(await count()).toBe(1);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
  });

  it("aynı e-postayla 10 eşzamanlı çağrı tek satır üretir", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        db.transaction((tx) =>
          findOrCreateCustomer(tx, { email: i % 2 ? "A@Test.com" : "a@test.com ", fullName: "Eposta Kişi" }),
        ),
      ),
    );

    expect(await count()).toBe(1);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
  });

  it("0532 111 22 33, +905321112233 ve 5321112233 aynı müşteridir", async () => {
    const a = await findOrCreateCustomer(db, { phone: "0532 111 22 33", fullName: "Ayşe" });
    const b = await findOrCreateCustomer(db, { phone: "+905321112233", fullName: "Ayşe K." });
    const c = await findOrCreateCustomer(db, { phone: "5321112233" });

    expect(b.id).toBe(a.id);
    expect(c.id).toBe(a.id);
    expect(await count()).toBe(1);
    const [row] = await db.select().from(customers).where(eq(customers.id, a.id));
    expect(row?.phoneNormalized).toBe("+905321112233");
  });

  it("adaş ama farklı telefonlu iki müşteri birleşmez", async () => {
    const a = await findOrCreateCustomer(db, { phone: "05321112233", fullName: "Ali Yılmaz" });
    const b = await findOrCreateCustomer(db, { phone: "05449998877", fullName: "Ali Yılmaz" });

    expect(a.id).not.toBe(b.id);
    expect(await count()).toBe(2);
  });

  it("sıra: id telefondan önce gelir", async () => {
    const byId = await createCustomer(db, { fullName: "Id Sahibi" });
    const byPhone = await createCustomer(db, { fullName: "Telefon Sahibi", phone: "0532 111 22 33", phoneNormalized: "+905321112233" });

    const found = await findOrCreateCustomer(db, { customerId: byId.id, phone: "05321112233" });

    expect(found.id).toBe(byId.id);
    expect(found.id).not.toBe(byPhone.id);
  });

  it("sıra: telefon e-postadan önce gelir; telefon eşleşmezse e-posta kullanılır", async () => {
    const p = await createCustomer(db, { phoneNormalized: "+905321112233" });
    const e = await createCustomer(db, { emailNormalized: "x@test.com" });

    expect((await findOrCreateCustomer(db, { phone: "5321112233", email: "x@test.com" })).id).toBe(p.id);
    expect((await findOrCreateCustomer(db, { phone: "5559998877", email: "X@test.com" })).id).toBe(e.id);
    expect(await count()).toBe(2);
  });

  it("kara listedeki müşteri isBlacklisted: true döner", async () => {
    await createCustomer(db, { phoneNormalized: "+905321112233", isBlacklisted: true });

    const found = await findOrCreateCustomer(db, { phone: "05321112233" });

    expect(found.isBlacklisted).toBe(true);
    const fresh = await findOrCreateCustomer(db, { phone: "05449998877", fullName: "Yeni" });
    expect(fresh.isBlacklisted).toBe(false);
  });

  it("yeni müşteri hem ham hem normalize telefon/e-posta ile kaydedilir", async () => {
    const { id } = await findOrCreateCustomer(db, { phone: "0532 111 22 33", email: " Ayse@Test.com", fullName: "Ayşe" });

    const [row] = await db.select().from(customers).where(eq(customers.id, id));
    expect(row).toMatchObject({
      fullName: "Ayşe",
      phone: "0532 111 22 33",
      phoneNormalized: "+905321112233",
      email: "Ayse@Test.com",
      emailNormalized: "ayse@test.com",
    });
  });

  it("kişi bulunamaz ve ad yoksa not_found DomainError fırlatır", async () => {
    await expect(findOrCreateCustomer(db, { phone: "05321112233" })).rejects.toMatchObject({
      name: "DomainError",
      code: "not_found",
    });
    await expect(findOrCreateCustomer(db, {})).rejects.toBeInstanceOf(DomainError);
    expect(await count()).toBe(0);
  });

  it("olmayan customerId not_found fırlatır (yeni kayıt açmaz)", async () => {
    await expect(
      findOrCreateCustomer(db, { customerId: "00000000-0000-4000-8000-000000000000", fullName: "X" }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await count()).toBe(0);
  });

  it("yalnızca ad varsa (telefon/e-posta yok) her çağrı yeni müşteri açar", async () => {
    const a = await findOrCreateCustomer(db, { fullName: "Anonim" });
    const b = await findOrCreateCustomer(db, { fullName: "Anonim" });

    expect(a.id).not.toBe(b.id);
  });
});
