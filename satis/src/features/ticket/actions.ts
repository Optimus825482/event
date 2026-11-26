"use server";

import { headers } from "next/headers";
import type { ActionResult } from "@/features/checkout/result";
import { clientIp } from "@/lib/client-ip";
import { getCore } from "@/lib/core/client";
import { env } from "@/lib/env";
import { lookupFlow } from "./lookup";

/** "Biletimi bul": PNR + soyad; başarıda yalnızca sipariş belirteci döner. */
export async function lookupAction(form: { pnr: string; lastName: string }): Promise<ActionResult<{ orderToken: string }>> {
  return lookupFlow(getCore(), form, { clientIp: clientIp(await headers(), env.TRUSTED_IP_HEADER) });
}
