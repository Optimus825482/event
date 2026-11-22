import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { db, type Db } from "@/db/client";
import { ForbiddenError, UnauthenticatedError } from "@/features/auth/errors";
import { getActor, type Actor } from "@/features/auth/session";
import { DomainError, type ActionErrorCode, type ActionResult } from "@/lib/action";
import { logError } from "@/lib/log";

/**
 * Her giriş yapmış kullanıcının kendi hesabı üzerindeki eylemleri (profil fotoğrafı gibi).
 * `defineAction` her zaman bir modül iznini (`authorize(module, verb)`) ister; tüm rollerde ortak bir
 * modül olmadığından bu küçük sarmalayıcı aynı sırayı izler: oturum → Zod → handler. Yetki sınırı
 * handler'daki servistedir (yalnızca `actor.id` satırı). Hata sonuçları `ActionResult` ile aynıdır.
 */
export type SelfActionOptions<S extends z.ZodType, T> = {
  scope: string;
  input: S;
  handler: (ctx: { actor: Actor; input: z.infer<S>; db: Db }) => Promise<T>;
};

/** Seçenekleri tür çıkarımıyla tanımlar (`action-defs.ts`). */
export function selfDef<S extends z.ZodType, T>(options: SelfActionOptions<S, T>): SelfActionOptions<S, T> {
  return options;
}

type Deps = { getActor: () => Promise<Actor | null> };

function fail(code: ActionErrorCode, message: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return fieldErrors ? { ok: false, code, message, fieldErrors } : { ok: false, code, message };
}

function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_root";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export function createSelfAction(deps: Deps) {
  return function defineSelfAction<S extends z.ZodType, T>(
    opts: SelfActionOptions<S, T>,
  ): (raw: unknown) => Promise<ActionResult<T>> {
    return async (raw) => {
      try {
        const actor = await deps.getActor();
        if (!actor) return fail("unauthenticated", "Oturum gerekli");
        const parsed = opts.input.safeParse(raw);
        if (!parsed.success) return fail("invalid", "Girdi geçersiz", fieldErrorsOf(parsed.error));
        return { ok: true, data: await opts.handler({ actor, input: parsed.data, db }) };
      } catch (error) {
        if (error instanceof ForbiddenError) return fail("forbidden", "Bu işlem için yetkiniz yok");
        unstable_rethrow(error);
        if (error instanceof DomainError) return fail(error.code, error.message);
        if (error instanceof UnauthenticatedError) return fail("unauthenticated", "Oturum gerekli");
        logError(`action:self.${opts.scope}`, error);
        return fail("error", "Beklenmeyen bir hata oluştu");
      }
    };
  };
}

export const defineSelfAction = createSelfAction({ getActor });
