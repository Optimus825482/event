import type { CoreClient, WriteContext } from "@/lib/core/client";
import { messageFor } from "@/lib/core/errors";
import { failure, type ActionResult } from "./result";
import { holdInputSchema } from "./schemas";

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
