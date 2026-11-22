import { DomainError } from "@/lib/action";

/**
 * Başlık eşleme: büyük/küçük harf, aksan (ç ş ğ ü ö ı), boşluk ve noktalama fark etmez.
 * "Masa Etiketi", "masa_etiketi" ve "MASA  ETİKETİ" aynı başlıktır.
 */
export function normalizeHeader(raw: string): string {
  return raw
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]/g, "");
}

/** Etiket/ad karşılaştırması için: küçük harf (tr), boşluklar tek, kenarlar kırpılı. */
export function normalizeKey(raw: string): string {
  return raw.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
}

export type ColumnSpec<K extends string> = {
  key: K;
  /** Şablonda ve hata mesajında görünen başlık. */
  label: string;
  aliases: readonly string[];
  required?: boolean;
};

export type HeaderRequirements<K extends string> = {
  specs: readonly ColumnSpec<K>[];
  /** Her grup için en az biri bulunmalı (örn. sicil no VEYA personel adı). */
  anyOf?: readonly (readonly K[])[];
};

function expectedList<K extends string>(req: HeaderRequirements<K>): string {
  const anyOfKeys = new Set((req.anyOf ?? []).flat());
  const parts = req.specs.map((s) => {
    if (s.required) return `${s.label} (zorunlu)`;
    if (anyOfKeys.has(s.key)) return `${s.label} (gruptan en az biri zorunlu)`;
    return s.label;
  });
  return parts.join(", ");
}

/**
 * Başlık satırını sütun dizinlerine eşler. Aynı alana düşen ilk sütun kazanır; tanınmayan sütunlar
 * yok sayılır. Zorunlu başlık yoksa beklenen başlıkları sayan `invalid` hatası fırlatır.
 */
export function mapHeaders<K extends string>(
  headers: readonly string[],
  req: HeaderRequirements<K>,
): Map<K, number> {
  const lookup = new Map<string, K>();
  for (const spec of req.specs) {
    lookup.set(normalizeHeader(spec.label), spec.key);
    for (const alias of spec.aliases) lookup.set(normalizeHeader(alias), spec.key);
  }
  const mapping = new Map<K, number>();
  headers.forEach((header, index) => {
    const key = lookup.get(normalizeHeader(header));
    if (key !== undefined && !mapping.has(key)) mapping.set(key, index);
  });

  const labelOf = (key: K) => req.specs.find((s) => s.key === key)?.label ?? key;
  const missing: string[] = req.specs.filter((s) => s.required && !mapping.has(s.key)).map((s) => s.label);
  for (const group of req.anyOf ?? []) {
    if (!group.some((key) => mapping.has(key))) missing.push(group.map(labelOf).join(" veya "));
  }
  if (missing.length > 0) {
    throw new DomainError(
      "invalid",
      `Eksik başlık: ${missing.join("; ")}. Beklenen başlıklar: ${expectedList(req)}.`,
    );
  }
  return mapping;
}
