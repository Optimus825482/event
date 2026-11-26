import { db } from "@/db/client";
import { exportArchive } from "@/features/archive/export";
import { XLSX_CONTENT_TYPE } from "@/features/archive/xlsx";
import { getActor } from "@/features/auth/session";

type Params = Promise<{ eventId: string }>;

/** Arşiv kaydını Excel olarak indirir (salt okunur; izin `archive:view`). */
export async function GET(_request: Request, { params }: { params: Params }) {
  const { eventId } = await params;
  const result = await exportArchive(db, await getActor(), eventId);
  if (!result.ok) return Response.json({ message: result.message }, { status: result.status });
  return new Response(new Uint8Array(result.bytes), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
