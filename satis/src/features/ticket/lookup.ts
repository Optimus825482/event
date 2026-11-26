import { z } from "zod";
import { failure, type ActionResult } from "@/features/checkout/result";
import type { CoreClient, WriteContext } from "@/lib/core/client";
import { messageFor } from "@/lib/core/errors";

/** PNR bilinmiyor da olsa soyad yanlış da olsa kullanıcı aynı mesajı görür. */
export const LOOKUP_FAILED = "PNR ya da soyad hatalı.";

export const lookupSchema = z.strictObject({
  pnr: z.string().trim().min(1, "PNR gerekli").max(20, "PNR çok uzun"),
  lastName: z.string().trim().min(1, "Soyad gerekli").max(100, "Soyad en fazla 100 karakter olabilir"),
});

/** "Biletimi bul": girdi doğrulanır (geçersizse çekirdeğe gidilmez); PNR tek başına yetmez, soyad ikinci etkendir. */
export async function lookupFlow(
  core: Pick<CoreClient, "lookupOrder">,
  raw: unknown,
  ctx: WriteContext,
): Promise<ActionResult<{ orderToken: string }>> {
  const parsed = lookupSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = typeof issue.path[0] === "string" ? issue.path[0] : "form";
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, code: "invalid", message: messageFor({ code: "invalid" }), fieldErrors };
  }
  try {
    const found = await core.lookupOrder({ pnr: parsed.data.pnr, lastName: parsed.data.lastName }, ctx);
    return { ok: true, data: { orderToken: found.orderToken } };
  } catch (error) {
    const result = failure(error);
    return result.code === "order_not_found" ? { ...result, message: LOOKUP_FAILED } : result;
  }
}
