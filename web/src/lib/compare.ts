/** Masa etiketi karşılaştırıcısı: Türkçe harf sırası, sayılar sayısal ("M2" < "M10"). */
export const byLabel = (a: string, b: string): number => a.localeCompare(b, "tr", { numeric: true });
