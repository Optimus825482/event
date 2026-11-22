export type PgErrorInfo = { code: string; constraint: string };

const SQLSTATE = /^\d{2}[0-9A-Z]{3}$/;

/**
 * Hata zincirinde (`error`, `error.cause`, ...) PostgreSQL SQLSTATE kodunu ve kısıt adını arar.
 * Yalnızca SQLSTATE biçimindeki (`23505` gibi 5 karakter) `code` değerleri sayılır: `DomainError.code`
 * ("conflict") ya da Node hata kodları ("ECONNRESET") veritabanı hatası sanılmaz ve aramaya zincirde devam edilir.
 */
export function pgErrorInfo(error: unknown): PgErrorInfo | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth += 1) {
    if ("code" in current && typeof current.code === "string" && SQLSTATE.test(current.code)) {
      const constraint = "constraint" in current && typeof current.constraint === "string" ? current.constraint : "";
      return { code: current.code, constraint };
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

export const pgCodeOf = (error: unknown): string | undefined => pgErrorInfo(error)?.code;

/** Kısıt adı; hata PostgreSQL hatası değilse ya da kısıtsızsa `undefined`. */
export const pgConstraintOf = (error: unknown): string | undefined => {
  const info = pgErrorInfo(error);
  return info && info.constraint !== "" ? info.constraint : undefined;
};
