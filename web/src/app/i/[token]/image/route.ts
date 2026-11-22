import { db } from "@/db/client";
import { getPublicInvitationImagePath } from "@/features/invitations/public";
import { UPLOAD_ROOT } from "@/features/uploads/root";
import { serveUpload } from "@/features/uploads/serve";

type RouteContext = { params: Promise<{ token: string }> };

function notFound(): Response {
  return new Response("Bulunamadı", { status: 404, headers: { "X-Content-Type-Options": "nosniff" } });
}

/**
 * Herkese açık davetiye görselleri. Oturum gerekmez; erişim imzalı belirteçle sınırlıdır ve
 * yalnızca o etkinliğin davetiyesinde gösterilen yükleme yolları sunulur (`?p=<yol>`).
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { token } = await context.params;
  const requested = new URL(request.url).searchParams.get("p");
  if (!requested) return notFound();

  const allowed = await getPublicInvitationImagePath(db, token, requested);
  if (!allowed) return notFound();
  return serveUpload(UPLOAD_ROOT, allowed.split("/"));
}
