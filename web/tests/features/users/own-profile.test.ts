import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { getOwnProfile } from "@/features/users/profile";
import { adminActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createUser } from "../../helpers/factories";

describe("kendi profil bilgisi", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("yalnızca oturumdaki kullanıcının profil alanlarını döndürür", async () => {
    await createUser(db, { username: "baska", name: "Başka Kişi" });
    const me = await createUser(db, {
      username: "ayse",
      name: "Ayşe Demir",
      email: "ayse@example.test",
      phone: "0533 000 00 00",
      position: "Şef",
    });

    expect(await getOwnProfile(db, adminActor({ id: me.id }))).toEqual({
      name: "Ayşe Demir",
      username: "ayse",
      email: "ayse@example.test",
      phone: "0533 000 00 00",
      position: "Şef",
      image: null,
    });
  });

  it("hesap yoksa null döner", async () => {
    expect(await getOwnProfile(db, adminActor())).toBeNull();
  });
});
