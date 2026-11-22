import { createHash } from "node:crypto";

/**
 * Eski satırlardan güvenli değer okuma yardımcıları. Eski okuyucu (`legacy.ts`) satırları
 * `Record<string, unknown>` olarak döndürür; burada türe dönüştürülür. Zaman damgaları okuma
 * sırasında PostgreSQL'de `AT TIME ZONE` ile `timestamptz`'ye çevrildiği için `Date` gelir;
 * `date` sütunları ham `YYYY-MM-DD` metnidir.
 */

export type RawRow = Readonly<Record<string, unknown>>;

export class Row {
  constructor(readonly raw: RawRow) {}

  has(key: string): boolean {
    return key in this.raw;
  }

  /** Metin; NULL/boş değilse kırpılmamış hali. */
  str(key: string): string | null {
    const v = this.raw[key];
    if (v === null || v === undefined) return null;
    return typeof v === "string" ? v : String(v);
  }

  /** NOT NULL metin; yoksa `fallback`. */
  text(key: string, fallback = ""): string {
    return this.str(key) ?? fallback;
  }

  /** Kırpılmış, boşsa NULL. */
  trimmed(key: string): string | null {
    const v = this.str(key);
    if (v === null) return null;
    const t = v.trim();
    return t === "" ? null : t;
  }

  int(key: string): number | null {
    const v = this.raw[key];
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Math.trunc(Number(v));
    return null;
  }

  num(key: string): number | null {
    const v = this.raw[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
    return null;
  }

  bool(key: string, fallback: boolean): boolean {
    const v = this.raw[key];
    return typeof v === "boolean" ? v : fallback;
  }

  date(key: string): Date | null {
    const v = this.raw[key];
    return v instanceof Date && !Number.isNaN(v.getTime()) ? v : null;
  }

  /** `text[]` sütunu: yalnızca metin öğeler. */
  strings(key: string): string[] {
    const v = this.raw[key];
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string");
  }

  json(key: string): unknown {
    return this.raw[key] ?? null;
  }

  get id(): string {
    return this.text("id");
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Geçerli uuid ise küçük harfli hali, değilse NULL. */
export function asUuid(value: string | null): string | null {
  return value !== null && isUuid(value.trim()) ? value.trim().toLowerCase() : null;
}

// Sabit ad alanı: taşıma tarafından üretilen kimlikler (RFC 4122 v5) her çalıştırmada aynıdır.
const NAMESPACE = Buffer.from("6f1c2a8e4b7d4e0f9a3c5d2e1b0a9c8d", "hex");

/** Eski kaynaktan türetilen deterministik uuid (v5): aynı girdi her çalıştırmada aynı kimliği verir. */
export function stableId(...parts: string[]): string {
  const hash = createHash("sha1").update(NAMESPACE).update(parts.join("\u001f"), "utf8").digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

/**
 * Eski `varchar` saat ("9:00", "21:30", "21:30:00") → `time` metni ("HH:MM:SS").
 * Boş → NULL (`ok: true`); tanınmayan biçim → NULL (`ok: false`, raporlanır).
 */
export function toTime(raw: string | null): { value: string | null; ok: boolean } {
  if (raw === null || raw.trim() === "") return { value: null, ok: true };
  const m = TIME_RE.exec(raw.trim());
  if (!m) return { value: null, ok: false };
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = Number(m[3] ?? "0");
  if (h === 24 && min === 0 && s === 0) return { value: "24:00:00", ok: true };
  if (h > 23 || min > 59 || s > 59) return { value: null, ok: false };
  const pad = (n: number) => String(n).padStart(2, "0");
  return { value: `${pad(h)}:${pad(min)}:${pad(s)}`, ok: true };
}

/** Tam sayı aralığa sıkıştırılır; değişti mi bilgisiyle. */
export function clampInt(value: number, min: number, max: number): { value: number; changed: boolean } {
  const v = Math.min(max, Math.max(min, Math.round(value)));
  return { value: v, changed: v !== value };
}

/** Benzersiz etiket üretir: `taken` kümesinde (normalize edilmiş) yoksa olduğu gibi, varsa " (2)" eki. */
export function uniqueName(base: string, taken: Set<string>, normalize: (s: string) => string, maxLength?: number): string {
  const cut = (s: string) => (maxLength === undefined ? s : s.slice(0, maxLength));
  let candidate = cut(base);
  for (let n = 2; taken.has(normalize(candidate)); n += 1) {
    const suffix = ` (${n})`;
    candidate = maxLength === undefined ? `${base}${suffix}` : `${base.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`;
  }
  taken.add(normalize(candidate));
  return candidate;
}

export function byCreatedThenId(a: Row, b: Row): number {
  const ta = a.date("createdAt")?.getTime() ?? a.date("created_at")?.getTime() ?? 0;
  const tb = b.date("createdAt")?.getTime() ?? b.date("created_at")?.getTime() ?? 0;
  return ta - tb || a.id.localeCompare(b.id);
}
