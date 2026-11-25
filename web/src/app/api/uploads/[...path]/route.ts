import { getActorFromHeaders } from "@/features/auth/session";
import { checkUploadAccess } from "@/features/uploads/access";
import { UPLOAD_ROOT } from "@/features/uploads/root";
import { serveUpload } from "@/features/uploads/serve";

type RouteContext = { params: Promise<{ path: string[] }> };

function denied(status: 401 | 403 | 404, body: string): Response {
  return new Response(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

/**
 * Yüklenen görüntüleri oturumlu kullanıcılara kategoriye göre sunar (bkz. `checkUploadAccess`).
 * Herkese açık davetiye görselleri yalnızca `/i/<belirteç>/image` yolundan okunur.
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const actor = await getActorFromHeaders(request.headers);
  if (!actor) return denied(401, "Oturum gerekli");
  const { path: segments } = await context.params;
  const access = checkUploadAccess(actor, segments);
  if (access === "forbidden") return denied(403, "Bu dosyaya erişim yetkiniz yok");
  if (access === "not_found") return denied(404, "Bulunamadı");
  return serveUpload(UPLOAD_ROOT, segments);
}
