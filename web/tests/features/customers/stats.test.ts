import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { customerTags } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { getCustomerStats } from "@/features/customers/queries";
import { tagStyle, vipTier, VIP_SCORE_THRESHOLD } from "@/features/customers/vip";
import { adminActor, memberActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createCustomer } from "../../helpers/factories";

const ADMIN = adminActor({ id: "00000000-0000-4000-8000-000000000001" });

describe("müşteri istatistikleri ve VIP paleti", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("toplam, VIP (puan ya da etiket, tek sayım), kara liste ve katılım sayılır", async () => {
    const scored = await createCustomer(db, { vipScore: VIP_SCORE_THRESHOLD, totalAttendedEvents: 3 });
    const tagged = await createCustomer(db, { vipScore: 5, totalAttendedEvents: 2 });
    const both = await createCustomer(db, { vipScore: 90, isBlacklisted: true });
    await createCustomer(db, { vipScore: 10 });
    await db.insert(customerTags).values([
      { customerId: tagged.id, tag: "vip" },
      { customerId: both.id, tag: "VIP" },
      { customerId: scored.id, tag: "Vegan" },
    ]);

    expect(await getCustomerStats(db, ADMIN)).toEqual({ total: 4, vip: 3, blacklisted: 1, attended: 5 });
  });

  it("boş veritabanında sıfır döner; yetkisiz rol reddedilir", async () => {
    expect(await getCustomerStats(db, ADMIN)).toEqual({ total: 0, vip: 0, blacklisted: 0, attended: 0 });
    await expect(getCustomerStats(db, memberActor("casino", { check_in: "vc--" }))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("etiket paleti eski anahtarları ve Türkçe yazımları tanır; bilinmeyen etiket nötr kalır", () => {
    expect(tagStyle("sahne_onu_sever").label).toBe("Sahne Önü");
    expect(tagStyle("Bahşiş").className).toContain("blue");
    expect(tagStyle("SORUNLU").label).toBe("Dikkat");
    expect(tagStyle("VIP").className).toContain("yellow");
    expect(tagStyle("Düzenli")).toEqual({ label: "Düzenli", className: expect.stringContaining("slate") });
    expect(vipTier(80).label).toBe("VIP");
    expect(vipTier(10).label).toBe("Standart");
  });
});
