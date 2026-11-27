export type ByteRange = { start: number; end: number };

const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/;

/**
 * Tek aralıklı `Range: bytes=…` başlığını çözer (RFC 9110 §14.1.2). Başlık yoksa, biçimi bozuksa ya da
 * birden çok aralık istiyorsa `null` döner (tam yanıt verilir); aralık dosyanın dışındaysa `"unsatisfiable"`.
 */
export function parseByteRange(header: string | null, size: number): ByteRange | "unsatisfiable" | null {
  if (!header) return null;
  const match = SINGLE_RANGE.exec(header.trim());
  if (!match) return null;
  const [, first = "", last = ""] = match;
  if (first === "" && last === "") return null;

  if (first === "") {
    const suffix = Number(last);
    if (suffix === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(first);
  const end = last === "" ? size - 1 : Number(last);
  if (last !== "" && end < start) return null;
  if (start >= size) return "unsatisfiable";
  return { start, end: Math.min(end, size - 1) };
}

const CONTENT_TYPES: Record<string, string> = { ".webp": "image/webp", ".webm": "video/webm" };

/** Yükleme yolunun uzantısından yanıt türü; bilinmeyen uzantıda `application/octet-stream`. */
export function uploadContentType(relativePath: string): string {
  const dot = relativePath.lastIndexOf(".");
  return (dot >= 0 && CONTENT_TYPES[relativePath.slice(dot)]) || "application/octet-stream";
}

/**
 * Bellekteki dosyayı sunar; `range` başlığı varsa 206 ile dilimini, karşılanamıyorsa 416 döner.
 * Tarayıcılar (özellikle Safari) videoyu oynatmak için bayt aralığı ister.
 */
export function mediaResponse(
  data: Uint8Array,
  o: { contentType: string; cacheControl: string; range: string | null },
): Response {
  const base = {
    "Content-Type": o.contentType,
    "Cache-Control": o.cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };
  const range = parseByteRange(o.range, data.length);
  if (range === "unsatisfiable") {
    return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${data.length}` } });
  }
  if (range === null) {
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: { ...base, "Content-Length": String(data.length) },
    });
  }
  const slice = data.slice(range.start, range.end + 1);
  return new Response(new Uint8Array(slice), {
    status: 206,
    headers: {
      ...base,
      "Content-Length": String(slice.length),
      "Content-Range": `bytes ${range.start}-${range.end}/${data.length}`,
    },
  });
}
