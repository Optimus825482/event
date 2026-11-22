import { getActorFromHeaders } from "@/features/auth/session";
import { UPLOAD_ROOT } from "@/features/uploads/root";
import { serveUpload } from "@/features/uploads/serve";

type RouteContext = { params: Promise<{ path: string[] }> };

/** Yüklenen görüntüleri yalnızca oturumu olan (etkin) kullanıcılara sunar. */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const actor = await getActorFromHeaders(request.headers);
  if (!actor) {
    return new Response("Oturum gerekli", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const { path: segments } = await context.params;
  return serveUpload(UPLOAD_ROOT, segments);
}
