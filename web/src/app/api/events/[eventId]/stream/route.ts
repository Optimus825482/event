import { openEventStream } from "@/features/realtime/stream";

// Uzun ömürlü akış: önbelleğe alınmaz, Node çalışma zamanında (pg LISTEN) çalışır.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ eventId: string }> };

/** Etkinliğin canlı güncelleme akışı (Server-Sent Events). */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { eventId } = await context.params;
  return openEventStream(request, eventId);
}
