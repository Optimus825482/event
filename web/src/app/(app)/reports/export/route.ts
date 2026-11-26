import { db } from "@/db/client";
import { XLSX_CONTENT_TYPE } from "@/features/archive/xlsx";
import { getActor } from "@/features/auth/session";
import { exportPeriodReport } from "@/features/reports/export";

/** Dönem raporunu Excel olarak indirir (salt okunur; izin `archive:view`). */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const result = await exportPeriodReport(db, await getActor(), { from: query.get("from"), to: query.get("to") });
  if (!result.ok) return Response.json({ message: result.message }, { status: result.status });
  return new Response(new Uint8Array(result.bytes), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
