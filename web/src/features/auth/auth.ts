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
import { ROLES } from "./roles";

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

export const auth = betterAuth({
  appName: "EventFlow",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  advanced: {
    database: { generateId: "uuid" },
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
  rateLimit: { enabled: true },
  user: {
    additionalFields: {
      role: { type: [...ROLES], required: false, defaultValue: "staff", input: false },
      isActive: { type: "boolean", required: false, defaultValue: true, input: false },
      staffId: { type: "string", required: false, input: false },
      color: { type: "string", required: false, input: false },
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
      // Eski sistemde kullanıcı adları büyük/küçük harf duyarlıdır ve
      // yönetici tarafından en fazla 100 karakterle serbestçe oluşturulabilir.
      usernameNormalization: false,
      displayUsername: false,
      minUsernameLength: 1,
      maxUsernameLength: 100,
      usernameValidator: (value) => value.trim().length > 0,
    }),
    // Sunucu eylemlerinden yapılan auth.api çağrılarının çerezlerini yazar; en sonda olmalı.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
