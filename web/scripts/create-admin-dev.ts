/**
 * Yönetici kullanıcı oluşturur.
 *
 * Kullanım:
 *   ADMIN_PASSWORD=... npx tsx --env-file=.env.local scripts/create-admin.ts <username> [email]
 *
 * Parola yalnızca ADMIN_PASSWORD ortam değişkeninden okunur (komut satırı
 * geçmişine ve süreç listesine düşmesin diye argüman olarak alınmaz).
 * E-posta verilmezse `<username>@eventflow.invalid` yer tutucusu kullanılır.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { auth, hashPassword, MIN_PASSWORD_LENGTH } from "@/features/auth/auth";
import { isValidUsername, MAX_USERNAME_LENGTH, MIN_USERNAME_LENGTH } from "@/features/auth/username";

export const PLACEHOLDER_EMAIL_DOMAIN = "eventflow.invalid";

export type CreateAdminInput = {
  username: string;
  password: string;
  email?: string;
  name?: string;
};

export type CreatedAdmin = { id: string; username: string; email: string };

export async function createAdmin(input: CreateAdminInput): Promise<CreatedAdmin> {
  // Kırpma yapılmaz: baş/son boşluklu ad sessizce değiştirilmek yerine reddedilir.
  const { username } = input;
  if (!isValidUsername(username)) {
    throw new Error(
      `Kullanıcı adı geçersiz: ${MIN_USERNAME_LENGTH}–${MAX_USERNAME_LENGTH} karakter olmalı, ` +
        "başında/sonunda boşluk ve kontrol karakteri içermemeli",
    );
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Parola en az ${MIN_PASSWORD_LENGTH} karakter olmalı`);
  }
  const email = (input.email?.trim() || `${username}@${PLACEHOLDER_EMAIL_DOMAIN}`).toLowerCase();

  const ctx = await auth.$context;
  const passwordHash = await hashPassword(input.password);

  const user = await ctx.internalAdapter.createUser(
    {
      name: input.name?.trim() || username,
      email,
      emailVerified: true,
      username,
      role: "admin",
      isActive: true,
    },
    { method: "admin" },
  );
  try {
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: passwordHash,
    });
  } catch (error) {
    // Parolasız (giriş yapamayan) yetim kullanıcı bırakma.
    await ctx.internalAdapter.deleteUser(user.id);
    throw error;
  }
  return { id: user.id, username, email };
}

async function main(): Promise<void> {
  const [username, email] = process.argv.slice(2);
  const password = process.env.ADMIN_PASSWORD;
  if (!username) {
    console.error("Kullanım: tsx scripts/create-admin.ts <username> [email]");
    process.exit(1);
  }
  if (!password) {
    console.error("ADMIN_PASSWORD ortam değişkeni gerekli");
    process.exit(1);
  }
  const created = await createAdmin({ username, password, email });
  console.log(`Yönetici oluşturuldu: ${created.username} <${created.email}> (${created.id})`);
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
