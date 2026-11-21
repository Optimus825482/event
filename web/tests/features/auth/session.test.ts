import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { accounts, users } from "@/db/schema";
import { auth } from "@/features/auth/auth";
import { getActorFromHeaders } from "@/features/auth/session";
import { createAdmin } from "../../../scripts/create-admin";
import { truncateAll } from "../../helpers/db";

const BASE_URL = "http://localhost:3000";
const PASSWORD = "GucluParola!2024";

let ipCounter = 0;
/** Her istek için ayrı bir istemci IP'si: hız sınırı testleri birbirini etkilemesin. */
function nextIp(): string {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

async function post(path: string, body: unknown, ip: string = nextIp()): Promise<Response> {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    }),
  );
}

function signIn(username: string, password: string, ip?: string): Promise<Response> {
  return post("/sign-in/username", { username, password }, ip);
}

function sessionCookie(res: Response): string {
  const cookie = res.headers.getSetCookie().find((c) => c.includes("session_token="));
  if (!cookie) throw new Error("Oturum çerezi bulunamadı");
  return cookie;
}

function cookieHeader(res: Response): Headers {
  const pair = sessionCookie(res).split(";")[0] ?? "";
  return new Headers({ cookie: pair });
}

describe("kimlik doğrulama", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("betikle oluşturulan kullanıcı kullanıcı adı + parola ile giriş yapar ve httpOnly oturum çerezi alır", async () => {
    await createAdmin({ username: "yonetici", password: PASSWORD });

    const res = await signIn("yonetici", PASSWORD);

    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toMatch(/;\s*HttpOnly/i);
  });

  it("e-posta verilmeden oluşturulan yönetici yer tutucu e-posta ve admin rolü alır", async () => {
    await createAdmin({ username: "yonetici", password: PASSWORD });

    const [row] = await db.select().from(users).where(eq(users.username, "yonetici"));

    expect(row?.email).toBe("yonetici@eventflow.invalid");
    expect(row?.role).toBe("admin");
    expect(row?.isActive).toBe(true);
  });

  it("yanlış parola reddedilir ve yanıt kullanıcı adının var olup olmadığını ele vermez", async () => {
    await createAdmin({ username: "yonetici", password: PASSWORD });

    const wrongPassword = await signIn("yonetici", "YanlisParola!2024");
    const unknownUser = await signIn("olmayan_kullanici", "YanlisParola!2024");

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(wrongPassword.status);
    expect(await unknownUser.json()).toEqual(await wrongPassword.json());
    expect(wrongPassword.headers.getSetCookie().some((c) => c.includes("session_token="))).toBe(false);
  });

  it("herkese açık kayıt ucu kullanıcı oluşturmaz", async () => {
    const res = await post("/sign-up/email", {
      name: "Saldırgan",
      email: "saldirgan@example.com",
      password: "SaldirganParola!2024",
      username: "saldirgan",
    });

    expect(res.ok).toBe(false);
    const rows = await db.select({ id: users.id }).from(users);
    expect(rows).toHaveLength(0);
  });

  it("eski sistemden gelen bcrypt hash'i ile giriş başarılıdır", async () => {
    const [user] = await db
      .insert(users)
      .values({ name: "Eski Kullanıcı", email: "eski@eventflow.invalid", username: "eski_kullanici" })
      .returning({ id: users.id });
    if (!user) throw new Error("Kullanıcı eklenemedi");
    await db.insert(accounts).values({
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: bcrypt.hashSync("EskiParola!2024", 12),
    });

    const res = await signIn("eski_kullanici", "EskiParola!2024");

    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toMatch(/;\s*HttpOnly/i);
  });

  it("is_active=false yapılan kullanıcının geçerli oturum çereziyle getActor null döner", async () => {
    const created = await createAdmin({ username: "yonetici", password: PASSWORD });
    const res = await signIn("yonetici", PASSWORD);
    const headers = cookieHeader(res);

    expect(await getActorFromHeaders(headers)).toEqual({
      id: created.id,
      username: "yonetici",
      role: "admin",
      staffId: null,
    });

    await db.update(users).set({ isActive: false }).where(eq(users.id, created.id));

    expect(await getActorFromHeaders(headers)).toBeNull();
  });

  it("oturum çerezi olmadan getActor null döner", async () => {
    expect(await getActorFromHeaders(new Headers())).toBeNull();
  });

  it("pasif kullanıcı doğru parolayla da giriş yapamaz ve aynı genel hatayı alır", async () => {
    const created = await createAdmin({ username: "yonetici", password: PASSWORD });
    await db.update(users).set({ isActive: false }).where(eq(users.id, created.id));
    const wrongPassword = await signIn("yonetici", "YanlisParola!2024");

    const res = await signIn("yonetici", PASSWORD);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(await wrongPassword.json());
  });

  it("giriş ucunda hız sınırı açıktır", async () => {
    const ip = nextIp();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      statuses.push((await signIn("olmayan_kullanici", "YanlisParola!2024", ip)).status);
    }

    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses[3]).toBe(429);
  });
});
