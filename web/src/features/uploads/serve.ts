import { readFile } from "node:fs/promises";
import path from "node:path";

const EXTENSION = ".webp";
const FORBIDDEN_IN_SEGMENT = /[/\\\0:]/;

/**
 * URL/yol parçalarını `root` altındaki mutlak dosya yoluna çevirir. Kök dışına
 * çıkabilecek, `.webp` ile bitmeyen ya da şüpheli karakter içeren her girdi için `null` döner.
 */
export function resolveUploadPath(root: string, segments: readonly string[]): string | null {
  if (segments.length === 0) return null;
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === ".." || FORBIDDEN_IN_SEGMENT.test(segment)) return null;
  }
  if (!segments[segments.length - 1]?.endsWith(EXTENSION)) return null;

  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(absoluteRoot, ...segments);
  if (!resolved.startsWith(absoluteRoot + path.sep)) return null;
  return resolved;
}

function notFound(): Response {
  return new Response("Bulunamadı", { status: 404, headers: { "X-Content-Type-Options": "nosniff" } });
}

/** Yetki denetimi çağırana aittir (bkz. `app/api/uploads`). Yalnızca `.webp` dosyaları sunulur. */
export async function serveUpload(root: string, segments: readonly string[]): Promise<Response> {
  const file = resolveUploadPath(root, segments);
  if (!file) return notFound();
  try {
    const data = await readFile(/* turbopackIgnore: true */ file);
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(data.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    // Yok, dizin ya da okunamıyor: ayrıntı sızdırmadan 404.
    return notFound();
  }
}
