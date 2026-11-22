import { authorize, type PolicyActor, type Verb } from "@/features/auth/policy";
import { DomainError } from "@/lib/action";

/** Hata zincirinde (`error`, `error.cause`, ...) PostgreSQL SQLSTATE kodunu arar. */
export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth += 1) {
    if ("code" in current && typeof current.code === "string") return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

type ConflictMessages = { unique?: string; foreignKey?: string };

/** `23505` (tekillik) ve `23503` (yabancı anahtar) hatalarını Türkçe `conflict`e çevirir. */
export async function mapDbConflicts<T>(run: () => Promise<T>, messages: ConflictMessages): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const code = pgErrorCode(error);
    if (code === "23505" && messages.unique) throw new DomainError("conflict", messages.unique);
    if (code === "23503" && messages.foreignKey) throw new DomainError("conflict", messages.foreignKey);
    throw error;
  }
}

/** Servis düzeyinde ikinci savunma: kullanıcı özel izinleri action katmanında uygulanır. */
export function ensureStaffAccess(actor: PolicyActor, verb: Verb): void {
  authorize(actor, "staff", verb);
}
