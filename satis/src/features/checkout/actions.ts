"use server";

import { headers } from "next/headers";
import { clientIp } from "@/lib/client-ip";
import { getCore } from "@/lib/core/client";
import { messageFor } from "@/lib/core/errors";
import { env } from "@/lib/env";
import { holdFlow, payFlow, releaseFlow } from "./flows";
import type { ActionResult } from "./result";
import { isOrderTokenShape } from "./token";

async function writeContext() {
  return { clientIp: clientIp(await headers(), env.TRUSTED_IP_HEADER) };
}

const notFound = { ok: false, code: "order_not_found", message: messageFor({ code: "order_not_found" }) } as const;

/** Tarayıcıdan çağrılan tek yazma yolu; sır ve çekirdek adresi sunucuda kalır. */
export async function holdAction(input: {
  eventId: string;
  tableId: string;
  quantity: number;
  clientKey: string;
}): Promise<ActionResult<{ orderToken: string }>> {
  return holdFlow(getCore(), input, await writeContext());
}

/** Demo ödeme; gövde yalnızca alıcı bilgisi ve `approve`/`decline` taşır, kart alanı yoktur. */
export async function payAction(
  orderToken: string,
  action: "approve" | "decline",
  form: { firstName: string; lastName: string; email: string; phone: string; acceptTerms: boolean },
): Promise<ActionResult<{ status: "paid" }>> {
  if (!isOrderTokenShape(orderToken)) return notFound;
  return payFlow(getCore(), orderToken, form, action === "decline" ? "decline" : "approve", await writeContext());
}

/** "Vazgeç": tutmayı bırakır. */
export async function releaseAction(orderToken: string): Promise<ActionResult<null>> {
  if (!isOrderTokenShape(orderToken)) return notFound;
  return releaseFlow(getCore(), orderToken, await writeContext());
}
