import { parseByteRange } from "@/lib/byte-range";
import { getCore } from "@/lib/core/client";
import { CoreError } from "@/lib/core/errors";

/**
 * Görsel vekil rotası: çekirdekten yükleme yolunu kendi kökenimizden sunar. Hero WebM videosu için
 * `Range` isteği desteklenir (Safari videoyu bayt aralığıyla oynatır).
 */
export const dynamic = "force-dynamic";

function notFoundResponse(): Response {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; file: string }> },
): Promise<Response> {
  const { kind, file } = await params;
  try {
    const { body, contentType } = await getCore().getImage(`${kind}/${file}`);
    const headers = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
    };
    const size = body.byteLength;
    const range = parseByteRange(request.headers.get("range"), size);
    if (range === "unsatisfiable") {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    if (range === null) {
      return new Response(body, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
    }
    const slice = body.slice(range.start, range.end + 1);
    return new Response(slice, {
      status: 206,
      headers: {
        ...headers,
        "Content-Length": String(slice.byteLength),
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
      },
    });
  } catch (error) {
    if (error instanceof CoreError) return notFoundResponse();
    throw error;
  }
}
