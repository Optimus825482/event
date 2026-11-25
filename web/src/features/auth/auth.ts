import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { USERNAME_ERROR_CODES, username } from "better-auth/plugins";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/env";
import { eventflowGuard } from "./guard";
import { ROLES } from "./roles";
import { isValidUsername, MAX_USERNAME_LENGTH, MIN_USERNAME_LENGTH } from "./username";

/** Eski sistemle aynı bcrypt maliyeti; eski hash'ler olduğu gibi doğrulanır. */
export const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 12;
const SESSION_DAYS = 7;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword({ hash, password }: { hash: string; password: string }): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function isUserActive(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ isActive: schema.users.isActive })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  return row?.isActive === true;
}

export type CreateAuthOptions = {
  /** Üretim: oturum çerezleri her zaman `Secure`. */
  production: boolean;
  baseURL: string;
  /**
   * İstemci IP'sinin okunacağı, ters vekilin yazdığı başlık. Tanımsızsa hiçbir
   * istemci başlığına güvenilmez (IP sınırı tek ortak kovaya düşer).
   */
  trustedIpHeader?: string;
};

/** İstemcilerin hiçbir uçtan değiştiremeyeceği ek kullanıcı alanları. */
const serverOnly = { required: false, input: false } as const;

export function createAuth(options: CreateAuthOptions) {
  return betterAuth({
    appName: "EventFlow",
    baseURL: options.baseURL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
    advanced: {
      database: { generateId: "uuid" },
      useSecureCookies: options.production,
      ipAddress: {
        ipAddressHeaders: options.trustedIpHeader ? [options.trustedIpHeader] : [],
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      password: { hash: hashPassword, verify: verifyPassword },
    },
    session: {
      expiresIn: 60 * 60 * 24 * SESSION_DAYS,
      // Çerez önbelleği kapalı: her oturum okuması veritabanına gider.
      cookieCache: { enabled: false },
    },
    rateLimit: { enabled: true, storage: "database" },
    user: {
      additionalFields: {
        role: { ...serverOnly, type: [...ROLES], defaultValue: "user" },
        isActive: { ...serverOnly, type: "boolean", defaultValue: true },
        staffId: { ...serverOnly, type: "string" },
        color: { ...serverOnly, type: "string" },
        phone: { ...serverOnly, type: "string" },
        position: { ...serverOnly, type: "string" },
      },
    },
    databaseHooks: {
      session: {
        create: {
          // Pasif kullanıcıya oturum açılmaz; yanıt yanlış parolayla aynıdır.
          async before(session) {
            if (!(await isUserActive(session.userId))) {
              throw APIError.from("UNAUTHORIZED", USERNAME_ERROR_CODES.INVALID_USERNAME_OR_PASSWORD);
            }
          },
        },
      },
    },
    plugins: [
      username({
        // Eski sistemle uyum: büyük/küçük harf duyarlı, 1–100 karakter.
        usernameNormalization: false,
        displayUsername: false,
        minUsernameLength: MIN_USERNAME_LENGTH,
        maxUsernameLength: MAX_USERNAME_LENGTH,
        usernameValidator: isValidUsername,
      }),
      eventflowGuard(),
      // Sunucu eylemlerinden yapılan auth.api çağrılarının çerezlerini yazar; en sonda olmalı.
      nextCookies(),
    ],
  });
}

export const auth = createAuth({
  production: env.NODE_ENV === "production",
  baseURL: env.BETTER_AUTH_URL,
  trustedIpHeader: env.TRUSTED_IP_HEADER,
});

export type Auth = typeof auth;
