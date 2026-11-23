/**
 * Güncelleme sıra numarası: imaj derlemesinde (`build-and-push.yml`, `APP_BUILD` build-arg) gömülür ve her
 * derlemede kendiliğinden artar. Yerel geliştirmede ve numarasız derlemelerde `null`; o zaman sürüm ne gösterilir
 * ne de karşılaştırılır.
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

/** Kullanıcıya gösterilen biçim: `#128`. */
export function buildLabel(build: string): string {
  return `#${build}`;
}
