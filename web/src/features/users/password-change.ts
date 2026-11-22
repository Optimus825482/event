import { parseRetryAfter } from "@/features/auth/login-error";
import { PASSWORD_MIN_LENGTH } from "./schemas";

export type PasswordChangeInput = { current: string; next: string; confirm: string };

/** İstemci tarafı ön doğrulama; sunucu (Better Auth) aynı kuralları yeniden uygular. */
export function validatePasswordChange(input: PasswordChangeInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.current === "") errors.current = "Mevcut parolayı girin";
  if (input.next.length < PASSWORD_MIN_LENGTH) errors.next = `Yeni parola en az ${PASSWORD_MIN_LENGTH} karakter olmalı`;
  else if (input.next === input.current) errors.next = "Yeni parola mevcut parolayla aynı olamaz";
  if (input.confirm !== input.next) errors.confirm = "Parolalar eşleşmiyor";
  return errors;
}

type ErrorBody = { code?: unknown } | null;

function waitPhrase(seconds: number): string {
  return seconds < 60 ? `${seconds} saniye` : `${Math.ceil(seconds / 60)} dakika`;
}

/** Better Auth `change-password` başarısız yanıtını Türkçe mesaja ve ilgili alana çevirir. */
export function passwordChangeError(
  status: number,
  body: ErrorBody,
  retryAfter: string | null,
): { field: "current" | "next" | null; message: string } {
  if (status === 429) {
    const seconds = parseRetryAfter(retryAfter);
    return {
      field: null,
      message:
        seconds === null
          ? "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin."
          : `Çok fazla deneme yapıldı. Lütfen ${waitPhrase(seconds)} sonra tekrar deneyin.`,
    };
  }
  const code = typeof body?.code === "string" ? body.code : "";
  if (code === "INVALID_PASSWORD") return { field: "current", message: "Mevcut parola hatalı" };
  if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
    return { field: "next", message: `Yeni parola ${PASSWORD_MIN_LENGTH}–200 karakter arasında olmalı` };
  }
  if (status === 401) return { field: null, message: "Oturumunuz sona ermiş. Lütfen yeniden giriş yapın." };
  return { field: null, message: "Parola değiştirilemedi. Lütfen tekrar deneyin." };
}
