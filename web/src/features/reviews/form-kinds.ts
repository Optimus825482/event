/** Değerlendirme formu türleri: kısa (genel yıldız) ve ayrıntılı (8 kategori). */
export const REVIEW_FORM_KINDS = ["short", "full"] as const;
export type ReviewFormKind = (typeof REVIEW_FORM_KINDS)[number];

export const REVIEW_FORM_KIND_LABELS: Record<ReviewFormKind, string> = {
  short: "Kısa değerlendirme",
  full: "Ayrıntılı değerlendirme",
};
