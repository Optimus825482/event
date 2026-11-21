/**
 * Sunucu tarafı hata günlüğü: stderr'e tek satır JSON yazar.
 * Hata ayrıntıları yalnızca burada kalır; istemciye asla döndürülmez.
 */
export function logError(scope: string, error: unknown): void {
  const entry: Record<string, unknown> = {
    level: "error",
    time: new Date().toISOString(),
    scope,
  };
  if (error instanceof Error) {
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

function describeCause(cause: unknown): unknown {
  if (cause instanceof Error) {
    return { name: cause.name, message: cause.message, code: "code" in cause ? cause.code : undefined };
  }
  return String(cause);
}
