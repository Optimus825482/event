import type { CoreClient, WriteContext } from "@/lib/core/client";
import { CoreError, messageFor } from "@/lib/core/errors";
import { failure, type ActionResult } from "./result";
import { buyerSchema, holdInputSchema } from "./schemas";

/** Masa tutma: girdi doğrulanır (geçersizse çekirdeğe gidilmez), tek kalemli sipariş açılır. */
export async function holdFlow(
  core: Pick<CoreClient, "createHold">,
  raw: unknown,
  ctx: WriteContext,
): Promise<ActionResult<{ orderToken: string }>> {
  const parsed = holdInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid", message: messageFor({ code: "invalid" }) };
  const { eventId, tableId, quantity, clientKey } = parsed.data;
  try {
    const order = await core.createHold({ eventId, items: [{ tableId, quantity }], clientKey }, ctx);
    return { ok: true, data: { orderToken: order.orderToken } };
  } catch (error) {
    return failure(error);
  }
}

const BUYER_FIELD_MESSAGES: Record<string, string> = {
  firstName: "Ad gerekli",
  lastName: "Soyad gerekli",
  email: "Geçerli bir e-posta girin",
  phone: "Telefon geçersiz",
  acceptTerms: "Devam etmek için metinleri onaylamalısınız",
};

/** Çekirdeğin `invalid` yanıtındaki `details.fieldErrors` anahtarları (`buyer.email` ya da `email`) alan adlarına eşlenir. */
function coreFieldErrors(error: unknown): Record<string, string> | undefined {
  if (!(error instanceof CoreError) || error.code !== "invalid") return undefined;
  const raw = error.details?.fieldErrors;
  if (typeof raw !== "object" || raw === null) return undefined;
  const mapped: Record<string, string> = {};
  for (const key of Object.keys(raw)) {
    const field = key.startsWith("buyer.") ? key.slice("buyer.".length) : key;
    const message = BUYER_FIELD_MESSAGES[field];
    if (message !== undefined) mapped[field] = message;
  }
  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

/** Demo ödeme: alıcı bilgisi doğrulanır (geçersizse çekirdeğe gidilmez); gövde yalnızca `{ provider: "demo", action }` taşır. */
export async function payFlow(
  core: Pick<CoreClient, "payOrder">,
  orderToken: string,
  raw: unknown,
  action: "approve" | "decline",
  ctx: WriteContext,
): Promise<ActionResult<{ status: "paid" }>> {
  const parsed = buyerSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = typeof issue.path[0] === "string" ? issue.path[0] : "form";
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, code: "invalid", message: messageFor({ code: "invalid" }), fieldErrors };
  }
  const { firstName, lastName, email, phone } = parsed.data;
  try {
    await core.payOrder(
      orderToken,
      {
        buyer: { firstName, lastName, email, ...(phone === undefined ? {} : { phone }) },
        acceptTerms: true,
        payment: { provider: "demo", action },
      },
      ctx,
    );
    return { ok: true, data: { status: "paid" } };
  } catch (error) {
    const fieldErrors = coreFieldErrors(error);
    return { ...failure(error), ...(fieldErrors ? { fieldErrors } : {}) };
  }
}

/** Tutmayı bırakır; sandalyeler hemen serbest kalır. */
export async function releaseFlow(
  core: Pick<CoreClient, "releaseOrder">,
  orderToken: string,
  ctx: WriteContext,
): Promise<ActionResult<null>> {
  try {
    await core.releaseOrder(orderToken, ctx);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}
