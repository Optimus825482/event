import { spawnSync } from "node:child_process";
import path from "node:path";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { accounts, sessions, users } from "@/db/schema";
import { TEST_DATABASE_URL, truncateAll } from "../helpers/db";
import { PASSWORD, signedInCookie, signIn, WRONG_PASSWORD } from "../features/auth/helpers";

const SCRIPT = path.resolve(import.meta.dirname, "../../scripts/create-admin.mjs");
const NEW_PASSWORD = "BaskaGucluParola!2025";

type Run = { status: number | null; stdout: string; stderr: string };

function run(args: string[], env: Record<string, string> = {}, input?: string): Run {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", DATABASE_URL: TEST_DATABASE_URL, ...env },
    input,
    encoding: "utf8",
    timeout: 60_000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("scripts/create-admin.mjs (üretim imajındaki düz Node betiği)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("oluşturduğu yönetici uygulamanın gerçek auth işleyicisiyle giriş yapabilir", async () => {
    const res = run(["Yonetici"], { ADMIN_PASSWORD: PASSWORD });
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/^create-admin: yönetici oluşturuldu: Yonetici \(/);
    expect(res.stdout.trim().split("\n")).toHaveLength(1);

    const [user] = await db.select().from(users).where(eq(users.username, "Yonetici"));
    expect(user).toMatchObject({
      role: "admin",
      isActive: true,
      emailVerified: true,
      email: "yonetici@eventflow.invalid",
      name: "Yonetici",
    });
    const [account] = await db.select().from(accounts).where(eq(accounts.userId, user?.id ?? ""));
    expect(account).toMatchObject({ providerId: "credential", accountId: user?.id });
    expect(account?.password).toMatch(/^\$2[aby]\$12\$/);

    expect((await signIn("Yonetici", PASSWORD)).status).toBe(200);
    expect((await signIn("Yonetici", WRONG_PASSWORD)).status).not.toBe(200);
    // Kullanıcı adı büyük/küçük harf duyarlıdır (uygulamayla aynı).
    expect((await signIn("yonetici", PASSWORD)).status).not.toBe(200);
  });

  it("parolayı stdin'den okur ve e-posta/ad seçeneklerini uygular", async () => {
    const res = run(["--password-stdin", "--email", "Admin@Example.com", "--name", "Baş Yönetici", "ilk"], {}, `${PASSWORD}\n`);
    expect(res.status).toBe(0);
    const [user] = await db.select().from(users).where(eq(users.username, "ilk"));
    expect(user).toMatchObject({ email: "admin@example.com", name: "Baş Yönetici" });
    expect((await signIn("ilk", PASSWORD)).status).toBe(200);
  });

  it("etkin yönetici varken reddeder (çıkış 2) ve hiçbir şeyi değiştirmez", async () => {
    expect(run(["ilk"], { ADMIN_PASSWORD: PASSWORD }).status).toBe(0);
    const res = run(["ikinci"], { ADMIN_PASSWORD: NEW_PASSWORD });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("Etkin bir yönetici zaten var");
    expect(await db.select().from(users)).toHaveLength(1);
    expect((await signIn("ilk", PASSWORD)).status).toBe(200);
  });

  it("--reset parolayı değiştirir, pasif hesabı etkinleştirir ve eski oturumları siler", async () => {
    expect(run(["ilk"], { ADMIN_PASSWORD: PASSWORD }).status).toBe(0);
    await signedInCookie("ilk");
    expect(await db.select().from(sessions)).toHaveLength(1);
    await db.update(users).set({ isActive: false }).where(eq(users.username, "ilk"));
    expect((await signIn("ilk", PASSWORD)).status).not.toBe(200);

    const res = run(["--reset", "ilk"], { ADMIN_PASSWORD: NEW_PASSWORD });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("yönetici parolası sıfırlandı: ilk");
    expect(await db.select().from(sessions)).toHaveLength(0);
    expect((await signIn("ilk", PASSWORD)).status).not.toBe(200);
    expect((await signIn("ilk", NEW_PASSWORD)).status).toBe(200);
    expect(await db.select().from(accounts)).toHaveLength(1);
  });

  it("--reset var olmayan ya da yönetici olmayan kullanıcıda çıkış 4 verir", async () => {
    expect(run(["--reset", "yok"], { ADMIN_PASSWORD: PASSWORD }).status).toBe(4);
    await db.insert(users).values({ name: "p", email: "p@example.com", username: "personel", role: "user" });
    const res = run(["--reset", "personel"], { ADMIN_PASSWORD: PASSWORD });
    expect(res.status).toBe(4);
    const [user] = await db.select().from(users).where(eq(users.username, "personel"));
    expect(user?.role).toBe("user");
  });

  it("etkin yönetici yokken var olan kullanıcı adını sessizce ele geçirmez (çıkış 3)", async () => {
    await db.insert(users).values({ name: "p", email: "p@example.com", username: "personel", role: "user" });
    const res = run(["personel"], { ADMIN_PASSWORD: PASSWORD });
    expect(res.status).toBe(3);
    expect(res.stderr).toContain("--reset");
  });

  it("geçersiz girdide çıkış 1 verir ve parolayı hiçbir çıktıya yazmaz", async () => {
    const short = "kisa-parola";
    const res = run(["ilk"], { ADMIN_PASSWORD: short });
    expect(res.status).toBe(1);
    expect(res.stdout + res.stderr).not.toContain(short);
    expect(run(["ilk"]).status).toBe(1);
    expect(run([" boşluklu "], { ADMIN_PASSWORD: PASSWORD }).status).toBe(1);
    expect(run(["a", "b"], { ADMIN_PASSWORD: PASSWORD }).status).toBe(1);
    expect(run(["ilk"], { ADMIN_PASSWORD: PASSWORD, DATABASE_URL: "" }).status).toBe(1);
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it("ulaşılamayan veritabanında çıkış 5 verir ve bağlantı parolasını yazmaz", () => {
    const res = run(["ilk"], {
      ADMIN_PASSWORD: PASSWORD,
      DATABASE_URL: "postgres://postgres@localhost:1/none",
    });
    expect(res.status).toBe(5);
    expect(res.stdout + res.stderr).not.toContain(PASSWORD);
  });
});
