const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/;

export type ByteRange = { start: number; end: number };

/**
 * Tek aralıklı `Range: bytes=…` başlığını çözer. Başlık yoksa, bozuksa ya da çok aralıklıysa `null`
 * (tam yanıt); aralık dosyanın dışındaysa `"unsatisfiable"`.
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
