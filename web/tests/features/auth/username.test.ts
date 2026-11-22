import { beforeEach, describe, expect, it } from "vitest";
import { isValidUsername } from "@/features/auth/username";
import { createAdmin } from "../../../scripts/create-admin-dev";
import { truncateAll } from "../../helpers/db";
import { PASSWORD, signIn } from "./helpers";

const REJECTED = [" admin", "admin ", "ad\u0000min", "ad​min", "a".repeat(101), ""];
const ACCEPTED = ["Ahmet Yılmaz", "a", "a".repeat(100), "Erkan"];

describe("kullanıcı adı kuralları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it.each(REJECTED)("createAdmin %j kullanıcı adını reddeder", async (username) => {
    await expect(createAdmin({ username, password: PASSWORD })).rejects.toThrow(/Kullanıcı adı/);
  });

  it.each(ACCEPTED)("createAdmin %j kullanıcı adını kabul eder ve giriş yapılır", async (username) => {
    await createAdmin({ username, password: PASSWORD });

    expect((await signIn(username, PASSWORD)).status).toBe(200);
  });

  it("büyük/küçük harf duyarlıdır", async () => {
    await createAdmin({ username: "Erkan", password: PASSWORD });

    expect((await signIn("erkan", PASSWORD)).status).toBe(401);
  });

  it("eklenti doğrulayıcısı aynı kuralı uygular", () => {
    for (const username of REJECTED) expect(isValidUsername(username)).toBe(false);
    for (const username of ACCEPTED) expect(isValidUsername(username)).toBe(true);
  });

  it("geçersiz kullanıcı adıyla giriş denemesi oturum açmaz", async () => {
    const res = await signIn(" admin", PASSWORD);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
