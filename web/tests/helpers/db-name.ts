// Bu dosya hiçbir proje modülüne bağlı değildir; hem vitest.config.ts hem test yardımcıları kullanır.
export const DEFAULT_TEST_DB = "eventflow_test";
export const PG_BASE_URL = "postgres://postgres@localhost:54329";

const TEST_DB_PATTERN = /^eventflow_test[a-z0-9_]*$/;
// PostgreSQL tanımlayıcıları en fazla 63 bayttır.
const MAX_LENGTH = 63;

/**
 * `TEST_DB_NAME` ortam değişkenini doğrular. Yalnızca `eventflow_test` önekli adlar
 * kabul edilir; böylece testler `eventflow_dev` ya da `postgres` veritabanına dokunamaz.
 * Geçersiz ad, herhangi bir bağlantı kurulmadan önce hata fırlatır.
 */
export function resolveTestDbName(raw: string | undefined): string {
  if (raw === undefined || raw === "") return DEFAULT_TEST_DB;
  if (raw.length > MAX_LENGTH || !TEST_DB_PATTERN.test(raw)) {
    throw new Error(
      `TEST_DB_NAME geçersiz: ${JSON.stringify(raw)}. Ad ${TEST_DB_PATTERN} desenine uymalı ve en fazla ${MAX_LENGTH} karakter olmalıdır.`,
    );
  }
  return raw;
}

/** `<base>_<suffix>`; sonuç `resolveTestDbName` kuralını geçmezse aynı hata (ör. şeridin `_mig` veritabanı). */
export function derivedTestDbName(base: string, suffix: string): string {
  return resolveTestDbName(`${base}_${suffix}`);
}

export function testDatabaseUrl(name: string): string {
  return `${PG_BASE_URL}/${name}`;
}
