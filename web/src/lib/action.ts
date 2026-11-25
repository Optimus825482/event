import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { Db } from "@/db/client";
import { db } from "@/db/client";
import { ForbiddenError, UnauthenticatedError } from "@/features/auth/errors";
import { authorize, type Module, type PolicyResource, type Verb } from "@/features/auth/policy";
import { getActor, type Actor } from "@/features/auth/session";
import { logError } from "@/lib/log";
import { pgCodeOf } from "@/lib/pg-error";

export type ActionErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "invalid"
  | "conflict"
  | "not_found"
  | "error";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ActionErrorCode;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export type DomainErrorCode = "conflict" | "not_found" | "invalid";

/** Kullanıcıya gösterilmesi güvenli, iş kuralı kaynaklı hata (mesaj Türkçe ve ayrıntısızdır). */
export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export type ActionContext<S extends z.ZodType> = {
  actor: Actor;
  input: z.infer<S>;
  db: Db;
};

export type ActionOptions<S extends z.ZodType, T> = {
  module: Module;
  verb: Verb;
  input: S;
  /**
   * Sahipliğe bağlı izinler (ör. lider yalnızca kendi ekibi) için yetki kaynağı. Verilirse girdi
   * önce doğrulanır, sonra `authorize(module, verb, kaynak)` çağrılır.
   */
  resource?: (ctx: { actor: Actor; input: z.infer<S> }) => PolicyResource | Promise<PolicyResource>;
  handler: (ctx: ActionContext<S>) => Promise<T>;
};

type ActionDeps = { getActor: () => Promise<Actor | null> };

const MESSAGES = {
  unauthenticated: "Oturum gerekli",
  forbidden: "Bu işlem için yetkiniz yok",
  invalid: "Girdi geçersiz",
  uniqueViolation: "Kayıt zaten mevcut",
  foreignKeyViolation: "Kayıt başka kayıtlarca kullanılıyor",
  unexpected: "Beklenmeyen bir hata oluştu",
} as const;

function fail(
  code: ActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return fieldErrors ? { ok: false, code, message, fieldErrors } : { ok: false, code, message };
}

function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_root";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

function toFailure(scope: string, error: unknown): ActionResult<never> {
  // ForbiddenError, sayfalar için Next'in 403 özetini taşır; eylemde sonuç olarak döner, yeniden fırlatılmaz.
  if (error instanceof ForbiddenError) return fail("forbidden", MESSAGES.forbidden);

  // redirect() / notFound() gibi Next iç akış hataları yutulmaz.
  unstable_rethrow(error);

  if (error instanceof DomainError) return fail(error.code, error.message);
  if (error instanceof UnauthenticatedError) return fail("unauthenticated", MESSAGES.unauthenticated);

  const pgCode = pgCodeOf(error);
  if (pgCode === "23505") return fail("conflict", MESSAGES.uniqueViolation);
  if (pgCode === "23503") return fail("conflict", MESSAGES.foreignKeyViolation);

  logError(scope, error);
  return fail("error", MESSAGES.unexpected);
}

/**
 * Sunucu eylemi oluşturucusu. Sıra: oturum (üyelik + izin satırlarıyla) → `authorize(module, verb)` →
 * Zod doğrulaması → handler. Bağımlılıklar enjekte edilir; böylece Next istek kapsamı
 * olmadan test edilebilir.
 */
export function createAction(deps: ActionDeps) {
  function defineAction<S extends z.ZodType, T>(
    opts: ActionOptions<S, T>,
  ): (raw: unknown) => Promise<ActionResult<T>> {
    const scope = `action:${opts.module}.${opts.verb}`;

    return async (raw: unknown): Promise<ActionResult<T>> => {
      try {
        const actor = await deps.getActor();
        if (!actor) return fail("unauthenticated", MESSAGES.unauthenticated);

        if (!opts.resource) authorize(actor, opts.module, opts.verb);

        const parsed = opts.input.safeParse(raw);
        if (!parsed.success) return fail("invalid", MESSAGES.invalid, fieldErrorsOf(parsed.error));
        if (opts.resource) {
          authorize(actor, opts.module, opts.verb, await opts.resource({ actor, input: parsed.data }));
        }

        const data = await opts.handler({ actor, input: parsed.data, db });
        return { ok: true, data };
      } catch (error) {
        return toFailure(scope, error);
      }
    };
  }

  return { defineAction };
}

/** Gerçek oturuma bağlı `defineAction`; tüm özellik modülleri bunu kullanır. */
export const { defineAction } = createAction({ getActor });
