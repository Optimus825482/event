import { readFile } from "node:fs/promises";
import path from "node:path";
import { mediaResponse, uploadContentType } from "./range";

/** `.webp`: tüm görseller (`saveImage`); `.webm`: yalnızca hero videosu (`saveVideo`). */
const EXTENSIONS = [".webp", ".webm"] as const;
const FORBIDDEN_IN_SEGMENT = /[/\\\0:]/;

/**
 * URL/yol parçalarını `root` altındaki mutlak dosya yoluna çevirir. Kök dışına
 * çıkabilecek, `.webp`/`.webm` ile bitmeyen ya da şüpheli karakter içeren her girdi için `null` döner.
 */
export function resolveUploadPath(root: string, segments: readonly string[]): string | null {
  if (segments.length === 0) return null;
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === ".." || FORBIDDEN_IN_SEGMENT.test(segment)) return null;
  }
  const last = segments[segments.length - 1] ?? "";
  if (!EXTENSIONS.some((ext) => last.endsWith(ext))) return null;

  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(absoluteRoot, ...segments);
  if (!resolved.startsWith(absoluteRoot + path.sep)) return null;
  return resolved;
}

function notFound(): Response {
  return new Response("Bulunamadı", { status: 404, headers: { "X-Content-Type-Options": "nosniff" } });
}

/**
 * Yetki denetimi çağırana aittir (bkz. `app/api/uploads`). Yalnızca `.webp` ve `.webm` dosyaları sunulur;
 * `headers` içindeki `Range` (video oynatma) desteklenir.
 */
export async function serveUpload(
  root: string,
  segments: readonly string[],
  headers?: Headers,
): Promise<Response> {
  const file = resolveUploadPath(root, segments);
  if (!file) return notFound();
  try {
    const data = await readFile(/* turbopackIgnore: true */ file);
    return mediaResponse(data, {
      contentType: uploadContentType(file),
      cacheControl: "private, max-age=86400",
      range: headers?.get("range") ?? null,
    });
  } catch {
    // Yok, dizin ya da okunamıyor: ayrıntı sızdırmadan 404.
    return notFound();
  }
}
