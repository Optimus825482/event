/**
 * İlk yöneticiyi oluşturur ya da parolasını sıfırlar (düz Node ESM; tsx ve TypeScript kaynağı gerektirmez).
 * Üretim imajında `/opt/migrator/create-admin.mjs` olarak bulunur (bkz. DEPLOYMENT.md "İlk yönetici").
 *
 * Kullanım:
 *   ADMIN_PASSWORD=... node scripts/create-admin.mjs <kullanıcı-adı> [--email <e-posta>] [--name <ad>]
 *   printf %s "$PAROLA" | node scripts/create-admin.mjs --password-stdin <kullanıcı-adı>
 *   ... --reset   Var olan YÖNETİCİNİN parolasını değiştirir, hesabı etkinleştirir, tüm oturumlarını siler.
 *
 * Parola komut satırından alınmaz; yalnızca ADMIN_PASSWORD ortam değişkeninden ya da `--password-stdin` ile
 * standart girdiden (sondaki satır sonu atılır) okunur ve hiçbir yere yazılmaz. Veritabanı DATABASE_URL'dendir.
 *
 * Uygulamayla aynı kurallar: kullanıcı adı büyük/küçük harf duyarlı, 1-100 karakter, baş/son boşluk ve kontrol
 * karakteri yok (src/features/auth/username.ts); parola en az 12 karakter, bcrypt maliyeti 12 (src/features/auth/auth.ts);
 * yönetici kaydı users + `credential` sağlayıcılı accounts satırıdır (hesap kimliği = kullanıcı kimliği).
 *
 * Çıkış kodları: 0 başarılı | 1 kullanım/yapılandırma/doğrulama hatası | 2 etkin yönetici zaten var (--reset yok)
 *   | 3 kullanıcı adı ya da e-posta başka bir kullanıcıda | 4 --reset hedefi yok ya da yönetici değil | 5 veritabanı hatası.
 * Her sonuç için tek satır yazar (başarı stdout, hata stderr).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import pg from "pg";

export const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 12;
export const MIN_USERNAME_LENGTH = 1;
export const MAX_USERNAME_LENGTH = 100;
export const PLACEHOLDER_EMAIL_DOMAIN = "eventflow.invalid";

export const EXIT = { ok: 0, usage: 1, adminExists: 2, conflict: 3, notFound: 4, database: 5 };

// Sabit, uygulamaya özgü anahtar ("EVFL" + "ADMN"); migrate.mjs kilidinden farklıdır.
const LOCK_KEY = "4991030329302221";
const CONTROL_OR_FORMAT = /\p{C}/u;

/** Betik çıkış koduyla biten, kullanıcıya gösterilecek hata. */
export class CliError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function isValidUsername(value) {
  if (value.length < MIN_USERNAME_LENGTH || value.length > MAX_USERNAME_LENGTH) return false;
  if (value.trim() !== value) return false;
  return !CONTROL_OR_FORMAT.test(value);
}

export function parseArgs(argv) {
  const out = { username: undefined, email: undefined, name: undefined, reset: false, passwordStdin: false };
  const rest = [...argv];
  while (rest.length > 0) {
    const arg = rest.shift();
    if (arg === "--reset") out.reset = true;
    else if (arg === "--password-stdin") out.passwordStdin = true;
    else if (arg === "--email" || arg === "--name") {
      const value = rest.shift();
      if (value === undefined) throw new CliError(EXIT.usage, `${arg} için değer gerekli`);
      out[arg === "--email" ? "email" : "name"] = value;
    } else if (arg.startsWith("--")) throw new CliError(EXIT.usage, `Bilinmeyen seçenek: ${arg}`);
    else if (out.username === undefined) out.username = arg;
    else throw new CliError(EXIT.usage, "Yalnızca bir kullanıcı adı verilebilir (parola argüman olarak verilmez)");
  }
  return out;
}

async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk.toString("utf8");
  return data.replace(/\r?\n$/, "");
}

export function validate({ username, password }) {
  if (username === undefined) throw new CliError(EXIT.usage, "Kullanıcı adı gerekli");
  if (!isValidUsername(username)) {
    throw new CliError(
      EXIT.usage,
      `Kullanıcı adı geçersiz: ${MIN_USERNAME_LENGTH}-${MAX_USERNAME_LENGTH} karakter olmalı, başında/sonunda boşluk ve kontrol karakteri içermemeli`,
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new CliError(EXIT.usage, `Parola en az ${MIN_PASSWORD_LENGTH} karakter olmalı`);
  }
}

/**
 * Tek işlemde, advisory lock altında yöneticiyi oluşturur ya da sıfırlar. `client` bağlı bir pg.Client'tır.
 * Dönüş: { action: "created" | "reset", id, username }.
 */
export async function provisionAdmin(client, { username, password, email, name, reset }) {
  validate({ username, password });
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const mail = (email?.trim() || `${username}@${PLACEHOLDER_EMAIL_DOMAIN}`).toLowerCase();

  await client.query("begin");
  try {
    await client.query("select pg_advisory_xact_lock($1::bigint)", [LOCK_KEY]);
    const { rows: found } = await client.query("select id, role from users where username = $1", [username]);
    const existing = found[0];

    if (reset) {
      if (!existing) throw new CliError(EXIT.notFound, `Kullanıcı bulunamadı: ${username}`);
      if (existing.role !== "admin") {
        throw new CliError(EXIT.notFound, `${username} yönetici değil; --reset yalnızca yönetici hesapları içindir`);
      }
      await client.query(
        "update users set is_active = true, email_verified = true, updated_at = now() where id = $1",
        [existing.id],
      );
      const upd = await client.query(
        "update accounts set password = $2, updated_at = now() where user_id = $1 and provider_id = 'credential'",
        [existing.id, hash],
      );
      if (upd.rowCount === 0) {
        await client.query(
          "insert into accounts (account_id, provider_id, user_id, password) values ($1::text, 'credential', $1::uuid, $2)",
          [existing.id, hash],
        );
      }
      // Eski (belki ele geçmiş) oturumlar parola sıfırlamayla geçersiz olur.
      await client.query("delete from sessions where user_id = $1", [existing.id]);
      await client.query("commit");
      return { action: "reset", id: existing.id, username };
    }

    const { rows: active } = await client.query(
      "select 1 from users where role = 'admin' and is_active limit 1",
    );
    if (active.length > 0) {
      throw new CliError(
        EXIT.adminExists,
        "Etkin bir yönetici zaten var; hiçbir şey değiştirilmedi (parolayı sıfırlamak için --reset kullanın)",
      );
    }
    if (existing) {
      throw new CliError(
        EXIT.conflict,
        `${username} kullanıcı adı zaten kayıtlı (yönetici değil ya da pasif); onu yönetici yapmak/sıfırlamak için --reset kullanın ya da başka ad seçin`,
      );
    }
    const { rows: taken } = await client.query("select 1 from users where email = $1", [mail]);
    if (taken.length > 0) throw new CliError(EXIT.conflict, `E-posta başka bir kullanıcıda kayıtlı: ${mail}`);

    const { rows } = await client.query(
      "insert into users (name, email, email_verified, username, role, is_active) values ($1, $2, true, $3, 'admin', true) returning id",
      [name?.trim() || username, mail, username],
    );
    const id = rows[0].id;
    await client.query(
      "insert into accounts (account_id, provider_id, user_id, password) values ($1::text, 'credential', $1::uuid, $2)",
      [id, hash],
    );
    await client.query("commit");
    return { action: "created", id, username };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const password = args.passwordStdin ? await readStdin() : (process.env.ADMIN_PASSWORD ?? "");
  if (password === "") {
    throw new CliError(EXIT.usage, "Parola gerekli: ADMIN_PASSWORD ortam değişkeni ya da --password-stdin");
  }
  validate({ username: args.username, password });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new CliError(EXIT.usage, "DATABASE_URL tanımlı değil");

  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 15_000 });
  try {
    await client.connect();
    const result = await provisionAdmin(client, { ...args, password });
    const verb = result.action === "created" ? "yönetici oluşturuldu" : "yönetici parolası sıfırlandı";
    console.log(`create-admin: ${verb}: ${result.username} (${result.id})`);
  } catch (error) {
    if (error instanceof CliError) throw error;
    // Parola hiçbir hata iletisine girmez; yalnızca sürücünün iletisi yazılır.
    throw new CliError(
      EXIT.database,
      `veritabanı hatası: ${error instanceof Error ? error.message : String(error)} (migrate çalıştırıldı mı?)`,
    );
  } finally {
    await client.end().catch(() => {});
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  try {
    await main();
    process.exit(EXIT.ok);
  } catch (error) {
    if (error instanceof CliError) {
      console.error(`create-admin: ${error.message}`);
      process.exit(error.code);
    }
    console.error(`create-admin: beklenmeyen hata: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(EXIT.database);
  }
}
