/**
 * Sunucu tarafı hata günlüğü: stderr'e tek satır JSON yazar.
 * Hata ayrıntıları yalnızca burada kalır; istemciye asla döndürülmez.
 *
 * Veritabanı hataları kişisel veri ve gizli değer taşıyabilir (Drizzle iletisi `params: ...` içerir,
 * pg `detail` alanı `Key (phone)=(...)` içerir). Bu yüzden onlar için yalnızca sorgu metni (yer tutuculu),
 * SQLSTATE, kısıt ve tablo adı yazılır; ileti, parametre ve ayrıntı yazılmaz; yığından iletiyi içeren
 * başlık satırları atılır.
 */
type Entry = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** `DrizzleQueryError`: `query` ve `params` alanlarına sahiptir (adı `Error` olarak kalır). */
function isDrizzleQueryError(error: unknown): error is Error & { query: string } {
  return error instanceof Error && "params" in error && "query" in error && typeof error.query === "string";
}

/** node-postgres `DatabaseError` (ileti ve `detail` alanları değer içerebilir). */
function isPgDatabaseError(error: unknown): error is Error {
  return error instanceof Error && "severity" in error && "routine" in error;
}

function sensitive(error: unknown): error is Error {
  return isDrizzleQueryError(error) || isPgDatabaseError(error);
}

function stringField(source: unknown, key: string): string | undefined {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return typeof value === "string" ? value : undefined;
}

/** Yığının yalnızca çerçeve satırlarını (`    at ...`) tutar; başlık satırları iletiyi içerir. */
function frames(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  return stack
    .split("\n")
    .filter((line) => /^\s+at /.test(line))
    .join("\n");
}

function describeDbError(error: Error): Entry {
  return {
    name: isDrizzleQueryError(error) ? "DrizzleQueryError" : error.name,
    code: stringField(error, "code"),
    constraint: stringField(error, "constraint"),
    table: stringField(error, "table"),
  };
}

function describeCause(cause: unknown): unknown {
  if (sensitive(cause)) return describeDbError(cause);
  if (cause instanceof Error) {
    return { name: cause.name, message: cause.message, code: stringField(cause, "code") };
  }
  return String(cause);
}

export function logError(scope: string, error: unknown): void {
  const entry: Entry = {
    level: "error",
    time: new Date().toISOString(),
    scope,
  };
  if (sensitive(error)) {
    Object.assign(entry, describeDbError(error));
    if (isDrizzleQueryError(error)) entry.query = error.query;
    entry.stack = frames(error.stack);
    if (error.cause !== undefined) entry.cause = describeCause(error.cause);
  } else if (error instanceof Error) {
    entry.name = error.name;
    entry.message = error.message;
    entry.stack = error.stack;
    if ("code" in error) entry.code = error.code;
    if (error.cause !== undefined) entry.cause = describeCause(error.cause);
  } else {
    entry.message = String(error);
  }
  process.stderr.write(`${JSON.stringify(entry)}\n`);
}
