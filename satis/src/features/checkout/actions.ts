"use server";

import { headers } from "next/headers";
import { clientIp } from "@/lib/client-ip";
import { getCore } from "@/lib/core/client";
import { env } from "@/lib/env";
import { holdFlow } from "./flows";
import type { ActionResult } from "./result";

/** Tarayıcıdan çağrılan tek yazma yolu; sır ve çekirdek adresi sunucuda kalır. */
export async function holdAction(input: {
  eventId: string;
  tableId: string;
  quantity: number;
  clientKey: string;
}): Promise<ActionResult<{ orderToken: string }>> {
  const ctx = { clientIp: clientIp(await headers(), env.TRUSTED_IP_HEADER) };
  return holdFlow(getCore(), input, ctx);
}
