const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Biçim denetimi (sürüm/varyant bakmaz): veritabanı `uuid` sütununa güvenle verilebilir. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** `LIKE`/`ILIKE` kalıbında `\`, `%` ve `_` karakterlerini sıradan metin yapar. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, "\\$&");
}
