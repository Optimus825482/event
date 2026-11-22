import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { createTableTypeSchema } from "@/features/venue/schemas";
import {
  createTableType,
  deleteTableType,
  listTableTypes,
  updateTableType,
} from "@/features/venue/table-types-service";
import { DomainError } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

const base = {
  name: "Standart",
  color: "#3b82f6",
  shape: "round" as const,
  capacity: 8,
  basePrice: 1500,
  minSpacing: 50,
  isActive: true,
};

describe("masa tipleri", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("oluşturur, günceller, kullanım sayısıyla listeler", async () => {
    const t = await createTableType(db, base);
    expect(t).toMatchObject({ name: "Standart", basePrice: "1500.00", capacity: 8 });
    const vip = await createTableType(db, { ...base, name: "VIP", isActive: false });
    const event = await f.createEvent(db);
    await f.createTable(db, event.id, { tableTypeId: t.id });
    await f.createTable(db, event.id, { tableTypeId: t.id });

    const all = await listTableTypes(db);
    expect(all.map((x) => [x.name, x.usageCount])).toEqual([
      ["Standart", 2],
      ["VIP", 0],
    ]);
    expect((await listTableTypes(db, { activeOnly: true })).map((x) => x.name)).toEqual(["Standart"]);

    const updated = await updateTableType(db, { ...base, id: vip.id, name: "VIP+", capacity: 12, isActive: true });
    expect(updated).toMatchObject({ name: "VIP+", capacity: 12, isActive: true });
  });

  it("kullanımdaki tip silinemez; kullanılmayan silinir", async () => {
    const used = await createTableType(db, base);
    const free = await createTableType(db, { ...base, name: "Boş" });
    const event = await f.createEvent(db);
    await f.createTable(db, event.id, { tableTypeId: used.id });
    const err = await deleteTableType(db, { id: used.id }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe("conflict");
    await deleteTableType(db, { id: free.id });
    expect((await listTableTypes(db)).map((x) => x.name)).toEqual(["Standart"]);
  });

  it("olmayan tip not_found", async () => {
    const err = await updateTableType(db, { ...base, id: crypto.randomUUID() }).catch((e: unknown) => e);
    expect((err as DomainError).code).toBe("not_found");
  });

  it("şema: kapasite 0 ve negatif fiyat reddedilir; form metinleri sayıya çevrilir", () => {
    expect(createTableTypeSchema.safeParse({ ...base, capacity: 0 }).success).toBe(false);
    expect(createTableTypeSchema.safeParse({ ...base, basePrice: -1 }).success).toBe(false);
    const parsed = createTableTypeSchema.parse({ ...base, capacity: "10", basePrice: "99.5" });
    expect(parsed).toMatchObject({ capacity: 10, basePrice: 99.5 });
  });
});
