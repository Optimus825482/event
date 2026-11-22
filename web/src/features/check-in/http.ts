import { z } from "zod";
import { env } from "@/env";
import { loadPermissions } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { getActorFromHeaders } from "@/features/auth/session";
import { createAction, type ActionResult } from "@/lib/action";
import { checkInActionDefs } from "./action-defs";
import { CHECK_IN_BATCH_MAX } from "./schemas";
import type { CheckInSuccess } from "./internal";

export type CheckInItemResult = {
  idempotencyKey: string | null;
  result: ActionResult<CheckInSuccess>;
};

const NO_STORE = { "cache-control": "no-store" } as const;

function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

function failure(status: number, code: "unauthenticated" | "forbidden" | "invalid", message: string): Response {
  return json(status, { ok: false, code, message });
}

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/**
 * Bu uygulamada CSRF belirteci yok. Savunma: (1) yalnızca `application/json` (çapraz kaynaklı bir
 * tarayıcı isteği bu başlıkla CORS ön uçuşu gerektirir ve sunucu CORS izni vermez); (2) tarayıcı
 * `Sec-Fetch-Site` gönderiyorsa `same-origin` olmalı; (3) `Origin` gönderiyorsa sunucunun kendi
 * adresi (Host / X-Forwarded-Host / BETTER_AUTH_URL) olmalı. Başlıksız istemciler (tarayıcı dışı)
 * oturum çerezine zaten sahip olmak zorundadır.
 */
function sameOriginProblem(request: Request): string | null {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return "İstek bu uygulamadan gelmiyor";
  const origin = request.headers.get("origin");
  if (origin === null) return null;
  const originHost = hostOf(origin);
  const allowed = new Set(
    [
      request.headers.get("host"),
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim(),
      hostOf(request.url),
      hostOf(env.BETTER_AUTH_URL),
    ].filter((h): h is string => Boolean(h)),
  );
  return originHost !== null && allowed.has(originHost) ? null : "İstek bu uygulamadan gelmiyor";
}

const batchSchema = z.object({
  items: z
    .array(z.unknown())
    .min(1, "En az bir öğe gerekli")
    .max(CHECK_IN_BATCH_MAX, `En fazla ${CHECK_IN_BATCH_MAX} öğe gönderilebilir`),
});
const singleSchema = z.record(z.string(), z.unknown());

function keyOf(item: unknown): string | null {
  if (typeof item !== "object" || item === null || !("idempotencyKey" in item)) return null;
  const parsed = z.uuid().safeParse(item.idempotencyKey);
  return parsed.success ? parsed.data : null;
}

/**
 * `POST /api/check-in` — çevrimdışı kuyruğun eşitleme ucu. Tek öğe gövdesi `checkInAction` ile aynı
 * `ActionResult`'ı döndürür; `{ items: [...] }` (en çok 50) her öğeyi bağımsız işler ve sırayla
 * `{ results: [{ idempotencyKey, result }] }` döndürür. İş kuralı sonuçları (conflict vb.) 200 ile
 * öğe sonucunda taşınır; HTTP hata kodları yalnızca isteğin bütünü içindir:
 * 415 JSON değil, 403 başka kaynak, 401 oturum yok, 403 `check_in:create` yok, 400 bozuk gövde.
 */
export async function handleCheckInPost(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(;|$)/i.test(contentType)) {
    return json(415, {
      ok: false,
      code: "invalid",
      message: "İçerik türü application/json olmalıdır",
    });
  }
  const originProblem = sameOriginProblem(request);
  if (originProblem) return failure(403, "forbidden", originProblem);

  const actor = await getActorFromHeaders(request.headers);
  if (!actor) return failure(401, "unauthenticated", "Oturum gerekli");
  const permissions = await loadPermissions(actor.id);
  if (!can({ ...actor, permissions }, "check_in", "create")) {
    return failure(403, "forbidden", "Bu işlem için yetkiniz yok");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return failure(400, "invalid", "Gövde geçerli JSON değil");
  }
  const single = singleSchema.safeParse(raw);
  if (!single.success) return failure(400, "invalid", "Girdi geçersiz");

  // Action ile aynı hat: oturum → izin satırları → authorize → Zod → servis (her öğe için).
  const { defineAction } = createAction({ getActor: async () => actor });
  const run = defineAction(checkInActionDefs.checkIn);

  if (!("items" in single.data)) return json(200, await run(single.data));
  const batch = batchSchema.safeParse(single.data);
  if (!batch.success) return failure(400, "invalid", batch.error.issues[0]?.message ?? "Girdi geçersiz");

  const results: CheckInItemResult[] = [];
  // Sırayla: her öğe kendi transaction'ında; bağlantı havuzunu tek istek tüketmez.
  for (const item of batch.data.items) results.push({ idempotencyKey: keyOf(item), result: await run(item) });
  return json(200, { results });
}
