import { getCore } from "@/lib/core/client";
import { CoreError } from "@/lib/core/errors";

/** Görsel vekil rotası: çekirdekten yükleme yolunu kendi kökenimizden sunar. */
export const dynamic = "force-dynamic";

function notFoundResponse(): Response {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; file: string }> },
): Promise<Response> {
  const { kind, file } = await params;
  try {
    const { body, contentType } = await getCore().getImage(`${kind}/${file}`);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof CoreError) return notFoundResponse();
    throw error;
  }
}
