import { PASSWORD_MIN_LENGTH } from "./schemas";

export type PasswordChangeInput = { current: string; next: string; confirm: string };

/** İstemci tarafı ön doğrulama; sunucu eylemi aynı kuralları yeniden uygular. */
export function validatePasswordChange(input: PasswordChangeInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.current === "") errors.current = "Mevcut parolayı girin";
  if (input.next.length < PASSWORD_MIN_LENGTH) errors.next = `Yeni parola en az ${PASSWORD_MIN_LENGTH} karakter olmalı`;
  else if (input.next === input.current) errors.next = "Yeni parola mevcut parolayla aynı olamaz";
  if (input.confirm !== input.next) errors.confirm = "Parolalar eşleşmiyor";
  return errors;
}

export type PasswordActionFailure = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

const WRONG_CURRENT = "Mevcut parola hatalı";

/** `changeOwnPasswordAction` başarısız sonucunu Türkçe mesaja ve ilgili alana çevirir. */
export function passwordChangeError(failure: PasswordActionFailure): {
  field: "current" | "next" | null;
  message: string;
} {
  const next = failure.fieldErrors?.newPassword?.[0];
  if (next) return { field: "next", message: next };
  const current = failure.fieldErrors?.currentPassword?.[0];
  if (current) return { field: "current", message: current };
  if (failure.code === "unauthenticated") {
    return { field: null, message: "Oturumunuz sona ermiş. Lütfen yeniden giriş yapın." };
  }
  if (failure.code === "invalid" && failure.message === WRONG_CURRENT) return { field: "current", message: WRONG_CURRENT };
  if (failure.code === "invalid") return { field: null, message: failure.message };
  return { field: null, message: "Parola değiştirilemedi. Lütfen tekrar deneyin." };
}
