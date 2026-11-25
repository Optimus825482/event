import type { RatingBand, RatingKey } from "./score";

export const RATING_LABELS: Record<RatingKey, string> = {
  communication: "İletişim",
  punctuality: "Dakiklik",
  teamwork: "Takım çalışması",
  customerService: "Müşteri hizmeti",
  technicalSkills: "Teknik beceri",
  initiative: "İnisiyatif",
  appearance: "Görünüm",
  stressManagement: "Stres yönetimi",
};

export const BAND_LABELS: Record<RatingBand, string> = {
  very_bad: "Çok kötü",
  bad: "Kötü",
  average: "Orta",
  good: "İyi",
  successful: "Başarılı",
  excellent: "Mükemmel",
};

export const REVIEW_MESSAGES = {
  disabled: "Bu etkinlik için değerlendirme sistemi kapalı",
  locked: "Tamamlanan değerlendirme değiştirilemez",
  eventNotFound: "Etkinlik bulunamadı",
  notOnTeam: "Personel bu etkinlikte sizin değerlendirebileceğiniz bir görevde değil",
  self: "Kendinizi değerlendiremezsiniz",
  reviewNotFound: "Değerlendirme bulunamadı",
  incomplete: "Tamamlamak için tüm kategoriler puanlanmalı",
} as const;
