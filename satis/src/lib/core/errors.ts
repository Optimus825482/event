import type { SalesErrorCode } from "./contract";

export type SiteErrorCode = SalesErrorCode | "core_unreachable";

/** Çekirdekten ya da ona ulaşırken oluşan hata; kullanıcıya yalnızca `messageFor` çıktısı gösterilir. */
export class CoreError extends Error {
  readonly code: SiteErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code: SiteErrorCode,
    status: number,
    details?: Record<string, unknown>,
    retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "CoreError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const ERROR_MESSAGES: Record<SiteErrorCode, string> = {
  invalid: "Bilgileri kontrol edip tekrar deneyin.",
  unauthorized: "Satış sistemi şu anda kullanılamıyor.",
  payment_declined: "Ödeme reddedildi. Süreniz dolana kadar yeniden deneyebilirsiniz.",
  event_not_found: "Etkinlik bulunamadı ya da satışta değil.",
  order_not_found: "Sipariş bulunamadı.",
  sales_closed: "Bu etkinlik için satış şu anda kapalı.",
  seats_unavailable: "Bu masa az önce doldu. Lütfen başka bir masa seçin.",
  leaves_single_seat: "Bu adet masada tek boş sandalye bırakıyor. Lütfen adedi değiştirin.",
  whole_table_required: "Bu masa yalnızca bütün olarak alınabilir.",
  table_not_sellable: "Bu masa satışta değil.",
  limit_exceeded: "Tek siparişte alınabilecek adet aşıldı.",
  price_missing: "Bu masanın fiyatı henüz belirlenmedi.",
  hold_expired: "Süreniz doldu. Masayı yeniden seçmeniz gerekiyor.",
  already_paid: "Bu siparişin ödemesi zaten alınmış.",
  rate_limited: "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.",
  payments_disabled: "Ödeme şu anda alınamıyor.",
  sales_api_disabled: "Satış sistemi şu anda kullanılamıyor.",
  core_unreachable: "Satış sistemine ulaşılamıyor. Lütfen biraz sonra tekrar deneyin.",
};

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** Kullanıcıya gösterilecek Türkçe mesaj; çekirdeğin `message` alanı kullanılmaz. */
export function messageFor(error: {
  code: SiteErrorCode;
  details?: Record<string, unknown>;
  retryAfterSeconds?: number;
}): string {
  const { code, details, retryAfterSeconds } = error;
  if (code === "seats_unavailable" && isPositiveNumber(details?.free)) {
    return `Bu masada yalnızca ${details.free} boş sandalye kaldı.`;
  }
  if (code === "whole_table_required" && isPositiveNumber(details?.seats)) {
    return `Bu masa yalnızca bütün olarak (${details.seats} kişilik) alınabilir.`;
  }
  if (code === "rate_limited" && isPositiveNumber(retryAfterSeconds)) {
    return `Çok fazla deneme yapıldı. ${Math.ceil(retryAfterSeconds / 60)} dakika sonra tekrar deneyin.`;
  }
  return ERROR_MESSAGES[code];
}
