import { NextResponse } from "next/server";
import { APP_BUILD } from "@/lib/app-build";

export const dynamic = "force-dynamic";

/** Çalışan sunucunun güncelleme numarası; açık sekmeler kendi numarasıyla karşılaştırır. Oturum gerektirir (proxy). */
export function GET() {
  return NextResponse.json({ build: APP_BUILD }, { headers: { "Cache-Control": "no-store" } });
}
