/**
 * Güncelleme numarası: imaj derlenirken (`Dockerfile`) derleme anından üretilir, ör. `2026.11.23-2105` (Türkiye
 * saati); her yeni derlemede kendiliğinden değişir. Yerel geliştirmede `null`; o zaman sürüm ne gösterilir ne de
 * karşılaştırılır.
 *
 * `NEXT_PUBLIC_` olduğu için hem tarayıcı paketine hem sunucu koduna aynı değer girer: açık sekmedeki paket
 * eski numarayı taşırken yeni dağıtılan sunucu yenisini bildirir; fark "sistem güncellendi" demektir.
 */
export const APP_BUILD: string | null = normalizeBuild(process.env.NEXT_PUBLIC_APP_BUILD);

export function normalizeBuild(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return /^[0-9A-Za-z._-]{1,32}$/.test(text) ? text : null;
}

/** Kullanıcıya gösterilen biçim: tarihli numara olduğu gibi (`2026.11.23-2105`), düz sıra numarası `#128`. */
export function buildLabel(build: string): string {
  return /^\d+$/.test(build) ? `#${build}` : build;
}
