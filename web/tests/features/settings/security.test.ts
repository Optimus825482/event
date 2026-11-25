import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { loginAttempts, sessions } from "@/db/schema";
import { BCRYPT_COST, MIN_PASSWORD_LENGTH } from "@/features/auth/auth";
import { ForbiddenError } from "@/features/auth/errors";
import {
  ALL_IPS_KEY,
  LOGIN_WINDOW_MINUTES,
  MAX_ATTEMPTS_ALL_IPS,
  MAX_ATTEMPTS_PER_IP,
} from "@/features/auth/login-attempts";
import type { Actor } from "@/features/auth/session";
import { getSecurityOverview } from "@/features/settings/security-queries";
import { getSecurityPolicy } from "@/features/settings/security-policy";
import { clearLockoutSchema, revokeSessionSchema } from "@/features/settings/security-schemas";
import {
  clearLockout,
  listActiveSessions,
  listLockouts,
  revokeOtherSessions,
  revokeSession,
} from "@/features/settings/security-service";
import { DomainError } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import { createUser } from "../../helpers/factories";

const HOUR = 60 * 60 * 1000;

async function actorOf(role: Actor["role"]): Promise<Actor> {
  const u = await createUser(db, { role });
  return { id: u.id, username: u.username, role: u.role, staffId: null, memberships: [], permissions: [] };
}

async function addSession(userId: string, opts: { expiresInMs?: number; ip?: string | null } = {}) {
  const [row] = await db
    .insert(sessions)
    .values({
      userId,
      token: `tok-${randomUUID()}`,
      expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 24 * HOUR)),
      ipAddress: opts.ip === undefined ? "10.0.0.1" : opts.ip,
      userAgent: "Mozilla/5.0 Test",
    })
    .returning();
  if (!row) throw new Error("oturum eklenemedi");
  return row;
}

async function addAttempt(username: string, ip: string, attempts: number, expiresInMs = HOUR) {
  await db.insert(loginAttempts).values({ username, ip, attempts, expiresAt: new Date(Date.now() + expiresInMs) });
}

describe("güvenlik sekmesi", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  describe("politika özeti", () => {
    it("değerler kimlik doğrulama sabitlerinden gelir", () => {
      const policy = getSecurityPolicy();
      expect(policy.minPasswordLength).toBe(MIN_PASSWORD_LENGTH);
      expect(policy.bcryptCost).toBe(BCRYPT_COST);
      expect(policy.maxAttemptsPerIp).toBe(MAX_ATTEMPTS_PER_IP);
      expect(policy.maxAttemptsAllIps).toBe(MAX_ATTEMPTS_ALL_IPS);
      expect(policy.windowMinutes).toBe(LOGIN_WINDOW_MINUTES);
      expect(policy.sessionDays).toBe(7);
    });
  });

  describe("oturum listesi", () => {
    it("etkin oturumları üst veriyle listeler, belirteç sızdırmaz, süresi dolanı ve başkasının belirtecini göstermez", async () => {
      const admin = await actorOf("admin");
      const other = await createUser(db, { role: "staff" });
      const mine = await addSession(admin.id);
      const theirs = await addSession(other.id, { ip: null });
      await addSession(other.id, { expiresInMs: -HOUR });

      const rows = await listActiveSessions(db, admin, mine.id);
      expect(rows.map((r) => r.id).sort()).toEqual([mine.id, theirs.id].sort());
      expect(rows.find((r) => r.id === mine.id)?.isCurrent).toBe(true);
      expect(rows.find((r) => r.id === theirs.id)).toMatchObject({ isCurrent: false, ipAddress: null, username: other.username });
      expect(JSON.stringify(rows)).not.toContain("tok-");
      expect(JSON.stringify(await getSecurityOverview(db, admin, mine.id))).not.toContain("tok-");
    });

    it("admin olmayan okuyamaz", async () => {
      const organizer = await actorOf("organizer");
      await expect(listActiveSessions(db, organizer, null)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getSecurityOverview(db, organizer, null)).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe("oturum kapatma", () => {
    it("başkasının oturumunu kapatır", async () => {
      const admin = await actorOf("admin");
      const other = await createUser(db);
      const mine = await addSession(admin.id);
      const theirs = await addSession(other.id);

      await revokeSession(db, admin, { sessionId: theirs.id }, mine.id);
      expect(await db.select().from(sessions).where(eq(sessions.id, theirs.id))).toHaveLength(0);
      expect(await db.select().from(sessions).where(eq(sessions.id, mine.id))).toHaveLength(1);
    });

    it("kendi geçerli oturumu tek tek kapatılamaz; geçerli oturum bilinmiyorsa da koruma sürer", async () => {
      const admin = await actorOf("admin");
      const mine = await addSession(admin.id);
      await expect(revokeSession(db, admin, { sessionId: mine.id }, mine.id)).rejects.toBeInstanceOf(DomainError);
      expect(await db.select().from(sessions).where(eq(sessions.id, mine.id))).toHaveLength(1);
    });

    it("olmayan oturum için not_found", async () => {
      const admin = await actorOf("admin");
      await expect(revokeSession(db, admin, { sessionId: randomUUID() }, null)).rejects.toMatchObject({
        code: "not_found",
      });
    });

    it("toplu kapatma geçerli oturumu korur, diğerlerini siler", async () => {
      const admin = await actorOf("admin");
      const other = await createUser(db);
      const mine = await addSession(admin.id);
      const sibling = await addSession(admin.id);
      await addSession(other.id);

      const out = await revokeOtherSessions(db, admin, mine.id);
      expect(out.revokedCount).toBe(2);
      const left = await db.select().from(sessions);
      expect(left.map((s) => s.id)).toEqual([mine.id]);
      expect(left.some((s) => s.id === sibling.id)).toBe(false);
    });

    it("geçerli oturum bilinmiyorsa toplu kapatma hiçbir şey silmez", async () => {
      const admin = await actorOf("admin");
      await addSession(admin.id);
      await expect(revokeOtherSessions(db, admin, null)).rejects.toBeInstanceOf(DomainError);
      expect(await db.select().from(sessions)).toHaveLength(1);
    });

    it("admin olmayan kapatamaz ve hiçbir oturum silinmez", async () => {
      const organizer = await actorOf("organizer");
      const victim = await addSession((await createUser(db)).id);
      await expect(revokeSession(db, organizer, { sessionId: victim.id }, null)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(revokeOtherSessions(db, organizer, randomUUID())).rejects.toBeInstanceOf(ForbiddenError);
      expect(await db.select().from(sessions)).toHaveLength(1);
    });
  });

  describe("giriş kilitleri", () => {
    it("yalnızca sınırı aşmış ve süresi dolmamış satırları listeler", async () => {
      const admin = await actorOf("admin");
      await addAttempt("kilitli", "1.2.3.4", MAX_ATTEMPTS_PER_IP + 1);
      await addAttempt("sinirda", "1.2.3.4", MAX_ATTEMPTS_PER_IP);
      await addAttempt("suresi-dolmus", "1.2.3.4", MAX_ATTEMPTS_PER_IP + 3, -HOUR);
      await addAttempt("dagitik", ALL_IPS_KEY, MAX_ATTEMPTS_ALL_IPS + 1);
      await addAttempt("dagitik-alti", ALL_IPS_KEY, MAX_ATTEMPTS_PER_IP + 1);
      await addAttempt(` pwchange:${randomUUID()}`, "unknown", MAX_ATTEMPTS_PER_IP + 1);

      const rows = await listLockouts(db, admin);
      expect(rows.map((r) => `${r.username}|${r.scope}`).sort()).toEqual(["dagitik|all", "kilitli|ip"]);
    });

    it("kilidi kaldırır; kilitli olmayan ya da olmayan satır için not_found", async () => {
      const admin = await actorOf("admin");
      await addAttempt("kilitli", "1.2.3.4", MAX_ATTEMPTS_PER_IP + 2);
      await addAttempt("kilitli", ALL_IPS_KEY, 9);

      await clearLockout(db, admin, { username: "kilitli", ip: "1.2.3.4" });
      expect(await listLockouts(db, admin)).toHaveLength(0);
      // Genel sayaç satırına dokunulmaz.
      expect(await db.select().from(loginAttempts)).toHaveLength(1);

      await expect(clearLockout(db, admin, { username: "kilitli", ip: "1.2.3.4" })).rejects.toMatchObject({
        code: "not_found",
      });
      await expect(clearLockout(db, admin, { username: "kilitli", ip: ALL_IPS_KEY })).rejects.toMatchObject({
        code: "not_found",
      });
    });

    it("admin olmayan listeleyemez ve kaldıramaz", async () => {
      const organizer = await actorOf("organizer");
      await addAttempt("kilitli", "1.2.3.4", MAX_ATTEMPTS_PER_IP + 1);
      await expect(listLockouts(db, organizer)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(clearLockout(db, organizer, { username: "kilitli", ip: "1.2.3.4" })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(await db.select().from(loginAttempts)).toHaveLength(1);
    });
  });

  describe("şemalar", () => {
    it("oturum kimliği UUID olmalı; kilit anahtarları boş olamaz", () => {
      expect(revokeSessionSchema.safeParse({ sessionId: "x" }).success).toBe(false);
      expect(revokeSessionSchema.safeParse({ sessionId: randomUUID() }).success).toBe(true);
      expect(clearLockoutSchema.safeParse({ username: "", ip: "1.1.1.1" }).success).toBe(false);
      expect(clearLockoutSchema.safeParse({ username: "a", ip: "" }).success).toBe(false);
    });
  });
});
