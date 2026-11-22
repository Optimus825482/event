export class UnauthenticatedError extends Error {
  constructor(message = "Oturum gerekli") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/**
 * Next'in `forbidden()` hatasının özeti (`NEXT_HTTP_ERROR_FALLBACK;403`). Bu özeti taşıyan hata bir
 * sayfa veya düzen sırasında fırlatılırsa Next onu beklenmeyen hata saymaz: günlüğe yazmaz,
 * en yakın `forbidden.tsx` dosyasını 403 durum koduyla gösterir. Sunucu eylemleri bu hatayı
 * kendileri yakalayıp `forbidden` sonucuna çevirir (`lib/action.ts`). `tests/lib/forbidden-error.test.ts`
 * değerin Next'in kendi değerleriyle aynı kaldığını doğrular.
 */
const NEXT_FORBIDDEN_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;403";

export class ForbiddenError extends Error {
  readonly digest = NEXT_FORBIDDEN_DIGEST;

  constructor(message = "Bu işlem için yetkiniz yok") {
    super(message);
    this.name = "ForbiddenError";
  }
}
